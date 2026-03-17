from fastapi import APIRouter, File, UploadFile, HTTPException
from verification.duplicate_detector import DuplicateDetector
from verification.anomaly_detector import AnomalyDetector
from pydantic import BaseModel
from typing import List
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
duplicate_detector = DuplicateDetector()
anomaly_detector = AnomalyDetector()

class AnomalyRequest(BaseModel):
    history: List[float]
    current: float

@router.post("/api/verify/duplicate")
async def check_duplicate(file: UploadFile = File(...)):
    """
    Check if document is duplicate using perceptual hashing
    """
    try:
        contents = await file.read()
        result = duplicate_detector.check_duplicate(contents)
        return result
    except Exception as e:
        logger.error(f"Duplicate check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/verify/anomaly")
async def detect_anomaly(request: AnomalyRequest):
    """
    Detect anomalies in consumption patterns
    """
    try:
        # Use ensemble method for better accuracy
        result = anomaly_detector.detect_ensemble(request.history, request.current)
        return result
    except Exception as e:
        logger.error(f"Anomaly detection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
