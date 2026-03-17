from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from datetime import datetime
from routes.ocr import router as ocr_router
from routes.verify import router as verify_router
from routes.tamper import router as tamper_router
from routes.fraud import router as fraud_router
from routes.source import router as source_router

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
