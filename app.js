// 上海天气 - 实时天气查看器
// 数据来源: AviationWeather.gov 官方 METAR (ZSPD)

const METAR_API = 'https://aviationweather.gov/api/data/metar?ids=ZSPD&format=json';
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

async function fetchMetar() {
  try {
    showLoading(true);
    const response = await fetch(METAR_API);
    if (!response.ok) throw new Error('网络请求失败');
    const data = await response.json();
    if (!data || data.length === 0) throw new Error('无 METAR 数据');
    updateUI(data[0]);
    showLoading(false);
  } catch (error) {
    console.error('获取天气失败:', error);
    showError('获取天气数据失败，请稍后重试');
  }
}

function getCondition(cover, rawOb) {
  if (cover === 'CAVOK' || cover === 'SKC' || cover === 'CLR') {
    return { icon: '☀️', text: '晴空万里' };
  }
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
  const wxMatch = rawOb.match(/(TS|TSRA|RA|DZ|SN|SG|GR|GS|BR|FG|HZ|SQ|FC)/);
  if (wxMatch && wxMap[wxMatch[0]]) return wxMap[wxMatch[0]];
  const coverMap = {
    'FEW': { icon: '🌤️', text: '少云' },
    'SCT': { icon: '⛅', text: '疏云' },
    'BKN': { icon: '☁️', text: '多云' },
    'OVC': { icon: '☁️', text: '阴天' },
    'VV': { icon: '🌫️', text: '垂直能见度低' },
  };
  if (cover && coverMap[cover]) return coverMap[cover];
  if (cover) return { icon: '☁️', text: cover };
  return { icon: '🌡️', text: '未知' };
}

function windDirText(deg) {
  if (deg === 0 || deg === 360) return '北';
  if (deg === 90) return '东';
  if (deg === 180) return '南';
  if (deg === 270) return '西';
  if (deg >= 1 && deg <= 22) return '北北东';
  if (deg >= 23 && deg <= 67) return '东北东';
  if (deg >= 68 && deg <= 112) return '东';
  if (deg >= 113 && deg <= 157) return '东南东';
  if (deg >= 158 && deg <= 202) return '南';
  if (deg >= 203 && deg <= 247) return '西南西';
  if (deg >= 248 && deg <= 292) return '西';
  if (deg >= 293 && deg <= 337) return '西北西';
  if (deg >= 338 && deg <= 360) return '北北西';
  return `${deg}°`;
}

function calcHumidity(temp, dewp) {
  const t = parseFloat(temp);
  const d = parseFloat(dewp);
  if (isNaN(t) || isNaN(d) || t <= d) return '--';
  const rh = 100 * Math.exp((17.625 * d) / (243.04 + d) - (17.625 * t) / (243.04 + t));
  return `${Math.round(rh)}%`;
}

function formatTime(isoString) {
  const d = new Date(isoString);
  const local = d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const utc = d.toISOString().slice(11, 16) + ' UTC';
  return { local, utc };
}

function updateUI(data) {
  const temp = parseFloat(data.temp);
  const dewp = parseFloat(data.dewp);
  const wspd = parseFloat(data.wspd);
  const wdir = parseFloat(data.wdir);
  
  document.getElementById('location').textContent = `📍 ${data.icaoId} 上海浦东机场`;
  document.getElementById('mainTemp').textContent = `${temp}°`;
  
  const cond = getCondition(data.cover, data.rawOb);
  document.getElementById('condition').textContent = `${cond.icon} ${cond.text}`;
  document.getElementById('feelsLike').textContent = `${temp}°C`;
  document.getElementById('humidity').textContent = calcHumidity(temp, dewp);
  
  const knots = (wspd * 1.94384).toFixed(1);
  const dirText = wdir ? windDirText(wdir) : '--';
  document.getElementById('wind').textContent = `${dirText} ${wspd} m/s (${knots} kt)`;
  
  const visText = data.visib === '6+' ? '≥10km' : `${data.visib} km`;
  const wxMatch = data.rawOb.match(/(TS|TSRA|RA|DZ|SN|SG|GR|GS|BR|FG|HZ|SQ|FC)/);
  document.getElementById('precipitation').textContent = wxMatch ? wxMatch[0] : '无';
  
  ensureExtraFields();
  document.getElementById('pressureDisplay').textContent = `${data.altim} hPa`;
  document.getElementById('visibilityDisplay').textContent = visText;
  
  const timeInfo = formatTime(data.reportTime);
  const container = document.getElementById('forecast');
  
  let cloudInfo = '';
  if (data.clouds && data.clouds.length > 0) {
    const coverMap = { 'FEW': '少云', 'SCT': '疏云', 'BKN': '多云', 'OVC': '阴天' };
    cloudInfo = data.clouds.map(c => `${coverMap[c.cover] || c.cover} ${c.base || '?'}00ft`).join(' | ');
  }
  
  container.innerHTML = `
    <h4>📡 METAR 原始数据</h4>
    <div class="metar-raw">${data.rawOb}</div>
    <div class="metar-info">
      <div><span>🕐 ${timeInfo.utc} / ${timeInfo.local}</span></div>
      <div><span>📊 ${data.altim} hPa</span></div>
      <div><span>👁️ ${visText}</span></div>
      ${cloudInfo ? `<div><span>☁️ ${cloudInfo}</span></div>` : ''}
      <div><span>🛫 ${data.fltCat || 'N/A'}</span></div>
    </div>
  `;
  
  document.getElementById('updateTime').textContent = new Date().toLocaleString('zh-CN');
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
