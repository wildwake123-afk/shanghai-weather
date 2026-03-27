// 上海天气 - 实时天气查看器
// 数据来源: NOAA RAW METAR (ZSPD - 上海浦东机场)
// 每次刷新自动获取最新 METAR

const METAR_URL = 'https://tgftp.nws.noaa.gov/data/observations/metar/stations/ZSPD.TXT';

// 默认刷新间隔（分钟）
const DEFAULT_REFRESH_INTERVAL = 5;

// DOM 元素
const loadingEl = document.getElementById('loading');
const weatherContentEl = document.getElementById('weatherContent');
const errorEl = document.getElementById('error');
const settingsPanel = document.getElementById('settingsPanel');
const overlay = document.createElement('overlay');
document.body.appendChild(overlay);

// 天气数据字段
let refreshInterval = DEFAULT_REFRESH_INTERVAL;
let refreshTimer = null;

// 初始化
function init() {
  loadSettings();
  fetchMetar();
  startAutoRefresh();
  bindEvents();
}

// 绑定事件
function bindEvents() {
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('refreshNow').addEventListener('click', () => {
    fetchMetar();
    closeSettings();
  });
  overlay.addEventListener('click', closeSettings);
}

// 加载设置
function loadSettings() {
  const saved = localStorage.getItem('weatherRefreshInterval');
  if (saved) {
    refreshInterval = parseInt(saved, 10);
    document.getElementById('refreshInterval').value = refreshInterval;
  }
}

// 保存设置
function saveSettings() {
  const input = document.getElementById('refreshInterval');
  const value = parseInt(input.value, 10);
  
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

// 开始自动刷新
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchMetar, refreshInterval * 60 * 1000);
}

// 重新开始自动刷新
function restartAutoRefresh() {
  startAutoRefresh();
}

// 获取并解析 METAR
async function fetchMetar() {
  try {
    showLoading(true);
    
    const response = await fetch(METAR_URL);
    if (!response.ok) throw new Error('网络请求失败');
    
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    if (lines.length < 2) throw new Error('METAR 数据格式异常');
    
    const dateStr = lines[0].trim();   // 2026/03/27 05:00
    const rawMetar = lines[1].trim(); // ZSPD 270500Z ...
    
    const parsed = parseMetar(rawMetar, dateStr);
    updateUI(parsed);
    showLoading(false);
  } catch (error) {
    console.error('获取天气失败:', error);
    showError('获取天气数据失败，请稍后重试');
  }
}

