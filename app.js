// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND ANON KEY
const SUPABASE_URL = 'https://xfpjcpzqeaonidyymqas.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcGpjcHpxZWFvbmlkeXltcWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTIzODEsImV4cCI6MjA4ODcyODM4MX0.VKxnxzYxsRG-0ONaN4HigNyApTuVAKaEr8AHb8x2NY8';

console.log("Saffron App Script Started");

// Client defined globally but initialized in init()
let supabase;

// ==========================================
// 2. DOM Elements
// ==========================================
const connDot = document.getElementById('connection-dot');
const connStatus = document.getElementById('connection-status');

const fillTemp = document.querySelector('.temp-fill');
const fillHum = document.querySelector('.hum-fill');
const fillMoist = document.querySelector('.moist-fill');
const fillAir = document.querySelector('.air-fill');
const fillLight = document.querySelector('.light-fill');

const valTemp = document.getElementById('val-temp');
const valHum = document.getElementById('val-hum');
const valMoist = document.getElementById('val-moist');
const valAir = document.getElementById('val-air');
const valLight = document.getElementById('val-light');

const themeToggleBtn = document.getElementById('theme-toggle');
const rootElement = document.documentElement;
const modeToggle = document.getElementById('mode-toggle');
const btnMist = document.getElementById('btn-mist');
const btnFan = document.getElementById('btn-fan');
const lightSlider = document.getElementById('light-slider');
const lightDisplay = document.getElementById('light-val-display');
const lightBulbIcon = document.getElementById('light-bulb-icon');
const autoOverlay = document.getElementById('auto-overlay');

const aiStatusBadge = document.getElementById('ai-status-badge');
const aiConfVal = document.getElementById('ai-conf-val');
const aiConfBar = document.getElementById('ai-conf-bar');

const GAUGE_LENGTH = 142;

let uiState = {
  mode: 'AUTO', 
  mist_maker: false,
  cooling_fan: false,
  light_intensity: 0
};

// ==========================================
// 3. Chart.js Setup
// ==========================================
const canvas = document.getElementById('envChart');
let envChart;
const maxDataPoints = 20;

function setGaugeProgress(element, value, max) {
  if (!element) return;
  let pct = Math.min(Math.max(value / max, 0), 1);
  let offset = GAUGE_LENGTH - (pct * GAUGE_LENGTH);
  element.style.strokeDasharray = GAUGE_LENGTH;
  element.style.strokeDashoffset = offset;
}

function initChart() {
  console.log("Initializing Chart...");
  if (!canvas) {
    console.error("Canvas 'envChart' not found!");
    return;
  }
  try {
    const ctx = canvas.getContext('2d');
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    envChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temp (°C)',
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            data: [],
            tension: 0.7,
            fill: true
          },
          {
            label: 'Hum (%)',
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            data: [],
            tension: 0.4,
            fill: true
          },
          {
            label: 'Moisture (%)',
            borderColor: '#10b981',
            data: [],
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { color: 'rgba(150, 160, 175, 0.1)' } },
          y: { grid: { color: 'rgba(150, 160, 175, 0.1)' }, beginAtZero: true }
        }
      }
    });
    console.log("Chart initialized successfully.");
  } catch (err) {
    console.error("Chart initialization failed:", err);
  }
}

function updateChart(timestamp, temp, hum, moist) {
  if (!envChart) return;
  const timeLabel = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  envChart.data.labels.push(timeLabel);
  envChart.data.datasets[0].data.push(temp);
  envChart.data.datasets[1].data.push(hum);
  envChart.data.datasets[2].data.push(moist);

  if (envChart.data.labels.length > maxDataPoints) {
    envChart.data.labels.shift();
    envChart.data.datasets.forEach(ds => ds.data.shift());
  }
  envChart.update();
}

