from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import uvicorn
import os

# Initialize FastAPI App
app = FastAPI(
    title="Saffron Smart Farming API",
    description="Machine learning API for predicting device control requirements in saffron cultivation",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your frontend's exact origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model at startup
MODEL_PATH = "saffron_mist_model.joblib"
try:
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print(f"Model loaded successfully from {MODEL_PATH}")
    else:
        model = None
        print(f"WARNING: Model file {MODEL_PATH} not found. Please run train_model.py first.")
except Exception as e:
    model = None
    print(f"Error loading model: {e}")

# Define the input data schema using Pydantic
class SensorData(BaseModel):
    temperature: float
    humidity: float
    soil_moisture: float
    air_quality: float

    # Provide an example for the Swagger documentation (/docs)
    class Config:
        json_schema_extra = {
            "example": {
                "temperature": 22.5,
                "humidity": 40.0,
                "soil_moisture": 25.0,
                "air_quality": 85.0
            }
        }

# Define the prediction endpoint
@app.post("/predict_mist")
async def predict_mist_requirement(data: SensorData):
    """
    Takes sensor readings and predicts whether the mist maker should be turned on.
    Returns {"mist_required": True/False, "confidence": float}
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Machine learning model is not loaded. Train the model first.")

    try:
        # Convert input data to the format expected by the model (DataFrame)
        input_df = pd.DataFrame([{
            'temperature': data.temperature,
            'humidity': data.humidity,
            'soil_moisture': data.soil_moisture,
            'air_quality': data.air_quality
        }])

        # Make prediction
        prediction = model.predict(input_df)[0]
        
        # Get prediction probabilities (confidence score)
        probabilities = model.predict_proba(input_df)[0]
        confidence = float(max(probabilities))

        # Convert numpy int to Python bool
        is_required = bool(prediction == 1)

        return {
            "prediction_status": "success",
            "mist_required": is_required,
            "confidence_score": round(confidence, 4),
            "inputs_received": data.dict()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# Root endpoint for health check
@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Saffron Smart Farming ML API",
        "model_loaded": model is not None
    }

if __name__ == "__main__":
    # Run the server on port 8000
    print("Starting Saffron ML API Server...")
    print("Documentation available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