// 解析 METAR 字符串
// 例: ZSPD 270500Z 17004MPS 130V190 CAVOK 17/10 Q1015 NOSIG
function parseMetar(metar, dateStr) {
  const parts = metar.split(/\s+/);
  const result = {
    station: parts[0] || 'ZSPD',
    raw: metar,
    date: dateStr,
    time: '',
    wind: '',
    windSpeed: '',
    windDir: '',
    visibility: '',
    condition: '',
    conditionIcon: '',
    temp: '',
    dewpoint: '',
    pressure: '',
    trend: '',
    clouds: ''
  };
  
  // 解析时间 (270500Z)
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d{6}Z$/.test(p)) {
      const day = p.slice(0, 2);
      const hour = p.slice(2, 4);
      const min = p.slice(4, 6);
      result.time = `${hour}:${min} UTC`;
      // UTC 转本地时间（上海 = UTC+8）
      const utcHour = parseInt(hour);
      const localHour = (utcHour + 8) % 24;
      result.localTime = `${String(localHour).padStart(2,'0')}:${min} 本地`;
      break;
    }
  }
  
  // 解析风向风速 (17004MPS 或 00000MPS)
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d{5}MPS$/.test(p) || /^\d{3}\d{2}MPS$/.test(p)) {
      let dir = parseInt(p.slice(0, 3));
      const speed = parseInt(p.slice(3, 5));
      if (dir === 0 || dir === 360) result.windDir = '北';
      else if (dir === 90) result.windDir = '东';
      else if (dir === 180) result.windDir = '南';
      else if (dir === 270) result.windDir = '西';
      else result.windDir = `${dir}°`;
      
      result.windSpeed = `${speed} m/s`;
      // 换算节
      const knots = (speed * 1.94384).toFixed(1);
      result.wind = `${result.windDir} ${speed} m/s (${knots} kt)`;
      
      // 检查变量风向
      if (i+1 < parts.length && /^\d{3}V\d{3}$/.test(parts[i+1])) {
        const vparts = parts[i+1].match(/(\d{3})V(\d{3})/);
        result.wind += ` 变风 ${vparts[1]}°-${vparts[2]}°`;
        i++;
      }
      break;
    }
  }
  
  // 解析能见度
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (/^CAVOK$/.test(p)) {
      result.visibility = '≥10km（能见度极好）';
      result.condition = '晴空万里';
      result.conditionIcon = '☀️';
      break;
    }
    if (/^\d{4}$/.test(p)) {
      const vis = parseInt(p);
      result.visibility = vis >= 9999 ? '≥10km' : `${vis}m`;
      break;
    }
    if (/^9999$/.test(p)) {
      result.visibility = '≥10km';
      break;
    }
  }
  
  // 解析天气现象 + 云
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    // CAVOK 已经处理
    if (p === 'CAVOK') continue;
    
    // 气温/露点 (17/10)
    const tdMatch = p.match(/^(M)?(\d{2})\/((M)?(\d{2})|-)$/);
    if (tdMatch) {
      const sign1 = tdMatch[1] === 'M' ? '-' : '';
      const sign2 = tdMatch[4] === 'M' ? '-' : '';
      result.temp = `${sign1}${tdMatch[2]}°C`;
      result.dewpoint = `${sign2}${tdMatch[5] || tdMatch[3]}°C`;
      continue;
    }
    
    // 气压 Q1015
    if (/^Q\d{4}$/.test(p)) {
      result.pressure = `${p.slice(1)} hPa`;
      continue;
    }
    
    // 趋势 NOSIG BECMG TEMPO 等
    if (/^(NOSIG|BECMG|TEMPO|DZ|RA|SN|TS|SH|FG|BR|SQ|GR)$/.test(p)) {
      if (p === 'NOSIG') result.trend = '无明显变化';
      else if (p === 'BECMG') result.trend = '预期变化';
      else if (p === 'TEMPO') result.trend = '暂时变化';
      else result.trend = p;
      continue;
    }
    
    // 云 (SCT025 BKN040 OVC060 等)
    if (/^(FEW|SCT|BKN|OVC|VV)(\d{3})$/.test(p)) {
      const cloudMap = { FEW: '少云', SCT: '疏云', BKN: '多云', OVC: '阴天', VV: '垂直能见度' };
      const type = p.slice(0, 3);
      const h = parseInt(p.slice(3)) * 100;
      result.clouds = `${cloudMap[type] || type} ${h}ft`;
      continue;
    }
    
    // 天气现象码
    if (/^(TS|TSRA|RA|DZ|SN|SG|GR|GS|BR|FG|HZ|SQ|FC|SS|DS)$/.test(p)) {
      const wxMap = {
        'TS': '雷暴', 'TSRA': '雷雨', 'RA': '雨', 'DZ': '毛毛雨',
        'SN': '雪', 'SG': '雪粒', 'GR': '冰雹', 'GS': '小冰雹',
        'BR': '轻雾', 'FG': '雾', 'HZ': '霾', 'SQ': '飑',
        'FC': '龙卷风', 'SS': '沙尘暴', 'DS': '尘暴'
      };
      if (!result.wxPhenomena) result.wxPhenomena = [];
      result.wxPhenomena.push(wxMap[p] || p);
    }
  }
  
  // 根据天气现象更新状况
  if (result.wxPhenomena && result.wxPhenomena.length > 0) {
    result.condition = result.conditionIcon = '';
    const iconMap = {
      '雷暴': '⛈️', '雷雨': '⛈️', '雨': '🌧️', '毛毛雨': '🌧️',
      '雪': '❄️', '小雪': '🌨️', '雾': '🌫️', '轻雾': '🌫️',
      '霾': '🌫️', '冰雹': '🧊', '飑': '💨'
    };
    result.conditionIcon = iconMap[result.wxPhenomena[0]] || '🌧️';
    result.condition = result.wxPhenomena.join('、');
  }
  
  if (!result.condition) {
    result.condition = result.conditionIcon === '☀️' ? '晴空万里' : '多云';
  }
  
  return result;
}

