// 上海天气 - 实时天气查看器
// 数据来源: NOAA METAR via GitHub Pages 同源数据文件
// METAR 每10分钟由 GitHub Actions 自动更新

const DEFAULT_REFRESH_INTERVAL = 5;

const loadingEl = document.getElementById('loading');
const weatherContentEl = document.getElementById('weatherContent');
const errorEl = document.getElementById('error');
const settingsPanel = document.getElementById('settingsPanel');
const overlay = document.createElement('overlay');
document.body.appendChild(overlay);

let refreshInterval = DEFAULT_REFRESH_INTERVAL;
let refreshTimer = null;

function init() {
  loadSettings();
  fetchMetar();
  startAutoRefresh();
  bindEvents();
}

function bindEvents() {
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('refreshNow').addEventListener('click', () => { fetchMetar(); closeSettings(); });
  overlay.addEventListener('click', closeSettings);
}

function loadSettings() {
  const saved = localStorage.getItem('weatherRefreshInterval');
  if (saved) {
    refreshInterval = parseInt(saved, 10);
    document.getElementById('refreshInterval').value = refreshInterval;
  }
}

function saveSettings() {
  const value = parseInt(document.getElementById('refreshInterval').value, 10);
  if (value >= 1 && value <= 60) {
    refreshInterval = value;
    localStorage.setItem('weatherRefreshInterval', refreshInterval);
    restartAutoRefresh();
    closeSettings();
    showToast(`刷新间隔已设置为 ${value} 分钟`);
  } else {
    showToast('请输入 1-60 之间的数字');
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchMetar, refreshInterval * 60 * 1000);
}

function restartAutoRefresh() {
  startAutoRefresh();
}

// Fallback 数据（GitHub Pages 未就绪时使用）
const FALLBACK_DATA = {
  station: 'ZSPD',
  date: '2026/03/27 05:30',
  rawOb: 'ZSPD 270530Z 18005MPS CAVOK 17/09 Q1015 NOSIG',
  updated: '2026-03-27T05:30:00Z'
};

async function fetchMetar() {
  try {
    showLoading(true);
    const ts = `?t=${Date.now()}`;
    let response = await fetch(`./data/metar.json${ts}`);
    
    // 如果同源失败，尝试 GitHub raw
    if (!response.ok) {
      response = await fetch(`https://raw.githubusercontent.com/wildwake123-afk/shanghai-weather/main/data/metar.json${ts}`);
    }
    
    if (!response.ok) throw new Error('获取数据失败');
    const data = await response.json();
    updateUI(data);
    showLoading(false);
  } catch (error) {
    console.warn('实时数据获取失败，使用缓存数据:', error.message);
    updateUI(FALLBACK_DATA);
    showLoading(false);
  }
}

function getCondition(rawOb) {
  if (!rawOb) return { icon: '🌡️', text: '未知' };
  
  if (rawOb.includes('CAVOK')) return { icon: '☀️', text: '晴空万里' };
  if (rawOb.includes('SKC') || rawOb.includes('CLR')) return { icon: '☀️', text: '晴' };
  
  const wxMap = {
    'TS': { icon: '⛈️', text: '雷暴' },
    'TSRA': { icon: '⛈️', text: '雷雨' },
    'RA': { icon: '🌧️', text: '雨' },
    'DZ': { icon: '🌧️', text: '毛毛雨' },
    'SN': { icon: '❄️', text: '雪' },
    'SG': { icon: '🌨️', text: '雪粒' },
    'GR': { icon: '🧊', text: '冰雹' },
    'GS': { icon: '🌨️', text: '小冰雹' },
    'BR': { icon: '🌫️', text: '轻雾' },
    'FG': { icon: '🌫️', text: '雾' },
    'HZ': { icon: '🌫️', text: '霾' },
    'SQ': { icon: '💨', text: '飑' },
    'FC': { icon: '🌪️', text: '龙卷风' },
  };
  
  for (const [key, val] of Object.entries(wxMap)) {
    if (rawOb.includes(key)) return val;
  }
  
  if (rawOb.includes('OVC')) return { icon: '☁️', text: '阴天' };
  if (rawOb.includes('BKN')) return { icon: '☁️', text: '多云' };
  if (rawOb.includes('SCT')) return { icon: '⛅', text: '疏云' };
  if (rawOb.includes('FEW')) return { icon: '🌤️', text: '少云' };
  
  return { icon: '☁️', text: '多云' };
}

