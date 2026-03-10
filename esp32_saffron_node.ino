#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h> // Highly recommended for JSON parsing/creation

// --- WiFi Credentials ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- Supabase Config ---
const char* supabase_url = "https://xfpjcpzqeaonidyymqas.supabase.co/rest/v1";
const char* supabase_anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcGpjcHpxZWFvbmlkeXltcWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTIzODEsImV4cCI6MjA4ODcyODM4MX0.VKxnxzYxsRG-0ONaN4HigNyApTuVAKaEr8AHb8x2NY8";

// --- Pin Definitions ---
// Sensors
#define DHTPIN 4
#define DHTTYPE DHT22
#define SOIL_MOISTURE_PIN 34
#define MQ135_PIN 35

// Actuators
#define MIST_MAKER_PIN 18
#define COOLING_FAN_PIN 19
#define LIGHT_MOSFET_PIN 21

// --- Objects ---
DHT dht(DHTPIN, DHTTYPE);

// --- Global Variables ---
unsigned long lastReadTime = 0;
const unsigned long readInterval = 5000; // 5 seconds

// Control states
bool autoMode = true; // Default to AUTO mode
bool mistMakerState = false;
bool coolingFanState = false;
int lightIntensity = 0;

void setup() {
  Serial.begin(115200);

  // Initialize pins
  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
  
  pinMode(MIST_MAKER_PIN, OUTPUT);
  pinMode(COOLING_FAN_PIN, OUTPUT);
  
  // For ESP32, using ledc library for PWM is recommended, 
  // but analogWrite is supported in newer ESP32 Arduino Core versions (3.x)
  pinMode(LIGHT_MOSFET_PIN, OUTPUT);

  // Initial state (OFF)
  digitalWrite(MIST_MAKER_PIN, LOW);
  digitalWrite(COOLING_FAN_PIN, LOW);
  analogWrite(LIGHT_MOSFET_PIN, 0);

  // Initialize DHT
  dht.begin();

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Execute every 5 seconds
  if (millis() - lastReadTime >= readInterval) {
    lastReadTime = millis();
    
    // ==========================================
    // 1. Read Sensors
    // ==========================================
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    
    // Check if DHT reads failed
    if (isnan(temp) || isnan(hum)) {
      Serial.println("Failed to read from DHT sensor!");
      temp = 0.0;
      hum = 0.0;
    }

    // Read analog sensors (0-4095 on ESP32)
    int rawMoisture = analogRead(SOIL_MOISTURE_PIN);
    // Convert to percentage (Note: 4095 is dry, 0 is wet for typical capacitive sensors)
    float moisture_percent = map(rawMoisture, 4095, 0, 0, 100); 

    int rawAirQuality = analogRead(MQ135_PIN);
    // MQ135 requires calibration for PPM. We use raw analog values scaled 0-100 for simplicity here.
    float airQuality = map(rawAirQuality, 0, 4095, 0, 100);

    Serial.println("--- Sensor Readings ---");
    Serial.printf("Temp: %.2f C | Hum: %.2f %% | Moisture: %.2f %% | Air Q: %.2f\n", temp, hum, moisture_percent, airQuality);

    // ==========================================
    // 2. Fetch Control Commands (GET)
    // ==========================================
    fetchDeviceControl();

    // ==========================================
    // 3. Process Control Logic
    // ==========================================
    if (autoMode) {
      Serial.println("Mode: AUTO");
      
      // AUTO MODE LOGIC
      // If humidity < 70 or moisture < 50, turn on mist maker
      if (hum < 70.0 || moisture_percent < 50.0) {
        mistMakerState = true;
      } else {
        mistMakerState = false;
      }

      // If temperature > 24 turn on cooling fan
      if (temp > 24.0) {
        coolingFanState = true;
      } else {
        coolingFanState = false;
      }
      
      // Note: We leave light intensity unchanged in AUTO mode unless you specify logic for it
    } else {
      Serial.println("Mode: MANUAL (Following DB Commands)");
    }

    // Actuate hardware
    digitalWrite(MIST_MAKER_PIN, mistMakerState ? HIGH : LOW);
    digitalWrite(COOLING_FAN_PIN, coolingFanState ? HIGH : LOW);
    analogWrite(LIGHT_MOSFET_PIN, lightIntensity); // 0-255 for 8-bit PWM

    // ==========================================
    // 4. Send Data to Supabase (POST)
    // ==========================================
    sendSensorData(temp, hum, moisture_percent, airQuality, lightIntensity);
  }
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
}

void fetchDeviceControl() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    // Fetch latest command, ordered by timestamp descending, limit to 1 row
    String url = String(supabase_url) + "/device_control?select=*&order=timestamp.desc&limit=1";
    
    http.begin(url);
    http.addHeader("apikey", supabase_anon_key);
    http.addHeader("Authorization", String("Bearer ") + supabase_anon_key);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      
      // Expected Response: [{"id":"...", "mist_maker":true, "cooling_fan":false, "light_intensity":128, "mode":"AUTO", ...}]
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, response);
      
      if (!error && doc.size() > 0) {
        JsonObject data = doc[0];
        
        String modeStr = data["mode"].as<String>();
        if (modeStr == "AUTO") {
          autoMode = true;
        } else if (modeStr == "MANUAL") {
          autoMode = false;
          // In manual mode, we update our actuator states from DB commands
          mistMakerState = data["mist_maker"].as<bool>();
          coolingFanState = data["cooling_fan"].as<bool>();
          // Safety check (ensure 0-255 range for PWM)
          int dbLight = data["light_intensity"].as<int>();
          lightIntensity = constrain(dbLight, 0, 255); 
        }
      }
    } else {
      Serial.print("Error on HTTP Request (GET Control): ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}

void sendSensorData(float temp, float hum, float moisture, float air, int light) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(supabase_url) + "/sensor_data";
    
    http.begin(url);
    http.addHeader("apikey", supabase_anon_key);
    http.addHeader("Authorization", String("Bearer ") + supabase_anon_key);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Prefer", "return=minimal"); // Telling Supabase we don't need the resulting rows sent back
    
    // Create JSON payload
    DynamicJsonDocument doc(512);
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["moisture"] = moisture;
    doc["air_quality"] = air;
    doc["light_intensity"] = light; // Send current light level
    
    String requestBody;
    serializeJson(doc, requestBody);
    
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      Serial.print("Sensor data sent. HTTP Response: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error sending sensor data: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}
