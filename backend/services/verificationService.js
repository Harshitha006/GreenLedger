const Action = require('../models/Action');
const User = require('../models/User');
const FraudAlert = require('../models/FraudAlert');
const {
  callOCRService,
  callDuplicateCheck,
  callAnomalyDetection,
  callFraudAnalysis,
  callTamperDetection,
  callSourceValidation
} = require('./aiService');
const { calculateImpact } = require('../utils/impactCalculator');
const logger = require('../config/logger');

class VerificationService {
  constructor() {
    this.verificationLayers = [
      'documentAuthenticity',
      'duplicateDetection',
      'statisticalAnalysis',
      'sourceValidation',
      'ensembleFraud'
    ];
  }

  async verifyAction(actionId) {
    const startTime = Date.now();
    logger.info(`Starting verification for action: ${actionId}`);

    try {
      const action = await Action.findById(actionId)
        .populate('userId', 'email name');

      if (!action) {
        throw new Error('Action not found');
      }

      // Update status to verifying
      action.status = 'verifying';
      await action.save();

      // Initialize verification results
      const verificationResults = {
        layers: {},
        overallConfidence: 0,
        verifiedAt: new Date(),
        verifiedBy: 'system'
      };

      // Layer 1: Document Authenticity Check
      verificationResults.layers.documentAuthenticity = await this.verifyDocumentAuthenticity(action);

      // If document is clearly tampered, flag immediately
      if (verificationResults.layers.documentAuthenticity.tamperScore > 0.8) {
        await this.createFraudAlert(action, 'tampered', 'high',
          verificationResults.layers.documentAuthenticity);
        action.status = 'flagged';
        action.verificationResults = verificationResults;
        await action.save();
        return { status: 'flagged', reason: 'Document tampering detected' };
      }

      // Layer 2: Duplicate Detection
      verificationResults.layers.duplicateDetection = await this.checkDuplicates(action);

      if (verificationResults.layers.duplicateDetection.isDuplicate) {
        await this.createFraudAlert(action, 'duplicate', 'high',
          verificationResults.layers.duplicateDetection);
        action.status = 'rejected';
        action.verificationResults = verificationResults;
        action.rejectionReason = 'Duplicate submission detected';
        await action.save();
        return { status: 'rejected', reason: 'Duplicate document' };
      }

      // Layer 3: Statistical Analysis
      verificationResults.layers.statisticalAnalysis = await this.analyzeStatistics(action);

      // Layer 4: Source Validation (QR/API)
      if (action.hasQR) {
        verificationResults.layers.sourceValidation = await this.validateSource(action);
      }

      // Layer 5: Ensemble Fraud Detection
      verificationResults.layers.ensembleFraud = await this.runEnsembleFraudDetection(action, verificationResults);

      // Calculate overall confidence
      verificationResults.overallConfidence = this.calculateOverallConfidence(verificationResults.layers);

      // Determine final status
      const finalStatus = this.determineStatus(verificationResults);
      action.status = finalStatus;

      // If approved, calculate impact and issue credits
      if (finalStatus === 'approved') {
        const impact = await calculateImpact(action);
        action.impact = impact;

        // Update user stats
        await this.updateUserStats(action.userId, impact);

        // Create credit transaction
        await this.createCreditTransaction(action, impact);
      }

      // If flagged, create fraud alert
      if (finalStatus === 'flagged') {
        await this.createFraudAlert(action, 'suspicious', 'medium',
          verificationResults.layers.ensembleFraud);
      }

      action.verificationResults = verificationResults;
      action.verifiedAt = new Date();
      await action.save();

      const duration = Date.now() - startTime;
      logger.info(`Verification completed for action ${actionId} in ${duration}ms. Status: ${finalStatus}`);

      return {
        status: finalStatus,
        confidence: verificationResults.overallConfidence,
        layers: Object.keys(verificationResults.layers),
        duration
      };

    } catch (error) {
      logger.error(`Verification failed for action ${actionId}:`, error);

      // Update action status to pending for manual review
      await Action.findByIdAndUpdate(actionId, {
        status: 'pending',
        'verificationResults.error': error.message
      });

      throw error;
    }
  }

  async verifyDocumentAuthenticity(action) {
    const results = {
      passed: false,
      confidence: 0,
      tamperScore: 0,
      metadataScore: 0,
      details: {}
    };

    try {
      for (const proofUrl of action.proofUrls) {
        // Call tamper detection service
        const tamperResult = await callTamperDetection(proofUrl);

        results.details[proofUrl] = tamperResult;

        // Aggregate scores
        results.tamperScore = Math.max(results.tamperScore, tamperResult.ela_score || 0);
        results.metadataScore = Math.max(results.metadataScore, tamperResult.metadata_risk || 0);
      }

      // Overall assessment
      results.confidence = 1 - ((results.tamperScore + results.metadataScore) / 2);
      results.passed = results.tamperScore < 0.3 && results.metadataScore < 0.3;

    } catch (error) {
      logger.error('Document authenticity check failed:', error);
      results.error = error.message;
    }

    return results;
  }