function parseMetar(rawOb) {
  const result = {
    wind: '--', windSpeed: 0, windDir: 0,
    temp: '--', dewp: '--',
    pressure: '--', visibility: '≥10km',
    clouds: '', wx: ''
  };
  
  if (!rawOb) return result;
  
  // 风向风速 17004MPS 或 00000MPS
  const windMatch = rawOb.match(/(\d{3})(\d{2})MPS/);
  if (windMatch) {
    let dir = parseInt(windMatch[1]);
    const speed = parseInt(windMatch[2]);
    const dirNames = ['北','北北东','东北东','东北东','东','东南东','东南东','南','西南西','西南西','西','西北西','西北西','北北西','北北西','北'];
    result.windDir = dir;
    result.windSpeed = speed;
    const dirText = dir === 0 ? '静风' : `${dir}°(${dirNames[Math.round(dir/22.5)] || dir+'°'})`;
    const knots = (speed * 1.94384).toFixed(1);
    result.wind = `${dirText} ${speed}m/s (${knots}kt)`;
    
    // 变量风向
    const varMatch = rawOb.match(/(\d{3})V(\d{3})/);
    if (varMatch) result.wind += ` 变风${varMatch[1]}°-${varMatch[2]}°`;
  }
  
  // 气温/露点 17/10 或 M05/M10
  const tdMatch = rawOb.match(/(M)?(\d{2})\/(M)?(\d{2})|(\d{2})\/(\d{2})/);
  if (tdMatch) {
    if (tdMatch[5] && tdMatch[6]) {
      result.temp = `${tdMatch[5]}°C`;
      result.dewp = `${tdMatch[6]}°C`;
    } else if (tdMatch[1] && tdMatch[2]) {
      result.temp = `-${tdMatch[2]}°C`;
      if (tdMatch[4]) result.dewp = `-${tdMatch[4]}°C`;
      else if (tdMatch[3]) result.dewp = `${tdMatch[4]}°C`;
    }
  }
  
  // 气压 Q1015
  const pressMatch = rawOb.match(/Q(\d{4})/);
  if (pressMatch) result.pressure = `${pressMatch[1]} hPa`;
  
  // 能见度
  if (rawOb.includes('CAVOK')) {
    result.visibility = '≥10km';
  } else {
    const visMatch = rawOb.match(/(^|\s)(\d{4})(?=\s|$)/);
    if (visMatch) {
      const vis = parseInt(visMatch[2]);
      result.visibility = vis >= 9999 ? '≥10km' : `${vis}m`;
    }
  }
  
  // 天气现象
  const wxMatch = rawOb.match(/(TS|TSRA|RA|DZ|SN|SG|GR|GS|BR|FG|HZ|SQ|FC)/);
  if (wxMatch) result.wx = wxMatch[0];
  
  // 云层
  const cloudMatch = rawOb.match(/(FEW|SCT|BKN|OVC|VV)(\d{3})/g);
  if (cloudMatch) {
    const coverMap = { 'FEW': '少云', 'SCT': '疏云', 'BKN': '多云', 'OVC': '阴天', 'VV': '垂直能见度' };
    result.clouds = cloudMatch.map(c => {
      const type = c.slice(0, 3);
      const h = parseInt(c.slice(3)) * 100;
      return `${coverMap[type] || type} ${h}ft`;
    }).join(' | ');
  }
  
  return result;
}

function calcHumidity(tempStr, dewpStr) {
  const t = parseFloat(tempStr);
  const d = parseFloat(dewpStr);
  if (isNaN(t) || isNaN(d) || t <= d) return '--';
  const rh = 100 * Math.exp((17.625 * d) / (243.04 + d) - (17.625 * t) / (243.04 + t));
  return `${Math.round(rh)}%`;
}

function updateUI(data) {
  const parsed = parseMetar(data.rawOb);
  const cond = getCondition(data.rawOb);
  const temp = parseFloat(parsed.temp);
  
  document.getElementById('location').textContent = `📍 ${data.station} 上海浦东机场`;
  document.getElementById('mainTemp').textContent = isNaN(temp) ? '--' : `${temp}°`;
  document.getElementById('condition').textContent = `${cond.icon} ${cond.text}`;
  document.getElementById('feelsLike').textContent = parsed.temp;
  document.getElementById('humidity').textContent = calcHumidity(parsed.temp, parsed.dewp);
  document.getElementById('wind').textContent = parsed.wind;
  document.getElementById('precipitation').textContent = parsed.wx || '无';
  
  ensureExtraFields();
  document.getElementById('pressureDisplay').textContent = parsed.pressure;
  document.getElementById('visibilityDisplay').textContent = parsed.visibility;
  
  // 时间格式化
  let timeDisplay = data.date || '';
  if (data.updated) {
    const d = new Date(data.updated);
    const local = d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const utc = d.toISOString().slice(11, 16) + ' UTC';
    timeDisplay = `${utc} / ${local}`;
  }
  
  const container = document.getElementById('forecast');
  container.innerHTML = `
    <h4>📡 METAR 原始数据</h4>
    <div class="metar-raw">${data.rawOb}</div>
    <div class="metar-info">
      <div><span>🕐 ${timeDisplay}</span></div>
      <div><span>📊 ${parsed.pressure}</span></div>
      <div><span>👁️ ${parsed.visibility}</span></div>
      ${parsed.clouds ? `<div><span>☁️ ${parsed.clouds}</span></div>` : ''}
    </div>
  `;
  
  document.getElementById('updateTime').textContent = `数据更新: ${new Date(data.updated).toLocaleString('zh-CN')}`;
  showContent(true);
}

function ensureExtraFields() {
  if (!document.getElementById('pressureDisplay')) {
    const d = document.querySelector('.details');
    const p = document.createElement('div');
    p.className = 'detail-item';
    p.innerHTML = `<span class="label">气压</span><span class="value" id="pressureDisplay">--</span>`;
    d.appendChild(p);
  }
  if (!document.getElementById('visibilityDisplay')) {
    const d = document.querySelector('.details');
    const v = document.createElement('div');
    v.className = 'detail-item';
    v.innerHTML = `<span class="label">能见度</span><span class="value" id="visibilityDisplay">--</span>`;
    d.appendChild(v);
  }
}

function showLoading(show) {
  loadingEl.style.display = show ? 'block' : 'none';
  if (show) {
    weatherContentEl.style.display = 'none';
    errorEl.style.display = 'none';
  }
}

function showContent(show) {
  weatherContentEl.style.display = show ? 'block' : 'none';
  if (show) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  loadingEl.style.display = 'none';
  weatherContentEl.style.display = 'none';
}

function openSettings() {
  settingsPanel.classList.add('active');
  overlay.classList.add('active');
}

function closeSettings() {
  settingsPanel.classList.remove('active');
  overlay.classList.remove('active');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

init();
