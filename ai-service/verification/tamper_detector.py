import cv2
import numpy as np
from PIL import Image
import io
import logging
import exifread
from typing import Dict, Any, Tuple
import requests
from io import BytesIO

logger = logging.getLogger(__name__)

class TamperDetector:
    def __init__(self):
        self.ela_quality = 90
        try:
             self.sift = cv2.SIFT_create()
        except:
             try:
                 self.sift = cv2.xfeatures2d.SIFT_create()
             except:
                 self.sift = None

        
    def load_image_from_url(self, url: str) -> np.ndarray:
        """Load image from URL"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
            image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            logger.error(f"Failed to load image from URL {url}: {str(e)}")
            raise
    
    def error_level_analysis(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Detect tampered regions using Error Level Analysis (ELA)
        """
        try:
            # Convert to PIL Image
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(image_rgb)
            
            # Save at different quality
            buffer = BytesIO()
            pil_image.save(buffer, 'JPEG', quality=self.ela_quality)
            buffer.seek(0)
            
            # Reload the saved image
            resaved = Image.open(buffer)
            resaved_array = np.array(resaved)
            
            # Convert back to BGR for OpenCV
            if len(resaved_array.shape) == 3:
                resaved_bgr = cv2.cvtColor(resaved_array, cv2.COLOR_RGB2BGR)
            else:
                resaved_bgr = cv2.cvtColor(resaved_array, cv2.COLOR_GRAY2BGR)
            
            # Calculate difference
            diff = cv2.absdiff(image, resaved_bgr)
            gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
            
            # Apply threshold to highlight tampered regions
            _, ela_map = cv2.threshold(gray_diff, 30, 255, cv2.THRESH_BINARY)
            
            # Calculate scores
            ela_score = np.mean(gray_diff) / 255.0
            tampered_ratio = np.sum(ela_map > 0) / ela_map.size
            
            # Find connected components (potential tampered regions)
            num_labels, labels = cv2.connectedComponents(ela_map)
            
            # Get region stats
            regions = []
            for i in range(1, num_labels):
                region_mask = (labels == i).astype(np.uint8) * 255
                area = np.sum(region_mask > 0)
                if area > 100:  # Minimum area to consider
                    regions.append({
                        'area': int(area),
                        'mean_intensity': float(np.mean(gray_diff[region_mask > 0]))
                    })
            
            return {
                'ela_score': float(ela_score),
                'tampered_ratio': float(tampered_ratio),
                'tampered_regions': len(regions),
                'region_details': regions[:5],  # Top 5 regions
                'ela_map': ela_map.tolist() if ela_map.size < 10000 else 'too_large'
            }
            
        except Exception as e:
            logger.error(f"ELA failed: {str(e)}")
            return {'ela_score': 0, 'tampered_ratio': 0, 'error': str(e)}
    
    def detect_copy_move(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Detect copy-move forgery using SIFT features
        """
        try:
            if self.sift is None:
                return {'copy_move_detected': False, 'confidence': 0, 'error': 'SIFT not available'}
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect SIFT keypoints and descriptors
            keypoints, descriptors = self.sift.detectAndCompute(gray, None)
            
            if descriptors is None or len(keypoints) < 10:
                return {'copy_move_detected': False, 'confidence': 0}
            
            # Match features to themselves
            bf = cv2.BFMatcher()
            matches = bf.knnMatch(descriptors, descriptors, k=2)
            
            # Find suspicious matches (different regions)
            suspicious_matches = 0
            match_pairs = []
            
            for match_pair in matches:
                if len(match_pair) == 2:
                    m, n = match_pair
                    if m.distance < 0.75 * n.distance:
                        pt1 = keypoints[m.queryIdx].pt
                        pt2 = keypoints[m.trainIdx].pt
                        
                        # Calculate distance between matched points
                        spatial_distance = np.sqrt((pt1[0]-pt2[0])**2 + (pt1[1]-pt2[1])**2)
                        
                        # If points are far apart, could be copy-move
                        if spatial_distance > 50:
                            suspicious_matches += 1
                            match_pairs.append({
                                'pt1': pt1,
                                'pt2': pt2,
                                'distance': float(spatial_distance)
                            })
            
            # Calculate ratio
            total_matches = len(matches)
            copy_move_ratio = suspicious_matches / total_matches if total_matches > 0 else 0
            
            # Determine if forgery detected
            detected = copy_move_ratio > 0.1
            confidence = min(copy_move_ratio * 2, 1.0) if detected else 0
            
            return {
                'copy_move_detected': detected,
                'confidence': float(confidence),
                'suspicious_matches': suspicious_matches,
                'total_matches': total_matches,
                'ratio': float(copy_move_ratio),
                'match_pairs': match_pairs[:5]  # Top 5 pairs
            }
            
        except Exception as e:
            logger.error(f"Copy-move detection failed: {str(e)}")
            return {'copy_move_detected': False, 'error': str(e)}
    
    def analyze_metadata(self, image: np.ndarray, url: str = None) -> Dict[str, Any]:
        """
        Analyze image metadata for signs of manipulation
        """
        try:
            # Download image for metadata analysis
            if url:
                response = requests.get(url, timeout=10)
                image_data = response.content
            else:
                _, buffer = cv2.imencode('.jpg', image)
                image_data = buffer.tobytes()
            
            # Extract EXIF data
            tags = exifread.process_file(io.BytesIO(image_data), details=False)
            
            suspicious = []
            metadata = {}
            
            # Check for editing software
            software_tags = ['Software', 'ProcessingSoftware', 'CreatorTool']
            for tag in software_tags:
                if tag in tags:
                    software = str(tags[tag])
                    metadata[tag] = software
                    if any(editor in software.lower() for editor in ['photoshop', 'gimp', 'editor', 'pixlr']):
                        suspicious.append(f"Edited with: {software}")
            
            # Check for missing metadata
            if len(tags) < 5:  # Suspiciously few metadata fields
                suspicious.append("Metadata stripped or minimal")
            
            # Check for inconsistent dates
            date_tags = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']
            dates = []
            for tag in date_tags:
                if tag in tags:
                    dates.append(str(tags[tag]))
            
            if len(dates) > 1 and len(set(dates)) > 1:
                suspicious.append("Inconsistent timestamps in metadata")
            
            # Check for GPS data (could be fake)
            if 'GPSLatitude' in tags and 'GPSLongitude' in tags:
                metadata['has_gps'] = True
                # Could validate GPS coordinates here
            
            risk_score = len(suspicious) * 0.2  # Each suspicious flag adds 0.2
            
            return {
                'metadata_risk': float(min(risk_score, 1.0)),
                'suspicious_flags': suspicious,
                'has_metadata': len(tags) > 0,
                'metadata_count': len(tags),
                'tags_found': list(tags.keys())[:10],  # First 10 tags
                'details': metadata
            }
            
        except Exception as e:
            logger.error(f"Metadata analysis failed: {str(e)}")
            return {'metadata_risk': 0, 'error': str(e)}
    
    def detect_noise_inconsistency(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Detect noise inconsistencies that might indicate splicing
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Estimate noise using wavelet transform
            # Simple approach: use local variance
            kernel_size = 15
            mean = cv2.blur(gray, (kernel_size, kernel_size))
            variance = cv2.blur(cv2.pow(gray - mean, 2), (kernel_size, kernel_size))
            
            # Normalize variance
            variance_norm = cv2.normalize(variance, None, 0, 255, cv2.NORM_MINMAX)
            
            # Calculate statistics
            mean_var = np.mean(variance)
            std_var = np.std(variance)
            var_coefficient = std_var / mean_var if mean_var > 0 else 0
            
            # High variation in noise level might indicate splicing
            is_spliced = var_coefficient > 0.5
            
            return {
                'noise_inconsistency_detected': bool(is_spliced),
                'variance_coefficient': float(var_coefficient),
                'mean_noise': float(mean_var),
                'std_noise': float(std_var),
                'confidence': float(min(var_coefficient, 1.0))
            }
            
        except Exception as e:
            logger.error(f"Noise analysis failed: {str(e)}")
            return {'noise_inconsistency_detected': False, 'error': str(e)}
    
    def analyze_tampering(self, image_url: str) -> Dict[str, Any]:
        """
        Complete tampering analysis pipeline
        """
        try:
            # Load image
            image = self.load_image_from_url(image_url)
            
            # Run all detectors
            ela_result = self.error_level_analysis(image)
            copy_move_result = self.detect_copy_move(image)
            metadata_result = self.analyze_metadata(image, image_url)
            noise_result = self.detect_noise_inconsistency(image)
            
            # Calculate overall tamper score
            scores = [
                ela_result['ela_score'],
                copy_move_result['confidence'] if copy_move_result.get('copy_move_detected') else 0,
                metadata_result['metadata_risk'],
                noise_result['confidence'] if noise_result.get('noise_inconsistency_detected') else 0
            ]
            
            # Weighted average (ELA has higher weight)
            weights = [0.4, 0.3, 0.2, 0.1]
            tamper_score = sum(s * w for s, w in zip(scores, weights))
            
            # Determine risk level
            if tamper_score < 0.2:
                risk_level = 'LOW'
            elif tamper_score < 0.4:
                risk_level = 'MEDIUM'
            elif tamper_score < 0.6:
                risk_level = 'HIGH'
            else:
                risk_level = 'CRITICAL'
            
            return {
                'tamper_score': float(tamper_score),
                'risk_level': risk_level,
                'ela_analysis': ela_result,
                'copy_move_analysis': copy_move_result,
                'metadata_analysis': metadata_result,
                'noise_analysis': noise_result,
                'details': {
                    'image_url': image_url,
                    'analysis_time': str(np.datetime64('now'))
                }
            }
            
        except Exception as e:
            logger.error(f"Tampering analysis failed: {str(e)}")
            return {
                'tamper_score': 0,
                'risk_level': 'UNKNOWN',
                'error': str(e)
            }
