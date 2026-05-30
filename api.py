from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
    allow_origins=["*"],
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

# Define the input data schema
class SensorData(BaseModel):
    temperature: float
    humidity: float
    soil_moisture: float
    air_quality: float

# Define the prediction endpoint
@app.post("/predict_mist")
async def predict_mist_requirement(data: SensorData):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    try:
        input_df = pd.DataFrame([data.dict()])
        prediction = model.predict(input_df)[0]
        probabilities = model.predict_proba(input_df)[0]
        confidence = float(max(probabilities))
        return {
            "prediction_status": "success",
            "mist_required": bool(prediction == 1),
            "confidence_score": round(confidence, 4)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Root endpoint – serves the dashboard UI
@app.get("/")
async def serve_dashboard():
    index_path = os.path.join(os.getcwd(), "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "index.html not found"}

# Explicit routes for common assets with correct MIME types
@app.get("/style.css")
async def serve_css():
    return FileResponse("style.css", media_type="text/css")

@app.get("/app.js")
async def serve_js():
    return FileResponse("app.js", media_type="application/javascript")

# Mount static files just in case
@app.get("/dashboard_app.js")
async def serve_dashboard_js():
    return FileResponse("dashboard_app.js", media_type="application/javascript")

app.mount("/static", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
