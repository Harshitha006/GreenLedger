from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from datetime import datetime
from routes.ocr import router as ocr_router
from routes.verify import router as verify_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GreenLedger AI Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr_router)
app.include_router(verify_router)

from routes.tamper import router as tamper_router
from routes.fraud import router as fraud_router
from routes.source import router as source_router

app.include_router(tamper_router)
app.include_router(fraud_router)
app.include_router(source_router)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "GreenLedger AI",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/fraud/analyze")
async def analyze_fraud(data: dict):
    """
    Ensemble fraud detection
    """
    try:
        # TODO: Implement XGBoost/Random Forest ensemble
        # This will use scikit-learn and xgboost
        
        return {
            "fraud_probability": 0.12,
            "risk_level": "LOW",
            "factors": ["normal_pattern", "consistent_history"]
        }
    except Exception as e:
        logger.error(f"Fraud analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
