import hashlib
import hmac
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import load_pem_public_key
import base64

logger = logging.getLogger(__name__)

class SourceValidator:
    def __init__(self):
        # In production, load trusted public keys from secure storage
        self.trusted_issuers = {}
        self.api_endpoints = {
            'electricity': 'https://api.electricityboard.gov.in/v1/verify',
            'solar': 'https://api.mnre.gov.in/v1/certificates/verify',
            'transport': 'https://api.transport.gov.in/v1/pass/verify'
        }
    
    def validate_qr(self, qr_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate QR code data
        """
        try:
            # Check required fields
            required_fields = ['transaction_id', 'issuer_id', 'timestamp', 'signature']
            for field in required_fields:
                if field not in qr_data:
                    return {
                        'verified': False,
                        'confidence': 0,
                        'reason': f'Missing required field: {field}'
                    }
            
            # Check expiry
            if 'expiry' in qr_data:
                expiry = datetime.fromisoformat(qr_data['expiry'])
                if datetime.now() > expiry:
                    return {
                        'verified': False,
                        'confidence': 0,
                        'reason': 'QR code expired'
                    }
            
            # Verify signature
            signature_valid = self._verify_signature(qr_data)
            if not signature_valid:
                return {
                    'verified': False,
                    'confidence': 0.1,
                    'reason': 'Invalid signature'
                }
            
            # Check if already used (would query database in production)
            # This is a placeholder
            is_used = False
            
            if is_used:
                return {
                    'verified': False,
                    'confidence': 0,
                    'reason': 'QR code already used'
                }
            
            return {
                'verified': True,
                'confidence': 1.0,
                'issuer': qr_data.get('issuer_id'),
                'transaction_id': qr_data.get('transaction_id'),
                'timestamp': qr_data.get('timestamp')
            }
            
        except Exception as e:
            logger.error(f"QR validation failed: {str(e)}")
            return {
                'verified': False,
                'confidence': 0,
                'error': str(e)
            }
    
    def validate_api(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate via API call to official source
        """
        try:
            source_type = data.get('type')
            if source_type not in self.api_endpoints:
                return {
                    'verified': False,
                    'confidence': 0,
                    'reason': f'Unknown source type: {source_type}'
                }
            
            # Prepare API request
            api_url = self.api_endpoints[source_type]
            api_key = self._get_api_key(source_type)
            
            payload = {
                'consumer_number': data.get('consumer_number'),
                'bill_number': data.get('bill_number'),
                'timestamp': datetime.now().isoformat()
            }
            
            # Call API (simulated for demo)
            # In production, make actual HTTP request
            response = self._mock_api_call(source_type, payload)
            
            if response.get('verified'):
                return {
                    'verified': True,
                    'confidence': 1.0,
                    'source': source_type,
                    'data': response.get('data', {})
                }
            else:
                return {
                    'verified': False,
                    'confidence': 0.2,
                    'reason': response.get('reason', 'API verification failed')
                }
            
        except Exception as e:
            logger.error(f"API validation failed: {str(e)}")
            return {
                'verified': False,
                'confidence': 0,
                'error': str(e)
            }
    
    def _verify_signature(self, qr_data: Dict[str, Any]) -> bool:
        """
        Verify RSA signature of QR data
        """
        try:
            issuer_id = qr_data.get('issuer_id')
            if issuer_id not in self.trusted_issuers:
                logger.warning(f"Untrusted issuer: {issuer_id}")
                return False
            
            public_key = self.trusted_issuers[issuer_id]
            
            # Extract signature
            signature = base64.b64decode(qr_data.get('signature', ''))
            
            # Create message from data (excluding signature)
            message_data = {k: v for k, v in qr_data.items() if k != 'signature'}
            message = json.dumps(message_data, sort_keys=True).encode('utf-8')
            
            # Verify signature
            public_key.verify(
                signature,
                message,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Signature verification failed: {str(e)}")
            return False
    
    def _get_api_key(self, source_type: str) -> Optional[str]:
        """
        Get API key for source type (from secure storage)
        """
        # In production, fetch from secure vault
        api_keys = {
            'electricity': 'mock_electricity_key',
            'solar': 'mock_solar_key',
            'transport': 'mock_transport_key'
        }
        return api_keys.get(source_type)
    
    def _mock_api_call(self, source_type: str, payload: Dict) -> Dict:
        """
        Mock API call for demonstration
        """
        # Simulate different responses based on source type
        if source_type == 'electricity':
            # Mock electricity board API
            return {
                'verified': True,
                'data': {
                    'consumer_name': 'Test User',
                    'bill_amount': 2450.50,
                    'units': 380,
                    'due_date': '2024-04-15',
                    'status': 'PAID'
                }
            }
        elif source_type == 'solar':
            return {
                'verified': True,
                'data': {
                    'installer': 'ABC Solar Ltd',
                    'capacity': '5kW',
                    'installation_date': '2024-01-15',
                    'status': 'ACTIVE'
                }
            }
        else:
            return {
                'verified': False,
                'reason': 'No matching record found'
            }

# Singleton instance
_source_validator = None

def get_source_validator():
    global _source_validator
    if _source_validator is None:
        _source_validator = SourceValidator()
    return _source_validator
