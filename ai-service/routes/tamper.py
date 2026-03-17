from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from verification.tamper_detector import TamperDetector
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
tamper_detector = TamperDetector()

class TamperRequest(BaseModel):
    image_url: str

@router.post("/api/verify/tamper")
async def detect_tampering(request: TamperRequest):
    """
    Detect tampering in document images
    """
    try:
        result = tamper_detector.analyze_tampering(request.image_url)
        return result
    except Exception as e:
        logger.error(f"Tamper detection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