// ==========================================
// 4. Data Operations
// ==========================================
async function fetchAIPrediction(temp, hum, moist, aqi) {
  try {
    const response = await fetch('/predict_mist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature: temp,
        humidity: hum,
        soil_moisture: moist,
        air_quality: aqi
      })
    });

    if (!response.ok) throw new Error('API offline');

    const data = await response.json();
    const isRequired = data.mist_required;
    const confidence = (data.confidence_score * 100).toFixed(0);

    aiStatusBadge.className = isRequired ? 'badge bg-danger' : 'badge bg-success';
    aiStatusBadge.innerText = isRequired ? 'Mist Required' : 'Optimal';
    aiConfVal.innerText = `${confidence}%`;
    aiConfBar.style.width = `${confidence}%`;

  } catch (err) {
    aiStatusBadge.className = 'badge bg-secondary';
    aiStatusBadge.innerText = 'AI Offline';
    aiConfVal.innerText = '--%';
    aiConfBar.style.width = '0%';
  }
}

async function fetchLatestSensorData() {
  if (!supabase) {
    console.error("Fetch skipped: Supabase not initialized.");
    return;
  }
  console.log("Fetching latest sensor data from Supabase...");
  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.error("Supabase Select Error:", error);
      return;
    }

    console.log("Sensor data reply received:", data);

    if (data && data.length > 0) {
      const chartData = [...data].reverse();
      envChart.data.labels = [];
      envChart.data.datasets.forEach(ds => ds.data = []);

      chartData.forEach(row => {
        updateChart(row.timestamp, row.temperature, row.humidity, row.moisture);
      });

      const latest = data[0];
      valTemp.innerText = latest.temperature.toFixed(1);
      valHum.innerText = latest.humidity.toFixed(1);
      valMoist.innerText = latest.moisture.toFixed(1);
      valAir.innerText = latest.air_quality.toFixed(1);
      valLight.innerText = latest.light_intensity || 0;

      setGaugeProgress(fillTemp, latest.temperature, 50);
      setGaugeProgress(fillHum, latest.humidity, 100);
      setGaugeProgress(fillMoist, latest.moisture, 100);
      setGaugeProgress(fillAir, latest.air_quality, 100);
      setGaugeProgress(fillLight, latest.light_intensity || 0, 255);

      fetchAIPrediction(latest.temperature, latest.humidity, latest.moisture, latest.air_quality);
    } else {
      console.warn("Sensor data table is empty.");
    }
  } catch (err) {
    console.error("Fatal error in fetchLatestSensorData:", err);
  }
}

async function fetchLatestControlState() {
  if (!supabase) return;
  console.log("Fetching control state...");
  try {
    const { data, error } = await supabase
      .from('device_control')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
       console.error("Supabase Control Fetch Error:", error);
       return;
    }

    if (data && data.length > 0) {
      const state = data[0];
      uiState = {
        mode: state.mode || 'AUTO',
        mist_maker: state.mist_maker,
        cooling_fan: state.cooling_fan,
        light_intensity: state.light_intensity
      };
      syncUIWithState();
    }
  } catch (err) {
    console.error("Fatal error in fetchLatestControlState:", err);
  }
}

// ==========================================
// 5. Control UI Logic
// ==========================================
function syncUIWithState() {
  const isAuto = (uiState.mode === 'AUTO');
  modeToggle.checked = !isAuto;
  
  if (isAuto) {
    autoOverlay.classList.remove('hidden');
  } else {
    autoOverlay.classList.add('hidden');
  }

  updateToggleButton(btnMist, uiState.mist_maker);
  updateToggleButton(btnFan, uiState.cooling_fan);

  lightSlider.value = uiState.light_intensity;
  lightDisplay.innerText = `(${uiState.light_intensity})`;
  updateLightGlow(uiState.light_intensity);
}

function updateToggleButton(btnElement, isOn) {
  if (!btnElement) return;
  if (isOn) {
    btnElement.classList.replace('off', 'on');
    btnElement.innerText = 'ON';
  } else {
    btnElement.classList.replace('on', 'off');
    btnElement.innerText = 'OFF';
  }
}

function updateLightGlow(value) {
  if(!lightBulbIcon) return;
  const intensity = value / 255;
  if(value > 0) {
    lightBulbIcon.style.color = '#fcd34d';
    const shadowIntensity = Math.min(intensity * 20, 20);
    lightBulbIcon.style.filter = `drop-shadow(0 0 ${shadowIntensity}px rgba(252, 211, 77, 1))`;
  } else {
    lightBulbIcon.style.color = '';
    lightBulbIcon.style.filter = '';
  }
}