  async checkDuplicates(action) {
    const results = {
      isDuplicate: false,
      confidence: 0,
      matches: [],
      details: {}
    };

    try {
      for (const proofUrl of action.proofUrls) {
        const duplicateResult = await callDuplicateCheck(proofUrl);

        if (duplicateResult.is_duplicate) {
          results.isDuplicate = true;
          results.matches.push({
            url: proofUrl,
            similarity: duplicateResult.similarity_score,
            originalSubmission: duplicateResult.original_submission
          });
          results.confidence = Math.max(results.confidence, duplicateResult.confidence);
        }

        results.details[proofUrl] = duplicateResult;
      }

    } catch (error) {
      logger.error('Duplicate check failed:', error);
      results.error = error.message;
    }

    return results;
  }

  async analyzeStatistics(action) {
    const results = {
      passed: false,
      confidence: 0,
      zScore: 0,
      trendDeviation: 0,
      seasonalOk: true,
      details: {}
    };

    try {
      // Get user's historical data
      const userActions = await Action.find({
        userId: action.userId,
        actionType: action.actionType,
        status: 'approved',
        'impact.co2SavedKg': { $exists: true }
      }).sort({ createdAt: -1 }).limit(12);

      if (userActions.length === 0) {
        results.passed = true;
        results.confidence = 0.5;
        results.details.note = 'No historical data';
        return results;
      }

      const history = userActions.map(a => a.impact.co2SavedKg);
      const currentValue = action.impact?.co2SavedKg || 0;

      // Z-score analysis
      const zScoreResult = await callAnomalyDetection({
        history,
        current: currentValue,
        method: 'zscore'
      });

      results.zScore = zScoreResult.z_score;
      results.details.zScore = zScoreResult;

      // Moving average analysis
      const maResult = await callAnomalyDetection({
        history,
        current: currentValue,
        method: 'moving_average'
      });

      results.trendDeviation = maResult.deviation || 0;
      results.details.movingAverage = maResult;

      // Seasonal pattern check (if enough data)
      if (userActions.length >= 12) {
        const seasonalResult = await callAnomalyDetection({
          history,
          current: currentValue,
          method: 'seasonal'
        });
        results.seasonalOk = seasonalResult.seasonal_ok;
        results.details.seasonal = seasonalResult;
      }

      // Overall assessment
      const zScorePass = Math.abs(results.zScore) < 3;
      const trendPass = results.trendDeviation < 2;

      results.passed = zScorePass && trendPass && results.seasonalOk;
      results.confidence = (
        (1 - Math.min(Math.abs(results.zScore) / 5, 1)) * 0.4 +
        (1 - Math.min(results.trendDeviation / 3, 1)) * 0.3 +
        (results.seasonalOk ? 0.3 : 0)
      );

    } catch (error) {
      logger.error('Statistical analysis failed:', error);
      results.error = error.message;
    }

    return results;
  }

  async validateSource(action) {
    const results = {
      passed: false,
      confidence: 0,
      sourceVerified: false,
      details: {}
    };

    try {
      if (action.qrData) {
        // Validate QR signature
        const qrResult = await callSourceValidation({
          type: 'qr',
          data: action.qrData
        });

        results.sourceVerified = qrResult.verified;
        results.details.qr = qrResult;
        results.confidence = qrResult.verified ? 1.0 : 0.2;
        results.passed = qrResult.verified;
      }

      // Check if API verification is available
      if (action.extractedData?.consumerNumber) {
        const apiResult = await callSourceValidation({
          type: 'api',
          consumerNumber: action.extractedData.consumerNumber,
          billNumber: action.extractedData.billNumber
        });

        results.sourceVerified = results.sourceVerified || apiResult.verified;
        results.details.api = apiResult;
        results.confidence = Math.max(results.confidence, apiResult.verified ? 1.0 : 0.2);
        results.passed = results.sourceVerified;
      }

    } catch (error) {
      logger.error('Source validation failed:', error);
      results.error = error.message;
    }

    return results;
  }

