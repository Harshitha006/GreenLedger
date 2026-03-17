from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from verification.source_validator import get_source_validator
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
source_validator = get_source_validator()

class QRValidationRequest(BaseModel):
    qr_data: Dict[str, Any]

class APIValidationRequest(BaseModel):
    type: str
    consumer_number: Optional[str] = None
    bill_number: Optional[str] = None
    transaction_id: Optional[str] = None

@router.post("/api/validate/qr")
async def validate_qr(request: QRValidationRequest):
    """
    Validate QR code data
    """
    try:
        result = source_validator.validate_qr(request.qr_data)
        return result
    except Exception as e:
        logger.error(f"QR validation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/validate/api")
async def validate_api(request: APIValidationRequest):
    """
    Validate via API call
    """
    try:
        data = request.model_dump()
        result = source_validator.validate_api(data)
        return result
    except Exception as e:
        logger.error(f"API validation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