// 更新UI
function updateUI(data) {
  document.getElementById('location').textContent = `📍 ${data.station} 上海浦东机场`;
  
  // 温度
  const tempNum = parseFloat(data.temp);
  document.getElementById('mainTemp').textContent = `${tempNum}°`;
  
  // 天气状况
  document.getElementById('condition').textContent = `${data.conditionIcon} ${data.condition}`;
  
  // 详情
  document.getElementById('feelsLike').textContent = `${data.temp} / ${data.dewpoint}`;
  document.getElementById('humidity').textContent = data.dewpoint ? estimateHumidity(tempNum, parseFloat(data.dewpoint)) : '--';
  document.getElementById('wind').textContent = data.wind || '--';
  document.getElementById('precipitation').textContent = data.wxPhenomena ? data.wxPhenomena.join('、') : '无';
  
  // 气压
  const pressureNum = parseFloat(data.pressure);
  document.getElementById('pressureDisplay') || createPressureDisplay();
  document.getElementById('pressureDisplay').textContent = `${data.pressure}`;
  
  // 预报区 — 显示原始 METAR
  const container = document.getElementById('forecast');
  container.innerHTML = `
    <h4>📡 METAR 原始数据</h4>
    <div class="metar-raw">${data.raw}</div>
    <div class="metar-info">
      <div><span>📅 ${data.date}</span></div>
      <div><span>🕐 ${data.time} / ${data.localTime}</span></div>
      ${data.clouds ? `<div><span>☁️ ${data.clouds}</span></div>` : ''}
      <div><span>📊 ${data.pressure}</span></div>
      ${data.trend ? `<div><span>📈 ${data.trend}</span></div>` : ''}
    </div>
  `;
  
  // 更新时间
  document.getElementById('updateTime').textContent = new Date().toLocaleString('zh-CN');
  
  showContent(true);
}

// 根据温度和露点估算相对湿度
function estimateHumidity(temp, dewpoint) {
  if (isNaN(temp) || isNaN(dewpoint) || temp <= dewpoint) return '--';
  const rh = 100 * Math.exp((17.625 * dewpoint) / (243.04 + dewpoint) - (17.625 * temp) / (243.04 + temp));
  return `${Math.round(rh)}%`;
}

// 创建气压显示（扩展详情）
function createPressureDisplay() {
  const details = document.querySelector('.details');
  const pressureItem = document.createElement('div');
  pressureItem.className = 'detail-item';
  pressureItem.innerHTML = `<span class="label">气压</span><span class="value" id="pressureDisplay">--</span>`;
  details.appendChild(pressureItem);
  return document.getElementById('pressureDisplay');
}

// 显示/隐藏 loading
function showLoading(show) {
  loadingEl.style.display = show ? 'block' : 'none';
  if (show) {
    weatherContentEl.style.display = 'none';
    errorEl.style.display = 'none';
  }
}

// 显示/隐藏内容
function showContent(show) {
  weatherContentEl.style.display = show ? 'block' : 'none';
  if (show) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
  }
}

// 显示错误
function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  loadingEl.style.display = 'none';
  weatherContentEl.style.display = 'none';
}

// 打开设置面板
function openSettings() {
  settingsPanel.classList.add('active');
  overlay.classList.add('active');
}

// 关闭设置面板
function closeSettings() {
  settingsPanel.classList.remove('active');
  overlay.classList.remove('active');
}

// 显示提示
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// 启动
init();