  async runEnsembleFraudDetection(action, verificationResults) {
    const results = {
      fraudProbability: 0,
      riskLevel: 'LOW',
      contributingFactors: [],
      modelVersion: '1.0.0'
    };

    try {
      // Prepare features for ensemble model
      const features = {
        // Document features
        tamperScore: verificationResults.layers.documentAuthenticity?.tamperScore || 0,
        metadataRisk: verificationResults.layers.documentAuthenticity?.metadataScore || 0,

        // Statistical features
        zScore: verificationResults.layers.statisticalAnalysis?.zScore || 0,
        trendDeviation: verificationResults.layers.statisticalAnalysis?.trendDeviation || 0,

        // User features
        userHistoryLength: await Action.countDocuments({ userId: action.userId }),
        previousFraudCount: await FraudAlert.countDocuments({
          userId: action.userId,
          status: 'confirmed'
        }),

        // Action features
        actionType: action.actionType,
        submissionHour: new Date(action.createdAt).getHours(),
        isWeekend: [0, 6].includes(new Date(action.createdAt).getDay()),

        // Value features
        claimedValue: action.impact?.creditsEarned || 0,
        hasQR: action.hasQR || false,
        proofCount: action.proofUrls.length
      };

      // Call ensemble fraud detection service
      const ensembleResult = await callFraudAnalysis(features);

      results.fraudProbability = ensembleResult.fraud_probability;
      results.riskLevel = ensembleResult.risk_level;
      results.contributingFactors = ensembleResult.factors || [];
      results.details = ensembleResult;

    } catch (error) {
      logger.error('Ensemble fraud detection failed:', error);
      results.error = error.message;
    }

    return results;
  }

  calculateOverallConfidence(layers) {
    const weights = {
      documentAuthenticity: 0.25,
      duplicateDetection: 0.25,
      statisticalAnalysis: 0.2,
      sourceValidation: 0.15,
      ensembleFraud: 0.15
    };

    let totalConfidence = 0;
    let totalWeight = 0;

    for (const [layer, weight] of Object.entries(weights)) {
      if (layers[layer] && layers[layer].confidence !== undefined) {
        totalConfidence += layers[layer].confidence * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalConfidence / totalWeight : 0.5;
  }

  determineStatus(verificationResults) {
    const confidence = verificationResults.overallConfidence;
    const fraudProbability = verificationResults.layers.ensembleFraud?.fraudProbability || 0;

    if (fraudProbability > 0.8) {
      return 'flagged';
    }

    if (confidence > 0.8 && fraudProbability < 0.3) {
      return 'approved';
    }

    if (confidence < 0.3 || fraudProbability > 0.6) {
      return 'flagged';
    }

    return 'pending';
  }

  async createFraudAlert(action, type, severity, details) {
    try {
      const alert = new FraudAlert({
        actionId: action._id,
        userId: action.userId,
        alertType: type,
        severity,
        confidence: details.confidence || 0.8,
        description: `${type} detected during verification`,
        evidence: {
          documentHash: action.proofMetadata[0]?.hash,
          ipAddress: action.submissionIp,
          timestamps: [action.createdAt],
          similarityScore: details.similarity_score
        },
        detectedBy: 'verification_engine',
        status: 'new'
      });

      await alert.save();
      logger.warn(`Fraud alert created for action ${action._id}: ${type} (${severity})`);

    } catch (error) {
      logger.error('Failed to create fraud alert:', error);
    }
  }

  async updateUserStats(userId, impact) {
    try {
      const user = await User.findById(userId);

      if (!user) return;

      user.walletBalance += impact.creditsEarned;
      user.totalCreditsEarned += impact.creditsEarned;
      user.totalCO2Saved += impact.co2SavedKg;
      user.totalEnergySaved += impact.energySavedKwh;
      user.totalWaterSaved += impact.waterSavedL;
      user.actionsCount += 1;
      user.verifiedActionsCount += 1;

      // Recalculate sustainability score
      const maxPossibleCredits = 1000;
      user.sustainabilityScore = Math.min(
        Math.round((user.totalCreditsEarned / maxPossibleCredits) * 100),
        100
      );

      user.lastActive = new Date();
      await user.save();

    } catch (error) {
      logger.error('Failed to update user stats:', error);
    }
  }

  async createCreditTransaction(action, impact) {
    const CreditTransaction = require('../models/CreditTransaction');

    try {
      const transaction = new CreditTransaction({
        toUser: action.userId,
        amount: impact.creditsEarned,
        type: 'earned',
        actionId: action._id,
        description: `Credits earned for ${action.actionType} action`,
        balanceAfter: {
          toUser: (await User.findById(action.userId)).walletBalance
        }
      });

      await transaction.save();
      logger.info(`Credit transaction created for action ${action._id}: ${impact.creditsEarned} credits`);

    } catch (error) {
      logger.error('Failed to create credit transaction:', error);
    }
  }
}

module.exports = new VerificationService();
