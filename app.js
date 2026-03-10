// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND ANON KEY
const SUPABASE_URL = 'https://xfpjcpzqeaonidyymqas.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcGpjcHpxZWFvbmlkeXltcWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTIzODEsImV4cCI6MjA4ODcyODM4MX0.VKxnxzYxsRG-0ONaN4HigNyApTuVAKaEr8AHb8x2NY8';

// Import initialized Supabase client directly from the global script object injected via script tag.
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. DOM Elements
// ==========================================
const connDot = document.getElementById('connection-dot');
const connStatus = document.getElementById('connection-status');

// Metrics (SVG Fills)
const fillTemp = document.querySelector('.temp-fill');
const fillHum = document.querySelector('.hum-fill');
const fillMoist = document.querySelector('.moist-fill');
const fillAir = document.querySelector('.air-fill');
const fillLight = document.querySelector('.light-fill');

// Metrics (Values)
const valTemp = document.getElementById('val-temp');
const valHum = document.getElementById('val-hum');
const valMoist = document.getElementById('val-moist');
const valAir = document.getElementById('val-air');
const valLight = document.getElementById('val-light');

// Helper to set SVG gauge progress (0 to 1 scaling)
// Our SVG dasharray is ~141.37 for a half circle (pi * r), but set to 200 in CSS for simplicity
// The actual stroke length for A 45 45 is Math.PI * 45 = 141.37
const GAUGE_LENGTH = 142;

function setGaugeProgress(element, value, max) {
  if (!element) return;
  // clamp value
  let pct = Math.min(Math.max(value / max, 0), 1);
  // calculate offset (142 is empty, 0 is full)
  let offset = GAUGE_LENGTH - (pct * GAUGE_LENGTH);
  element.style.strokeDasharray = GAUGE_LENGTH;
  element.style.strokeDashoffset = offset;
}

// Controls
const modeToggle = document.getElementById('mode-toggle');
const btnMist = document.getElementById('btn-mist');
const btnFan = document.getElementById('btn-fan');
const lightSlider = document.getElementById('light-slider');
const lightDisplay = document.getElementById('light-val-display');
const autoOverlay = document.getElementById('auto-overlay');

// Local State
let uiState = {
  mode: 'AUTO', // default
  mist_maker: false,
  cooling_fan: false,
  light_intensity: 0
};

// ==========================================
// 3. Chart.js Setup
// ==========================================
const ctx = document.getElementById('envChart').getContext('2d');
let envChart;
const maxDataPoints = 20; // Keep chart clean

function initChart() {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = 'Inter';

  envChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          data: [],
          tension: 0.4,
          fill: true
        },
        {
          label: 'Humidity (%)',
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          data: [],
          tension: 0.4,
          fill: true
        },
        {
          label: 'Soil Moisture (%)',
          borderColor: '#10b981',
          data: [],
          tension: 0.4,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: { grid: { color: '#334155' } },
        y: { grid: { color: '#334155' }, beginAtZero: true }
      },
      interaction: {
        mode: 'index',
        intersect: false,
      }
    }
  });
}

function updateChart(timestamp, temp, hum, moist) {
  const timeLabel = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  envChart.data.labels.push(timeLabel);
  envChart.data.datasets[0].data.push(temp);
  envChart.data.datasets[1].data.push(hum);
  envChart.data.datasets[2].data.push(moist);

  // Keep array within max limits
  if (envChart.data.labels.length > maxDataPoints) {
    envChart.data.labels.shift();
    envChart.data.datasets[0].data.shift();
    envChart.data.datasets[1].data.shift();
    envChart.data.datasets[2].data.shift();
  }

  envChart.update();
}

// ==========================================
// 4. Supabase Data Fetching
// ==========================================
async function fetchLatestSensorData() {
  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10); // Fetch last 10 points to populate chart initially

    if (error) throw error;

    if (data && data.length > 0) {
      // Data is descending. For chart, we want oldest first (ascending)
      const chartData = [...data].reverse();

      // Clear existing chart data before rendering history
      envChart.data.labels = [];
      envChart.data.datasets.forEach(ds => ds.data = []);

      chartData.forEach(row => {
        updateChart(row.timestamp, row.temperature, row.humidity, row.moisture);
      });

      // Update Top Metrics with the most recent row (data[0])
      const latest = data[0];
      valTemp.innerText = latest.temperature.toFixed(1);
      valHum.innerText = latest.humidity.toFixed(1);
      valMoist.innerText = latest.moisture.toFixed(1);
      valAir.innerText = latest.air_quality.toFixed(1);
      valLight.innerText = latest.light_intensity;

      // Animate Gauges (setting max values for scaling)
      setGaugeProgress(fillTemp, latest.temperature, 50); // Max temp 50C
      setGaugeProgress(fillHum, latest.humidity, 100);    // Max hum 100%
      setGaugeProgress(fillMoist, latest.moisture, 100);  // Max moist 100%
      setGaugeProgress(fillAir, latest.air_quality, 100); // Assuming mapped 0-100
      setGaugeProgress(fillLight, latest.light_intensity, 255); // PWM max 255

      setConnectionStatus(true);
    }
  } catch (err) {
    console.error("Error fetching sensor data:", err);
    setConnectionStatus(false);
  }
}

