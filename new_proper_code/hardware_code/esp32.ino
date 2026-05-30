#include<Adafruit_GFX.h>
#include<Adafruit_SH110X.h>
#include <Wire.h>

#include<DHT.h>

#include<BH1750.h>
BH1750 lightMeter;

// Add the Wifi Feature
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ===== *** Supabase Configuration *** =====
// REPLACE THESE with your Supabase Project settings
const char* supabase_url = "https://jhgnrbujsggsllzkgsfb.supabase.co"; 
const char* supabase_key = "sb_publishable_RnCtzZEfz-BYwDZ7_X73iw_Q_hdk44_"; 

unsigned long lastSensorUpdate = 0;
unsigned long lastActuatorCheck = 0;

WiFiManager wm;

// FOR MQ135 and mosfet
#define RXD2 16
#define TXD2 17
int CO2 = 0;  // Global variable

// For OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define i2C_Address 0x3C
#define OLED_RESET -1
Adafruit_SH1106G display(SCREEN_WIDTH,SCREEN_HEIGHT,&Wire,OLED_RESET);

// ===== **DHT22 Requirments** ====
#define DHTTYPE DHT22
const int pin = 4;
DHT dht(pin,DHTTYPE);

// =====** Moisture Requirments **=======
const int moisturePin = 34;
const int dryValue = 0;
const int wetValue = 4095;

// ====== *** Pwm value to control the MOSFET That come from app ****========
int pwmValue = 120; // Example value (can come from app)

// ===== *** Relay Pin Configuration *** =====
int relay1 = 23;
int relay2 = 19;
int relay3 = 18;
int relay4 = 5;

//Store the last reconnect time 
unsigned long lastReconnect = 0;
//Store the last portal time 
unsigned long lastPortalTry = 0;
bool portalRunning = false;

