import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import logging
from typing import Dict, Any, List
import xgboost as xgb

logger = logging.getLogger(__name__)

class FraudEnsembleDetector:
    def __init__(self, model_path: str = None):
        """
        Initialize ensemble of fraud detection models
        """
        self.models = {}
        self.scaler = StandardScaler()
        self.feature_names = [
            'tamper_score',
            'metadata_risk',
            'z_score',
            'trend_deviation',
            'user_history_length',
            'previous_fraud_count',
            'submission_hour',
            'is_weekend',
            'claimed_value',
            'has_qr',
            'proof_count',
            'action_type_encoded',
            'time_since_last_action',
            'avg_claim_value',
            'claim_ratio'
        ]
        
        # Initialize models
        self._init_models()
        
        # Load pre-trained model if provided
        if model_path:
            self.load_model(model_path)
    
    def _init_models(self):
        """Initialize individual models"""
        # Random Forest
        self.models['random_forest'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42
        )
        
        # XGBoost
        self.models['xgboost'] = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        
        # Neural Network
        self.models['neural_network'] = MLPClassifier(
            hidden_layer_sizes=(64, 32),
            activation='relu',
            max_iter=500,
            random_state=42
        )
        
        # Gradient Boosting
        self.models['gradient_boosting'] = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
    
    def extract_features(self, data: Dict[str, Any]) -> np.ndarray:
        """
        Extract feature vector from input data
        """
        features = []
        
        # Document features
        features.append(data.get('tamper_score', 0))
        features.append(data.get('metadata_risk', 0))
        
        # Statistical features
        features.append(data.get('z_score', 0))
        features.append(data.get('trend_deviation', 0))
        
        # User features
        features.append(data.get('user_history_length', 0))
        features.append(data.get('previous_fraud_count', 0))
        
        # Temporal features
        features.append(data.get('submission_hour', 0))
        features.append(1 if data.get('is_weekend') else 0)
        
        # Action features
        features.append(data.get('claimed_value', 0))
        features.append(1 if data.get('has_qr') else 0)
        features.append(data.get('proof_count', 1))
        
        # Action type encoding (simplified - one-hot would be better)
        action_types = ['electricity', 'solar', 'ev', 'transport', 'water', 'waste', 'tree']
        action_type = data.get('action_type', 'electricity')
        action_encoded = action_types.index(action_type) / len(action_types) if action_type in action_types else 0
        features.append(action_encoded)
        
        # Derived features
        features.append(data.get('time_since_last_action', 24))  # hours
        features.append(data.get('avg_claim_value', 0))
        
        # Claim ratio (current / average)
        avg_claim = data.get('avg_claim_value', 1)
        claim_ratio = data.get('claimed_value', 0) / avg_claim if avg_claim > 0 else 1
        features.append(min(claim_ratio, 10))  # Cap at 10
        
        return np.array(features).reshape(1, -1)
    
    def predict_proba(self, features: np.ndarray) -> Dict[str, float]:
        """
        Get probability predictions from all models
        """
        probabilities = {}
        
        for name, model in self.models.items():
            try:
                # Normally needs fitting, using a default value if not fitted
                if hasattr(model, 'classes_'):
                    prob = model.predict_proba(features)[0][1]  # Probability of fraud
                else:
                    prob = 0.5
                probabilities[name] = float(prob)
            except Exception as e:
                logger.error(f"Model {name} prediction failed: {str(e)}")
                probabilities[name] = 0.5  # Default
        
        return probabilities
    
    def ensemble_predict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensemble prediction with voting
        """
        try:
            # Extract features
            features = self.extract_features(data)
            
            # Scale features if scaler is fitted
            if hasattr(self.scaler, 'mean_'):
                features = self.scaler.transform(features)
            
            # Get individual predictions
            individual_probs = self.predict_proba(features)
            
            # Calculate ensemble probability (weighted average)
            weights = {
                'random_forest': 0.3,
                'xgboost': 0.3,
                'neural_network': 0.2,
                'gradient_boosting': 0.2
            }
            
            ensemble_prob = sum(
                individual_probs[name] * weights.get(name, 0.2)
                for name in individual_probs
            )
            
            # Calculate agreement (standard deviation of predictions)
            probs_list = list(individual_probs.values())
            agreement = 1 - np.std(probs_list) if probs_list else 0
            
            # Determine risk level
            if ensemble_prob < 0.3:
                risk_level = 'LOW'
            elif ensemble_prob < 0.5:
                risk_level = 'MEDIUM'
            elif ensemble_prob < 0.7:
                risk_level = 'HIGH'
            else:
                risk_level = 'CRITICAL'
            
            # Identify contributing factors
            contributing_factors = []
            
            if data.get('tamper_score', 0) > 0.5:
                contributing_factors.append('document_tampering')
            if data.get('z_score', 0) > 3:
                contributing_factors.append('statistical_anomaly')
            if data.get('previous_fraud_count', 0) > 0:
                contributing_factors.append('previous_fraud_history')
            if data.get('claim_ratio', 1) > 3:
                contributing_factors.append('unusually_high_claim')
            if not data.get('has_qr') and data.get('proof_count', 0) < 2:
                contributing_factors.append('insufficient_proof')
            
            return {
                'fraud_probability': float(ensemble_prob),
                'risk_level': risk_level,
                'model_agreement': float(agreement),
                'contributing_factors': contributing_factors[:3],  # Top 3 factors
                'individual_model_predictions': individual_probs,
                'feature_importance': self._get_feature_importance(features),
                'model_version': '1.0.0'
            }
            
        except Exception as e:
            logger.error(f"Ensemble prediction failed: {str(e)}")
            return {
                'fraud_probability': 0.5,
                'risk_level': 'UNKNOWN',
                'error': str(e)
            }
    
    def _get_feature_importance(self, features: np.ndarray) -> List[Dict[str, Any]]:
        """
        Get feature importance for this prediction
        """
        try:
            importances = []
            
            # Use random forest feature importance
            if 'random_forest' in self.models:
                rf = self.models['random_forest']
                if hasattr(rf, 'feature_importances_'):
                    for name, importance in zip(self.feature_names, rf.feature_importances_):
                        importances.append({
                            'feature': name,
                            'importance': float(importance)
                        })
            
            # Sort by importance
            importances.sort(key=lambda x: x['importance'], reverse=True)
            
            return importances[:5]  # Top 5 features
            
        except Exception as e:
            logger.error(f"Feature importance calculation failed: {str(e)}")
            return []
    
    def train(self, X: np.ndarray, y: np.ndarray):
        """
        Train all models
        """
        try:
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Train each model
            for name, model in self.models.items():
                model.fit(X_scaled, y)
                logger.info(f"Trained {name} model")
            
            logger.info("All models trained successfully")
            
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            raise
    
    def save_model(self, path: str):
        """
        Save trained models and scaler
        """
        try:
            model_data = {
                'models': self.models,
                'scaler': self.scaler,
                'feature_names': self.feature_names
            }
            joblib.dump(model_data, path)
            logger.info(f"Models saved to {path}")
            
        except Exception as e:
            logger.error(f"Failed to save models: {str(e)}")
            raise
    
    def load_model(self, path: str):
        """
        Load trained models
        """
        try:
            model_data = joblib.load(path)
            self.models = model_data['models']
            self.scaler = model_data['scaler']
            self.feature_names = model_data['feature_names']
            logger.info(f"Models loaded from {path}")
            
        except Exception as e:
            logger.error(f"Failed to load models: {str(e)}")
            raise

# Singleton instance
_fraud_detector = None

def get_fraud_detector():
    global _fraud_detector
    if _fraud_detector is None:
        _fraud_detector = FraudEnsembleDetector()
    return _fraud_detector
