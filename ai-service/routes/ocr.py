from fastapi import APIRouter, File, UploadFile, HTTPException
from ocr.electricity_bill_ocr import ElectricityBillOCR
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
ocr_processor = ElectricityBillOCR()

@router.post("/api/ocr/electricity-bill")
async def ocr_electricity_bill(file: UploadFile = File(...)):
    """
    Extract data from electricity bill images
    """
    try:
        # Read image
        contents = await file.read()
        
        # Process bill
        result = ocr_processor.process_bill(contents)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=500, detail=result['error'])
            
    except Exception as e:
        logger.error(f"OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
