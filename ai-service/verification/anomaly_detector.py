import numpy as np
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class AnomalyDetector:
    def __init__(self):
        pass
    
    def detect_z_score(self, history: List[float], current: float) -> Dict[str, Any]:
        """
        Detect anomalies using Z-score method
        |Z| > 3 indicates anomaly (99.7% confidence)
        """
        try:
            if len(history) < 3:
                return {
                    'is_anomaly': False,
                    'z_score': 0,
                    'confidence': 0.5,
                    'reason': 'Insufficient history'
                }
            
            # Convert to numpy array
            history_array = np.array(history)
            
            # Calculate mean and standard deviation
            mean = np.mean(history_array)
            std = np.std(history_array)
            
            if std == 0:
                return {
                    'is_anomaly': False,
                    'z_score': 0,
                    'confidence': 0.5,
                    'reason': 'No variation in history'
                }
            
            # Calculate Z-score
            z_score = abs(current - mean) / std
            
            # Determine if anomaly
            is_anomaly = z_score > 3
            
            # Calculate confidence based on how extreme
            confidence = min(z_score / 5, 1.0) if is_anomaly else 1 - (z_score / 5)
            
            return {
                'is_anomaly': is_anomaly,
                'z_score': float(z_score),
                'mean': float(mean),
                'std': float(std),
                'confidence': float(confidence),
                'reason': f'{z_score:.2f} standard deviations from mean' if is_anomaly else 'Normal pattern'
            }
            
        except Exception as e:
            logger.error(f"Z-score detection failed: {str(e)}")
            return {
                'is_anomaly': False,
                'error': str(e),
                'confidence': 0
            }
    
    def detect_moving_average(self, history: List[float], current: float, window: int = 3) -> Dict[str, Any]:
        """
        Detect anomalies using moving average
        """
        try:
            if len(history) < window:
                return {
                    'is_anomaly': False,
                    'confidence': 0.5,
                    'reason': 'Insufficient history'
                }
            
            # Get last 'window' values
            recent = history[-window:]
            recent_array = np.array(recent)
            
            # Calculate moving average and std
            ma = np.mean(recent_array)
            std = np.std(recent_array)
            
            if std == 0:
                return {
                    'is_anomaly': False,
                    'confidence': 0.5,
                    'reason': 'No variation in recent history'
                }
            
            # Calculate deviation
            deviation = abs(current - ma)
            z_score = deviation / std if std > 0 else 0
            
            is_anomaly = z_score > 2  # 2 sigma
            
            return {
                'is_anomaly': is_anomaly,
                'moving_average': float(ma),
                'deviation': float(deviation),
                'z_score': float(z_score),
                'confidence': min(z_score / 3, 1.0),
                'reason': f'Deviation of {deviation:.2f} from moving average' if is_anomaly else 'Normal'
            }
            
        except Exception as e:
            logger.error(f"Moving average detection failed: {str(e)}")
            return {
                'is_anomaly': False,
                'error': str(e),
                'confidence': 0
            }
    
    def detect_iqr(self, history: List[float], current: float) -> Dict[str, Any]:
        """
        Detect anomalies using Interquartile Range (IQR) method
        """
        try:
            if len(history) < 10:
                return {
                    'is_anomaly': False,
                    'confidence': 0.5,
                    'reason': 'Insufficient history for IQR'
                }
            
            history_array = np.array(history)
            
            # Calculate quartiles
            q1 = np.percentile(history_array, 25)
            q3 = np.percentile(history_array, 75)
            iqr = q3 - q1
            
            # Define bounds
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            # Check if current is outside bounds
            is_anomaly = current < lower_bound or current > upper_bound
            
            # Calculate how extreme
            if is_anomaly:
                if current < lower_bound:
                    severity = (lower_bound - current) / iqr if iqr > 0 else 1
                else:
                    severity = (current - upper_bound) / iqr if iqr > 0 else 1
            else:
                severity = 0
            
            return {
                'is_anomaly': is_anomaly,
                'q1': float(q1),
                'q3': float(q3),
                'iqr': float(iqr),
                'lower_bound': float(lower_bound),
                'upper_bound': float(upper_bound),
                'severity': float(min(severity, 1)),
                'confidence': float(min(severity + 0.3, 1.0)) if is_anomaly else 0.9
            }
            
        except Exception as e:
            logger.error(f"IQR detection failed: {str(e)}")
            return {
                'is_anomaly': False,
                'error': str(e),
                'confidence': 0
            }
    
    def detect_ensemble(self, history: List[float], current: float) -> Dict[str, Any]:
        """
        Combine multiple detection methods for better accuracy
        """
        try:
            # Run all detectors
            z_score_result = self.detect_z_score(history, current)
            ma_result = self.detect_moving_average(history, current)
            iqr_result = self.detect_iqr(history, current) if len(history) >= 10 else {'is_anomaly': False, 'confidence': 0.5}
            
            # Count votes
            votes = 0
            total_confidence = 0
            
            if z_score_result['is_anomaly']:
                votes += 1
                total_confidence += z_score_result['confidence']
            
            if ma_result['is_anomaly']:
                votes += 1
                total_confidence += ma_result['confidence']
            
            if iqr_result['is_anomaly']:
                votes += 1
                total_confidence += iqr_result['confidence']
            
            # Weighted decision
            is_anomaly = votes >= 2
            avg_confidence = total_confidence / max(votes, 1)
            
            return {
                'is_anomaly': is_anomaly,
                'votes': votes,
                'confidence': float(avg_confidence),
                'methods': {
                    'z_score': z_score_result,
                    'moving_average': ma_result,
                    'iqr': iqr_result
                }
            }
            
        except Exception as e:
            logger.error(f"Ensemble detection failed: {str(e)}")
            return {
                'is_anomaly': False,
                'error': str(e),
                'confidence': 0
            }