async function fetchLatestControlState() {
  try {
    const { data, error } = await supabase
      .from('device_control')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const state = data[0];

      // Update local state
      uiState = {
        mode: state.mode,
        mist_maker: state.mist_maker,
        cooling_fan: state.cooling_fan,
        light_intensity: state.light_intensity
      };

      // Update UI
      syncUIWithState();
    }
  } catch (err) {
    console.error("Error fetching control state:", err);
  }
}

// ==========================================
// 5. Control UI Logic
// ==========================================
function syncUIWithState() {
  // Mode switch
  const isAuto = (uiState.mode === 'AUTO');
  modeToggle.checked = !isAuto; // Checkbox checked = MANUAL based on our UI label

  if (isAuto) {
    autoOverlay.classList.remove('hidden');
  } else {
    autoOverlay.classList.add('hidden');
  }

  // Buttons
  updateToggleButton(btnMist, uiState.mist_maker);
  updateToggleButton(btnFan, uiState.cooling_fan);

  // Slider
  lightSlider.value = uiState.light_intensity;
  lightDisplay.innerText = `(${uiState.light_intensity})`;
}

function updateToggleButton(btnElement, isOn) {
  if (isOn) {
    btnElement.classList.replace('off', 'on');
    btnElement.innerText = 'ON';
  } else {
    btnElement.classList.replace('on', 'off');
    btnElement.innerText = 'OFF';
  }
}

// Event Listeners for pure UI updates (doesn't hit DB yet)
modeToggle.addEventListener('change', (e) => {
  uiState.mode = e.target.checked ? 'MANUAL' : 'AUTO';
  if (!e.target.checked) {
    autoOverlay.classList.remove('hidden');
  } else {
    autoOverlay.classList.add('hidden');
  }
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
});

lightSlider.addEventListener('change', () => {
  syncStateToDB();
});

// Write to DB instantly
async function syncStateToDB() {
  try {
    const { error } = await supabase
      .from('device_control')
      .insert([
        {
          mode: uiState.mode,
          mist_maker: uiState.mist_maker,
          cooling_fan: uiState.cooling_fan,
          light_intensity: uiState.light_intensity
        }
      ]);

    if (error) throw error;
    console.log("State synced to Supabase successfully.");
  } catch (err) {
    console.error("DB Update Error", err);
    alert("Failed to sync device controls. If using Anon key, please ensure RLS allows anonymous inserts in Supabase.");
  }
}

// ==========================================
// 6. Real-time Subscriptions (WebSockets)
// ==========================================
function setupRealtime() {
  const channel = supabase.channel('table-db-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, (payload) => {
      // New sensor logic arrived
      const newRow = payload.new;

      // Update Top Metrics UI
      valTemp.innerText = newRow.temperature.toFixed(1);
      valHum.innerText = newRow.humidity.toFixed(1);
      valMoist.innerText = newRow.moisture.toFixed(1);
      valAir.innerText = newRow.air_quality.toFixed(1);
      valLight.innerText = newRow.light_intensity;

      // Animate Gauges
      setGaugeProgress(fillTemp, newRow.temperature, 50);
      setGaugeProgress(fillHum, newRow.humidity, 100);
      setGaugeProgress(fillMoist, newRow.moisture, 100);
      setGaugeProgress(fillAir, newRow.air_quality, 100);
      setGaugeProgress(fillLight, newRow.light_intensity, 255);

      // Add to Chart
      updateChart(newRow.timestamp, newRow.temperature, newRow.humidity, newRow.moisture);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_control' }, (payload) => {
      // Update UI if a change was made elsewhere (e.g. by another dashboard user)
      const state = payload.new;

      uiState = {
        mode: state.mode,
        mist_maker: state.mist_maker,
        cooling_fan: state.cooling_fan,
        light_intensity: state.light_intensity
      };

      syncUIWithState();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus(true);
      }
    });
}

function setConnectionStatus(isConnected) {
  if (isConnected) {
    connDot.className = 'dot connected';
    connStatus.innerText = 'Connected Live';
  } else {
    connDot.className = 'dot error';
    connStatus.innerText = 'Disconnected';
  }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initChart();
  fetchLatestSensorData();
  fetchLatestControlState();
  setupRealtime();
});
