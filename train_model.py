import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib

# ==========================================
# 1. Dataset Generation & Loading
# ==========================================
# For demonstration, we generate a synthetic dataset for Saffron framing.
# Saffron prefers: Temp (15-20°C growing, up to 25°C), Humy (40-60%), Moisture (well drained, low-mid), Air (good).
def generate_synthetic_data(num_samples=1000):
    np.random.seed(42)
    
    # Input Features
    temperature = np.random.uniform(10.0, 35.0, num_samples) # 10C to 35C
    humidity = np.random.uniform(20.0, 90.0, num_samples)    # 20% to 90%
    moisture = np.random.uniform(10.0, 80.0, num_samples)    # 10% to 80%
    air_quality = np.random.uniform(0.0, 100.0, num_samples) # 0 to 100 AQI
    
    # Target Logic (Mist Required)
    # Turn on mist if humidity is too low (< 45%) OR soil moisture is too low (< 30%)
    # Adding some noise to make it a realistic ML problem
    mist_required = []
    for t, h, m, a in zip(temperature, humidity, moisture, air_quality):
        # Base logic
        needs_mist = (h < 45.0) or (m < 30.0) 
        
        # Add 5% random noise
        if np.random.rand() < 0.05:
            needs_mist = not needs_mist
            
        mist_required.append(int(needs_mist))
        
    df = pd.DataFrame({
        'temperature': temperature,
        'humidity': humidity,
        'soil_moisture': moisture,
        'air_quality': air_quality,
        'mist_required': mist_required
    })
    
    # Save to CSV (optional, just to show we 'loaded' it)
    df.to_csv('saffron_data.csv', index=False)
    return df

print("Generating/Loading dataset...")
df = generate_synthetic_data()

# Load dataset (Simulating step 1)
df = pd.read_csv('saffron_data.csv')

# Prepare features (X) and target (y)
X = df[['temperature', 'humidity', 'soil_moisture', 'air_quality']]
y = df['mist_required']

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# ==========================================
# 2. Train Model
# ==========================================
print("Training RandomForest model...")
model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
model.fit(X_train, y_train)

# Evaluate the model
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"Model trained successfully! Accuracy: {accuracy * 100:.2f}%")

# ==========================================
# 3. Save Model using Joblib
# ==========================================
model_filename = "saffron_mist_model.joblib"
joblib.dump(model, model_filename)
print(f"Model saved to {model_filename}")
