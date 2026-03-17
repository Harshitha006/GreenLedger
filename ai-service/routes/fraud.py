from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
from fraud.ensemble_detector import get_fraud_detector
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
fraud_detector = get_fraud_detector()

class FraudRequest(BaseModel):
    tamper_score: float = 0
    metadata_risk: float = 0
    z_score: float = 0
    trend_deviation: float = 0
    user_history_length: int = 0
    previous_fraud_count: int = 0
    submission_hour: int = 0
    is_weekend: bool = False
    claimed_value: float = 0
    has_qr: bool = False
    proof_count: int = 1
    action_type: str = "electricity"
    time_since_last_action: float = 24
    avg_claim_value: float = 0

@router.post("/api/fraud/analyze")
async def analyze_fraud(request: FraudRequest):
    """
    Ensemble fraud detection analysis
    """
    try:
        # Convert request to dict
        data = request.model_dump()
        
        # Run ensemble prediction
        result = fraud_detector.ensemble_predict(data)
        
        return result
        
    except Exception as e:
        logger.error(f"Fraud analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/fraud/batch-analyze")
async def batch_analyze(requests: List[FraudRequest]):
    """
    Batch fraud detection for multiple actions
    """
    try:
        results = []
        for req in requests:
            data = req.model_dump()
            result = fraud_detector.ensemble_predict(data)
            results.append(result)
        
        return {
            'results': results,
            'count': len(results),
            'high_risk_count': sum(1 for r in results if r.get('risk_level') == 'HIGH')
        }
        
    except Exception as e:
        logger.error(f"Batch fraud analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