void setup(){
  Serial.begin(115200);

// =========== **** Setup Oled **** ===========
  if(!display.begin(i2C_Address,true)){
    Serial.println("OLED Not Found.");
  while(1);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

// ======= ***WiFiManager Setup*** =======
 Serial.println("\n Starting Smart WiFi System...");
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.setSleep(false);

  wm.setDebugOutput(true);
  wm.setConfigPortalTimeout(180);

  Serial.println(" Trying Saved WiFi...");
  
  display.clearDisplay();
  display.setCursor(0,10);
  display.println("WiFi Starting...");
  display.display();
  delay(1000);

bool res = wm.autoConnect("ESP32_Setup", "saffron2026");

    if (res) {
      Serial.println("Connected!");

      display.clearDisplay();
      display.setCursor(0,10);
      display.println("WiFi Connected!\n");
      display.print("IP : ");
      display.println(WiFi.localIP());
      display.print("RSSI : ");
      display.print(WiFi.RSSI());
      display.println(" dBm");
      display.display();
      delay(4000);

    } else {
      Serial.println("❌ Opening Portal...");

      display.clearDisplay();
      display.setCursor(0,10);
      display.println("Open WiFi Setup");
      display.println("SSID: ESP32_Setup");
      display.display();

      wm.startConfigPortal("ESP32_Setup", "saffron2026");
    }
    
// Start DHT
    dht.begin(); 

// =========== **** Setup UART for Arduino UNO **** ===========
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
  Serial2.setTimeout(50); // 🔹 Stop ESP32 from freezing on bad reads

// =========== **** Setup BH1750 **** ===========
  Wire.begin(21, 22);

  if (lightMeter.begin()) {
    Serial.println("BH1750 Initialized Successfully");
  } else {
    Serial.println("Error Initializing BH1750");
  }
// ====== *** Set The Digital Pin For Relay Output*** ======
  pinMode(relay1, OUTPUT);
  pinMode(relay2, OUTPUT);
  pinMode(relay3, OUTPUT);
  pinMode(relay4, OUTPUT);

    // Turn OFF all relays initially 
  digitalWrite(relay1, HIGH);
  digitalWrite(relay2, HIGH);
  digitalWrite(relay3, HIGH);
  digitalWrite(relay4, HIGH);

}



void loop(){

    wl_status_t status = WiFi.status();
    static int failCount = 0;
    static bool shown = false;

    //  Connected
    if (status == WL_CONNECTED) {

      if (!shown) {
        Serial.println("WiFi Connected");

        display.clearDisplay();
        display.setCursor(0,10);
        display.println("WiFi Connected!\n");
        display.print("IP : ");
        display.println(WiFi.localIP());
        display.print("RSSI : ");
        display.print(WiFi.RSSI());
        display.println(" dBm"); 
        display.display();

        delay(3000);   // better visibility
        shown = true;
      }
      failCount = 0;
    }

    //  Disconnected
    else {
      shown = false;

      display.clearDisplay();
      display.setCursor(0,0);
      display.println("WiFi Lost...");
      display.display();

      if (millis() - lastReconnect > 15000) {
        Serial.println("🔄 Reconnecting...");
        WiFi.reconnect();
        lastReconnect = millis();
        failCount++;
      }

      if (failCount > 5) {
        display.clearDisplay();
        display.setCursor(0,0);
        display.println("Reconnect Failed");
        display.println("Setup WiFi");
        display.display();

        wm.startConfigPortal("ESP32_Setup", "saffron2026");

        delay(2000);
        failCount = 0;
      }
    }

// ========= *****DHT22 Read value and Print the Serial Monitor*****=========
  float humidity=dht.readHumidity();
  float temperature=dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT22 Sensor Error!");

  }

// =============== *****Moisture sensore read value and Print the Serial Monitor*****===============
  int moistureSensorValue = analogRead(moisturePin);
  int moisturePercent=map(moistureSensorValue,wetValue,dryValue,0,100);
  moisturePercent=constrain(moisturePercent,0,100);
  
  // if (moistureSensorValue == 0) {
  //   Serial.printf("❌ ERROR: Moisture Sensor short or fully wet!\n");
  // }
  // else if(moistureSensorValue >= 4090) {
  //   Serial.printf("⚠️ WARNING: Moisture Sensor disconnected or dry air!\n");
  // }

// =============== ****Send the pwm Value for Arduino UNO****===============
  Serial2.println(pwmValue);


// ======== **** Receive MQ135 value ****=======
  if (Serial2.available()) {
    String data = Serial2.readStringUntil('\n');
    data.trim(); // 🔹 REMOVES invisible \r characters! This is crucial for OLEDs.

    if (data.startsWith("CO2:") ) { 
      CO2 = data.substring(4).toInt();

    }
  }

// ======== **** Receive BH1750 value ****=========
    int lux = lightMeter.readLightLevel();

// ======== **** Supabase Communication ****=========
    if (status == WL_CONNECTED) {
      WiFiClientSecure client;
      client.setInsecure(); // Trust certificates to avoid expiration issues
      HTTPClient http;

      // 1. Send Sensor Data (every 5 seconds)
      if (millis() - lastSensorUpdate > 5000) {
        String url = String(supabase_url) + "/rest/v1/sensor_data";
        http.begin(client, url);
        http.addHeader("apikey", supabase_key);
        http.addHeader("Authorization", String("Bearer ") + supabase_key);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Prefer", "return=minimal");

        String payload = "{\"temperature\":" + String(temperature) + 
                         ",\"humidity\":" + String(humidity) + 
                         ",\"moisture\":" + String(moisturePercent) + 
                         ",\"co2\":" + String(CO2) + 
                         ",\"light\":" + String(lux) + "}";
        
        int httpResponseCode = http.POST(payload);
        Serial.print("Supabase Sensor POST Response: ");
        Serial.println(httpResponseCode);
        http.end();
        lastSensorUpdate = millis();
      }

      // 2. Get Actuator Commands (every 2 seconds)
      if (millis() - lastActuatorCheck > 2000) {
        String url = String(supabase_url) + "/rest/v1/actuators?id=eq.1&select=*";
        http.begin(client, url);
        http.addHeader("apikey", supabase_key);
        http.addHeader("Authorization", String("Bearer ") + supabase_key);

        int httpResponseCode = http.GET();
        if (httpResponseCode == 200) {
          String response = http.getString();
          
          StaticJsonDocument<512> doc;
          DeserializationError error = deserializeJson(doc, response);

          if (!error && doc.size() > 0) {
            bool mist = doc[0]["mist_maker"];
            bool fan = doc[0]["cooling_fan"];
            bool r3 = doc[0]["relay3"];
            bool r4 = doc[0]["relay4"];
            pwmValue = doc[0]["grow_light_pwm"];

            // Relays are active LOW (LOW = ON, HIGH = OFF)
            digitalWrite(relay1, mist ? LOW : HIGH);
            digitalWrite(relay2, fan ? LOW : HIGH);
            digitalWrite(relay3, r3 ? LOW : HIGH);
            digitalWrite(relay4, r4 ? LOW : HIGH);
            
            Serial.println("Actuators Updated from Supabase!");
          }
        }
        http.end();
        lastActuatorCheck = millis();
      }
    }
      
//  ===== ***Serial Monitor Code*** =======
  float feel_like = dht.computeHeatIndex(temperature, humidity, false);
  Serial.printf("Temperature : %.2f C | Humidity : %.2f % => Feels Like : %.2f C\n",temperature, humidity, feel_like);
  Serial.printf("Moisture : %d %\n",moisturePercent);
  Serial.printf("CO2 : %d \n",CO2);
  Serial.printf("Light: %d lx\n", lux);

// =========== *** OLED Display Show the DHT22 Value *** ===========
  display.clearDisplay();
  display.setCursor(0,10);
  display.printf("Temperature : %.1f ",temperature);
  // Draw degree symbol near temperature value
  display.drawCircle(116, 12, 2, SH110X_WHITE);
  display.println(" C");

  display.setCursor(0,20);
  display.printf("Humidity : %.2f %%\n",humidity);

  display.setCursor(0,30);
  display.printf("Moisture : %d %%\n",moisturePercent);

  display.setCursor(0,40);
  display.printf("CO2 : %d ppm \n",CO2);

  display.setCursor(0,50);
  display.printf("Light : %d lx \n",lux);

  display.display();

delay(1000);
}