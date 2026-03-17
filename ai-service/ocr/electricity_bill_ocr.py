import pytesseract
import cv2
import numpy as np
import re
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

class ElectricityBillOCR:
    def __init__(self):
        # Configure tesseract path if needed
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass
    
    def preprocess_image(self, image_bytes):
        """Preprocess image for better OCR accuracy"""
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Could not decode image")
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Denoise
            denoised = cv2.fastNlMeansDenoising(gray, h=30)
            
            # Thresholding
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Deskew
            coords = np.column_stack(np.where(thresh > 0))
            angle = cv2.minAreaRect(coords)[-1]
            
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
                
            (h, w) = thresh.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(thresh, M, (w, h),
                                      flags=cv2.INTER_CUBIC,
                                      borderMode=cv2.BORDER_REPLICATE)
            
            return rotated
        except Exception as e:
            logger.error(f"Image preprocessing failed: {str(e)}")
            raise
    
    def extract_text(self, image_bytes):
        """Extract text from image using Tesseract"""
        try:
            processed_img = self.preprocess_image(image_bytes)
            
            # Convert numpy array to PIL Image
            pil_img = Image.fromarray(processed_img)
            
            # OCR configuration
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz./-: '
            
            # Extract text
            text = pytesseract.image_to_string(pil_img, config=custom_config)
            
            return text
        except Exception as e:
            logger.error(f"OCR failed: {str(e)}")
            raise
    
    def extract_bill_number(self, text):
        """Extract bill number using regex patterns"""
        patterns = [
            r'Bill No[.:\s]*([A-Z0-9\-/]+)',
            r'Invoice No[.:\s]*([A-Z0-9\-/]+)',
            r'[A-Z]{3}[0-9]{10,15}',  # Common format: 3 letters + 10-15 digits
            r'[0-9]{10,20}',  # Just digits
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                return matches[0].strip()
        return None
    
    def extract_consumer_number(self, text):
        """Extract consumer number"""
        patterns = [
            r'Consumer No[.:\s]*([A-Z0-9\-/]+)',
            r'Customer ID[.:\s]*([A-Z0-9\-/]+)',
            r'Account No[.:\s]*([A-Z0-9\-/]+)',
            r'[0-9]{11,20}',  # Consumer numbers are often long
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                return matches[0].strip()
        return None
    
    def extract_units(self, text):
        """Extract units consumed"""
        patterns = [
            r'(\d+)\s*(?:kWh|KWH|kwh|Units|units)',
            r'Consumption[.:\s]*(\d+)',
            r'Units Consumed[.:\s]*(\d+)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                return int(matches[0])
        return None
    
    def extract_date(self, text):
        """Extract bill date"""
        patterns = [
            r'(\d{2}[/-]\d{2}[/-]\d{4})',  # DD/MM/YYYY or DD-MM-YYYY
            r'(\d{4}[/-]\d{2}[/-]\d{2})',  # YYYY/MM/DD
            r'Date[.:\s]*(\d{2}[/-]\d{2}[/-]\d{4})',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                return matches[0]
        return None
    
    def extract_amount(self, text):
        """Extract bill amount"""
        patterns = [
            r'Amount[.:\s]*Rs\.?\s*([\d,]+\.?\d*)',
            r'Total[.:\s]*Rs\.?\s*([\d,]+\.?\d*)',
            r'Bill Amount[.:\s]*Rs\.?\s*([\d,]+\.?\d*)',
            r'₹\s*([\d,]+\.?\d*)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                # Remove commas and convert to float
                amount_str = matches[0].replace(',', '')
                return float(amount_str)
        return None
    
    def process_bill(self, image_bytes):
        """Complete bill processing pipeline"""
        try:
            # Extract text
            text = self.extract_text(image_bytes)
            
            # Explicitly initialize result data as a dict to help the linter
            bill_data = {
                'bill_number': self.extract_bill_number(text),
                'consumer_number': self.extract_consumer_number(text),
                'units': self.extract_units(text),
                'bill_date': self.extract_date(text),
                'amount': self.extract_amount(text),
                'full_text': text[:500]  # Store first 500 chars for debugging
            }
            
            result = {
                'success': True,
                'data': bill_data
            }
            
            # Log missing fields
            missing = [k for k, v in bill_data.items() if v is None and k != 'full_text']
            if missing:
                logger.warning(f"Missing fields: {missing}")
            
            return result
            
        except Exception as e:
            logger.error(f"Bill processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
