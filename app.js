// 上海天气 - 实时天气查看器
// 数据来源: wttr.in

const WEATHER_URL = 'https://wttr.in/Shanghai?format=j1&lang=zh';

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
  const current = data.current_condition[0];
  
  // 位置
  document.getElementById('location').textContent = '上海市';
  
  // 温度
  document.getElementById('mainTemp').textContent = `${current.temp_C}°`;
  
  // 天气状况
  const condition = getConditionText(current.weatherCode);
  const conditionIcon = getConditionIcon(current.weatherCode);
  document.getElementById('condition').textContent = `${conditionIcon} ${condition}`;
  
  // 详情
  document.getElementById('feelsLike').textContent = `${current.FeelsLikeC}°C`;
  document.getElementById('humidity').textContent = `${current.humidity}%`;
  document.getElementById('wind').textContent = `${current.windspeedKmph} km/h`;
  document.getElementById('precipitation').textContent = `${current.precipMM} mm`;
  
  // 预报
  updateForecast(data.weather);
  
  // 更新时间
  document.getElementById('updateTime').textContent = new Date().toLocaleString('zh-CN');
  
  showContent(true);
}

// 更新预报
function updateForecast(forecast) {
  const container = document.getElementById('forecast');
  const days = ['今天', '明天', '后天'];
  
  let html = '<h4>📅 三日预报</h4><div class="forecast-days">';
  
  forecast.slice(0, 3).forEach((day, index) => {
    const maxTemp = day.maxtempC;
    const minTemp = day.mintempC;
    const icon = getConditionIcon(day.hourly[4].weatherCode);
    
    html += `
      <div class="forecast-day">
        <div class="day-name">${days[index]}</div>
        <div class="day-icon">${icon}</div>
        <div class="day-temp">${maxTemp}° / ${minTemp}°</div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// 根据天气码获取文字描述
function getConditionText(code) {
  const conditions = {
    '113': '晴',
    '116': '多云',
    '119': '阴',
    '122': '阴',
    '143': '雾',
    '176': '局部阵雨',
    '179': '局部阵雪',
    '182': '局部雨夹雪',
    '185': '局部雨夹雪',
    '200': '局部雷暴',
    '227': '局部降雪',
    '230': '大雪',
    '248': '雾',
    '260': '雾',
    '263': '小雨',
    '266': '小雨',
    '281': '雨夹雪',
    '284': '雨夹雪',
    '293': '小雨',
    '296': '小雨',
    '299': '中雨',
    '302': '中雨',
    '305': '大雨',
    '308': '大雨',
    '311': '雨夹雪',
    '314': '雨夹雪',
    '317': '雨夹雪',
    '320': '小雪',
    '323': '小雪',
    '326': '小雪',
    '329': '中雪',
    '332': '中雪',
    '335': '大雪',
    '338': '大雪',
    '350': '冰粒',
    '353': '小雨',
    '356': '中雨',
    '359': '大雨',
    '362': '小雨夹雪',
    '365': '小雪',
    '368': '小雪',
    '371': '中雪',
    '374': '冰粒',
    '377': '冰粒',
    '386': '雷暴',
    '389': '雷暴',
    '392': '雷暴',
    '395': '大雪'
  };
  return conditions[code] || '未知';
}

// 根据天气码获取图标
function getConditionIcon(code) {
  const icons = {
    '113': '☀️',
    '116': '⛅',
    '119': '☁️',
    '122': '☁️',
    '143': '🌫️',
    '176': '🌦️',
    '179': '🌨️',
    '182': '🌨️',
    '185': '🌨️',
    '200': '⛈️',
    '227': '🌨️',
    '230': '❄️',
    '248': '🌫️',
    '260': '🌫️',
    '263': '🌧️',
    '266': '🌧️',
    '281': '🌨️',
    '284': '🌨️',
    '293': '🌧️',
    '296': '🌧️',
    '299': '🌧️',
    '302': '🌧️',
    '305': '🌧️',
    '308': '🌧️',
    '311': '🌨️',
    '314': '🌨️',
    '317': '🌨️',
    '320': '🌨️',
    '323': '🌨️',
    '326': '🌨️',
    '329': '🌨️',
    '332': '🌨️',
    '335': '❄️',
    '338': '❄️',
    '350': '🌨️',
    '353': '🌧️',
    '356': '🌧️',
    '359': '🌧️',
    '362': '🌨️',
    '365': '🌨️',
    '368': '🌨️',
    '371': '🌨️',
    '374': '🌨️',
    '377': '🌨️',
    '386': '⛈️',
    '389': '⛈️',
    '392': '⛈️',
    '395': '❄️'
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
