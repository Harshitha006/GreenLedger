import imagehash
from PIL import Image
import io
import hashlib
import logging
from typing import Dict, Any
import numpy as np

logger = logging.getLogger(__name__)

class DuplicateDetector:
    def __init__(self, db_connection=None):
        self.db = db_connection
        # In production, this would connect to MongoDB to check existing hashes
        
    def calculate_phash(self, file_bytes):
        """Calculate perceptual hash (only for images)"""
        try:
            # Try to open as image
            image = Image.open(io.BytesIO(file_bytes))
            # Convert to RGB if necessary for consistency
            if image.mode != 'RGB':
                image = image.convert('RGB')
            phash = imagehash.phash(image)
            return str(phash)
        except Exception:
            # Not an image or corrupted, return None for phash
            # Exact matches will still be caught by SHA-256
            return None
    
    def calculate_sha256(self, file_bytes):
        """Calculate SHA-256 hash (exact match)"""
        return hashlib.sha256(file_bytes).hexdigest()
    
    def calculate_hashes(self, file_bytes):
        """Calculate all hashes"""
        hashes = {
            'md5': self.calculate_md5(file_bytes),
            'sha256': self.calculate_sha256(file_bytes),
            'phash': self.calculate_phash(file_bytes)
        }
        return hashes
    
    def check_duplicate(self, image_bytes, user_id=None):
        """Check if image is duplicate"""
        try:
            hashes = self.calculate_hashes(image_bytes)
            
            # In production, query database for existing hashes
            # This is a placeholder that simulates checking
            
            # Simulate database check
            # For demo, always return not duplicate
            result = {
                'is_duplicate': False,
                'similarity_score': 0.0,
                'confidence': 0.95,
                'hashes': hashes
            }
            
            # Check if MD5 exists (exact duplicate)
            # if self.db.find_one({'md5_hash': hashes['md5']}):
            #     return {
            #         'is_duplicate': True,
            #         'level': 'EXACT',
            #         'confidence': 1.0
            #     }
            
            # Check if similar perceptual hash exists
            # similar = self.db.find_similar_phash(hashes['phash'], threshold=5)
            # if similar:
            #     return {
            #         'is_duplicate': True,
            #         'level': 'PERCEPTUAL',
            #         'similarity_score': similar['score'],
            #         'confidence': 0.85
            #     }
            
            return result
            
        except Exception as e:
            logger.error(f"Duplicate check failed: {str(e)}")
            return {
                'is_duplicate': False,
                'error': str(e),
                'confidence': 0
            }
    
    def calculate_similarity(self, hash1, hash2):
        """Calculate similarity between two perceptual hashes"""
        if not hash1 or not hash2:
            return 0
        
        # Convert to binary and calculate Hamming distance
        bin1 = format(int(str(hash1), 16), '064b')
        bin2 = format(int(str(hash2), 16), '064b')
        
        # Count differing bits
        distance = sum(b1 != b2 for b1, b2 in zip(bin1, bin2))
        
        # Convert to similarity score (0-1)
        similarity = 1 - (distance / 64)
        
        return similarity
