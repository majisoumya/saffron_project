import requests
import json
import time

# --- Supabase Config (from your app.js) ---
SUPABASE_URL = 'https://xfpjcpzqeaonidyymqas.supabase.co/rest/v1/sensor_data'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcGpjcHpxZWFvbmlkeXltcWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTIzODEsImV4cCI6MjA4ODcyODM4MX0.VKxnxzYxsRG-0ONaN4HigNyApTuVAKaEr8AHb8x2NY8'

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def simulate_esp32_pulse(temp, hum, moist, air):
    payload = {
        "temperature": temp,
        "humidity": hum,
        "moisture": moist,
        "air_quality": air,
        "light_intensity": 150 # Simulated reading
    }
    
    print(f"Sending test data: {payload}...")
    try:
        response = requests.post(SUPABASE_URL, headers=headers, data=json.dumps(payload))
        if response.status_code in [200, 201]:
            print("Successfully sent data to Supabase!")
            print("Check your dashboard index.html to see it update live!")
        else:
            print(f"Error: Received status code {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    # Simulate a few data points
    print("Simulating ESP32 activity for Saffron Dashboard...")
    simulate_esp32_pulse(22.5, 45.0, 35.0, 90.0)
    time.sleep(2)
    simulate_esp32_pulse(23.1, 44.5, 34.2, 88.0)