async function syncStateToDB() {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('device_control')
      .insert([uiState]);
    if (error) throw error;
    console.log("Device control synced.");
  } catch (err) {
    console.error("DB Update Error:", err);
  }
}

// ==========================================
// 6. Theme and Interaction
// ==========================================
themeToggleBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const isLight = rootElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    rootElement.removeAttribute('data-theme');
    themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    rootElement.setAttribute('data-theme', 'light');
    themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
});

autoOverlay.addEventListener('click', () => {
  uiState.mode = 'MANUAL';
  syncUIWithState();
  syncStateToDB();
});

modeToggle.addEventListener('change', (e) => {
  uiState.mode = e.target.checked ? 'MANUAL' : 'AUTO';
  syncUIWithState();
  syncStateToDB();
});

btnMist.addEventListener('click', () => {
  uiState.mist_maker = !uiState.mist_maker;
  updateToggleButton(btnMist, uiState.mist_maker);
  syncStateToDB();
});

btnFan.addEventListener('click', () => {
  uiState.cooling_fan = !uiState.cooling_fan;
  updateToggleButton(btnFan, uiState.cooling_fan);
  syncStateToDB();
});

lightSlider.addEventListener('input', (e) => {
  uiState.light_intensity = parseInt(e.target.value);
  lightDisplay.innerText = `(${uiState.light_intensity})`;
  updateLightGlow(uiState.light_intensity);
});

lightSlider.addEventListener('change', () => {
  syncStateToDB();
});

// ==========================================
// 7. Realtime Setup
// ==========================================
function setupRealtime() {
  if (!supabase) return;
  console.log("Setting up Supabase Realtime Channels...");
  
  const channel = supabase.channel('realtime_saffron')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, (payload) => {
      console.log("Realtime: New sensor data!", payload.new);
      const row = payload.new;
      valTemp.innerText = row.temperature.toFixed(1);
      valHum.innerText = row.humidity.toFixed(1);
      valMoist.innerText = row.moisture.toFixed(1);
      valAir.innerText = row.air_quality.toFixed(1);
      valLight.innerText = row.light_intensity || 0;

      setGaugeProgress(fillTemp, row.temperature, 50);
      setGaugeProgress(fillHum, row.humidity, 100);
      setGaugeProgress(fillMoist, row.moisture, 100);
      setGaugeProgress(fillAir, row.air_quality, 100);
      setGaugeProgress(fillLight, row.light_intensity || 0, 255);

      updateChart(row.timestamp, row.temperature, row.humidity, row.moisture);
      fetchAIPrediction(row.temperature, row.humidity, row.moisture, row.air_quality);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_control' }, (payload) => {
      console.log("Realtime: New control state!", payload.new);
      const state = payload.new;
      uiState = {
        mode: state.mode || 'AUTO',
        mist_maker: state.mist_maker,
        cooling_fan: state.cooling_fan,
        light_intensity: state.light_intensity
      };
      syncUIWithState();
    })
    .subscribe((status) => {
      console.log("Realtime Subscription Status:", status);
      setConnectionStatus(status === 'SUBSCRIBED');
    });
}

function setConnectionStatus(isConnected) {
  console.log(`Setting connection status: ${isConnected ? 'LIVE' : 'CONNECTING'}`);
  if (!connDot || !connStatus) return;
  connDot.className = isConnected ? 'dot connected' : 'dot error';
  connStatus.innerText = isConnected ? 'Connected Live' : 'Connecting...';
}

// ==========================================
// 8. Initialization
// ==========================================
function init() {
  console.log("Starting Initialization...");
  
  // Initialize Supabase
  try {
    if (window.supabase) {
      console.log("Supabase library found on window object.");
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
      });
      console.log("Supabase client created.");
    } else {
      console.error("Supabase library NOT found on window object. Check your script tags.");
    }
  } catch (err) {
    console.error("Supabase creation failed:", err);
  }

  initChart();
  
  if (supabase) {
    fetchLatestSensorData();
    fetchLatestControlState();
    setupRealtime();
  } else {
    console.error("Initialization halted: Supabase client is null.");
  }
}

// Robust execution
console.log("Checking document readyState:", document.readyState);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log("Document already ready, starting init immediately.");
    init();
} else {
    console.log("Waiting for DOMContentLoaded event.");
    document.addEventListener('DOMContentLoaded', init);
}


