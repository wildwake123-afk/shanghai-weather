// 上海天气 - 实时天气查看器
// 数据来源: Open-Meteo API (上海浦东机场气象站 ZSPD)

const LAT = 31.1445;
const LON = 121.8083;
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FShanghai&forecast_days=3`;

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
  fetchWeather();
  startAutoRefresh();
  bindEvents();
}

// 绑定事件
function bindEvents() {
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('refreshNow').addEventListener('click', () => {
    fetchWeather();
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
  refreshTimer = setInterval(fetchWeather, refreshInterval * 60 * 1000);
}

// 重新开始自动刷新
function restartAutoRefresh() {
  startAutoRefresh();
}

// 获取天气数据
async function fetchWeather() {
  try {
    showLoading(true);
    
    const response = await fetch(WEATHER_URL);
    if (!response.ok) throw new Error('网络请求失败');
    
    const data = await response.json();
    updateUI(data);
    showLoading(false);
  } catch (error) {
    console.error('获取天气失败:', error);
    showError('获取天气数据失败，请稍后重试');
  }
}

// 更新UI
function updateUI(data) {
  const cw = data.current_weather;
  const hourly = data.hourly;
  const daily = data.daily;
  
  // 找到当前小时在 hourly 数组中的索引
  const now = new Date();
  const currentHourStr = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const hourIndex = hourly.time.findIndex(t => t.startsWith(currentHourStr));
  
  // 位置（上海浦东机场气象站）
  document.getElementById('location').textContent = '📍 上海浦东机场 (ZSPD)';
  
  // 温度
  document.getElementById('mainTemp').textContent = `${Math.round(cw.temperature)}°`;
  
  // 天气状况
  const weatherCode = hourIndex >= 0 ? hourly.weather_code[hourIndex] : cw.weathercode;
  const condition = getConditionText(weatherCode);
  const conditionIcon = getConditionIcon(weatherCode);
  document.getElementById('condition').textContent = `${conditionIcon} ${condition}`;
  
  // 体感温度（使用当前温度近似）
  document.getElementById('feelsLike').textContent = `${cw.temperature}°C`;
  
  // 湿度
  const humidity = hourIndex >= 0 ? hourly.relative_humidity_2m[hourIndex] : '--';
  document.getElementById('humidity').textContent = `${humidity}%`;
  
  // 风速
  document.getElementById('wind').textContent = `${cw.windspeed} km/h`;
  
  // 降水量
  const precip = hourIndex >= 0 ? hourly.precipitation[hourIndex] : 0;
  document.getElementById('precipitation').textContent = `${precip} mm`;
  
  // 预报
  updateForecast(daily);
  
  // 更新时间
  document.getElementById('updateTime').textContent = new Date().toLocaleString('zh-CN');
  
  showContent(true);
}

// 更新预报
function updateForecast(daily) {
  const container = document.getElementById('forecast');
  const days = ['今天', '明天', '后天'];
  const dayNames = daily.time.map((d, i) => days[i] || formatDay(d));
  
  let html = '<h4>📅 三日预报</h4><div class="forecast-days">';
  
  daily.time.slice(0, 3).forEach((date, index) => {
    const maxTemp = Math.round(daily.temperature_2m_max[index]);
    const minTemp = Math.round(daily.temperature_2m_min[index]);
    const code = daily.weather_code[index];
    const icon = getConditionIcon(code);
    
    html += `
      <div class="forecast-day">
        <div class="day-name">${dayNames[index]}</div>
        <div class="day-icon">${icon}</div>
        <div class="day-temp">${maxTemp}° / ${minTemp}°</div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// 格式化日期为"周X"
function formatDay(dateStr) {
  const d = new Date(dateStr);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[d.getDay()];
}

// 根据 WMO 天气码获取文字描述
function getConditionText(code) {
  const conditions = {
    0: '晴',
    1: '晴间多云',
    2: '多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '中毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '阵雨',
    81: '中阵雨',
    82: '强阵雨',
    85: '阵雪',
    86: '强阵雪',
    95: '雷暴',
    96: '雷暴+小冰雹',
    99: '雷暴+大冰雹'
  };
  return conditions[code] || '未知';
}

// 根据 WMO 天气码获取图标
function getConditionIcon(code) {
  const icons = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    48: '🌫️',
    51: '🌧️',
    53: '🌧️',
    55: '🌧️',
    56: '🌧️',
    57: '🌧️',
    61: '🌧️',
    63: '🌧️',
    65: '🌧️',
    66: '🌨️',
    67: '🌨️',
    71: '🌨️',
    73: '🌨️',
    75: '❄️',
    77: '🌨️',
    80: '🌦️',
    81: '🌦️',
    82: '🌦️',
    85: '🌨️',
    86: '🌨️',
    95: '⛈️',
    96: '⛈️',
    99: '⛈️'
  };
  return icons[code] || '🌡️';
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
