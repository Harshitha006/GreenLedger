const Action = require('../models/Action');
const User = require('../models/User');
const FraudAlert = require('../models/FraudAlert');
const asyncHandler = require('../utils/asyncHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { callOCRService, callDuplicateCheck, callAnomalyDetection } = require('../services/aiService');
const fs = require('fs').promises;
const path = require('path');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () =>
    !!(process.env.CLOUDINARY_CLOUD_NAME &&
       process.env.CLOUDINARY_API_KEY &&
       process.env.CLOUDINARY_API_SECRET);

// Build a local URL for a multer-saved file (fallback when Cloudinary is not set up)
const buildLocalUrl = (file) => {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const filename = path.basename(file.path);
    return `${backendUrl}/uploads/${filename}`;
};

// @desc    Upload new action (bill/proof)
// @route   POST /api/actions/upload
// @access  Private
const uploadAction = asyncHandler(async (req, res) => {
    const { actionType, userInput } = req.body;

    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('Please upload at least one proof document');
    }

    const files = req.files;
    const proofUrls = [];
    const proofMetadata = [];

    for (const file of files) {
        let fileUrl;
        let publicId;

        if (isCloudinaryConfigured()) {
            // Upload to Cloudinary when credentials are available
            const result = await uploadToCloudinary(file.path, {
                folder: `greenledger/actions/${req.user._id}`,
                resource_type: 'auto',
            });
            fileUrl = result.secure_url;
            publicId = result.public_id;
            // Clean up local temp file after Cloudinary upload
            await fs.unlink(file.path).catch(console.error);
        } else {
            // Fallback: keep the file locally and serve it via /uploads/
            fileUrl = buildLocalUrl(file);
            publicId = path.basename(file.path);
            console.warn('[Upload] Cloudinary not configured – storing file locally:', publicId);
        }

        proofUrls.push(fileUrl);
        proofMetadata.push({
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
            hash: publicId,
        });
    }

    // Parse userInput safely
    let parsedUserInput = { provided: false };
    if (userInput) {
        try {
            parsedUserInput = { provided: true, data: JSON.parse(userInput) };
        } catch {
            parsedUserInput = { provided: true, data: { notes: userInput } };
        }
    }

    // Create action record
    const action = await Action.create({
        userId: req.user._id,
        institutionId: req.user.institutionId,
        actionType,
        proofUrls,
        proofMetadata,
        userInput: parsedUserInput,
        submissionIp: req.ip,
        submissionUserAgent: req.get('User-Agent'),
        status: 'pending',
    });

    // Trigger async verification (non-blocking)
    verifyAction(action._id).catch(console.error);

    res.status(201).json({
        success: true,
        message: 'Action uploaded successfully. Verification in progress.',
        data: action,
    });
});

// @desc    Get user's actions
// @route   GET /api/actions/my-actions
// @access  Private
const getMyActions = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId: req.user._id };
    if (status) query.status = status;

    const actions = await Action.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Action.countDocuments(query);

    res.json({
        success: true,
        data: actions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

// @desc    Get action by ID
// @route   GET /api/actions/:id
// @access  Private
const getActionById = asyncHandler(async (req, res) => {
    const action = await Action.findById(req.params.id)
        .populate('userId', 'name email')
        .populate('reviewedBy', 'name');

    if (!action) {
        res.status(404);
        throw new Error('Action not found');
    }

    // Check if user owns the action or is admin
    if (action.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to view this action');
    }

    res.json({
        success: true,
        data: action,
    });
});

// @desc    Update action (admin only)
// @route   PUT /api/actions/:id
// @access  Private/Admin
const updateAction = asyncHandler(async (req, res) => {
    const action = await Action.findById(req.params.id);

    if (!action) {
        res.status(404);
        throw new Error('Action not found');
    }

    const { status, reviewNotes, impact } = req.body;

    if (status) action.status = status;
    if (reviewNotes) action.reviewNotes = reviewNotes;
    if (impact) action.impact = { ...action.impact, ...impact };

    action.reviewedBy = req.user._id;
    action.reviewedAt = Date.now();

    await action.save();

    // If approved, update user's stats and wallet
    if (status === 'approved' && action.impact.creditsEarned > 0) {
        await updateUserStats(action);
    }

    res.json({
        success: true,
        message: 'Action updated successfully',
        data: action,
    });
});

// @desc    Delete action
// @route   DELETE /api/actions/:id
// @access  Private
const deleteAction = asyncHandler(async (req, res) => {
    const action = await Action.findById(req.params.id);

    if (!action) {
        res.status(404);
        throw new Error('Action not found');
    }

    // Check if user owns the action or is admin
    if (action.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to delete this action');
    }

    // Can only delete pending actions
    if (action.status !== 'pending' && req.user.role !== 'admin') {
        res.status(400);
        throw new Error('Can only delete pending actions');
    }

    await action.remove();

    res.json({
        success: true,
        message: 'Action deleted successfully',
    });
});

// @desc    Get actions for admin review
// @route   GET /api/actions/admin/pending
// @access  Private/Admin
const getPendingActions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const actions = await Action.find({
        status: { $in: ['pending', 'verifying', 'flagged'] }
    })
        .populate('userId', 'name email institutionId')
        .sort({ createdAt: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Action.countDocuments({
        status: { $in: ['pending', 'verifying', 'flagged'] }
    });

    res.json({
        success: true,
        data: actions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

// @desc    Get fraud flagged actions
// @route   GET /api/actions/admin/fraud
// @access  Private/Admin
const getFraudActions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const fraudAlerts = await FraudAlert.find({ status: 'new' })
        .populate('userId', 'name email')
        .populate('actionId')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await FraudAlert.countDocuments({ status: 'new' });

    res.json({
        success: true,
        data: fraudAlerts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

// Helper: Verify action with AI services
async function verifyAction(actionId) {
    try {
        const action = await Action.findById(actionId);
        if (!action) return;

        // Update status to verifying
        action.status = 'verifying';
        await action.save();

        // Initialize verification results
        const verificationResults = {
            duplicateCheck: { passed: false, confidence: 0 },
            tamperCheck: { passed: false, confidence: 0 },
            anomalyCheck: { passed: false, confidence: 0 },
            trendCheck: { passed: false, confidence: 0 },
            sourceCheck: { passed: false, confidence: 0 },
            fraudDetection: { fraudProbability: 0, riskLevel: 'LOW' },
        };

        // 1. Check for duplicates
        for (const proof of action.proofUrls) {
            const duplicateResult = await callDuplicateCheck(proof);
            if (duplicateResult.is_duplicate) {
                verificationResults.duplicateCheck = {
                    passed: false,
                    confidence: duplicateResult.confidence,
                    details: 'Duplicate document detected',
                };

                // Create fraud alert
                await FraudAlert.create({
                    actionId: action._id,
                    userId: action.userId,
                    alertType: 'duplicate',
                    severity: 'high',
                    confidence: duplicateResult.confidence,
                    description: 'Duplicate document submitted',
                    detectedBy: 'duplicate_detector',
                });

                action.status = 'flagged';
                action.verificationResults = verificationResults;
                await action.save();
                return;
            }
        }

        verificationResults.duplicateCheck = {
            passed: true,
            confidence: 0.95,
        };

        // 2. Perform OCR (if applicable)
        if (action.actionType === 'electricity') {
            const ocrResult = await callOCRService(action.proofUrls[0]);
            if (ocrResult.success) {
                action.extractedData = {
                    ...action.extractedData,
                    ...ocrResult.data,
                };
            }
        }

        // 3. Check for anomalies
        if (action.extractedData.unitsConsumed) {
            const userActions = await Action.find({
                userId: action.userId,
                actionType: action.actionType,
                status: 'approved',
            }).sort({ createdAt: -1 }).limit(12);

            const history = userActions.map(a => a.extractedData.unitsConsumed);

            if (history.length > 0) {
                const anomalyResult = await callAnomalyDetection({
                    history,
                    current: action.extractedData.unitsConsumed,
                });

                verificationResults.anomalyCheck = {
                    passed: !anomalyResult.is_anomaly,
                    confidence: anomalyResult.confidence,
                    zScore: anomalyResult.z_score,
                };

                if (anomalyResult.is_anomaly) {
                    await FraudAlert.create({
                        actionId: action._id,
                        userId: action.userId,
                        alertType: 'anomaly',
                        severity: 'medium',
                        confidence: anomalyResult.confidence,
                        description: `Unusual consumption pattern detected (Z-score: ${anomalyResult.z_score})`,
            detectedBy: 'anomaly_detector',
          });
        }
      } else {
        verificationResults.anomalyCheck = {
          passed: true,
          confidence: 0.5,
          details: 'Insufficient history',
        };
      }
    }

    // 4. Calculate overall confidence
    const confidences = [
      verificationResults.duplicateCheck.confidence,
      verificationResults.anomalyCheck.confidence || 0.5,
    ];
    
    verificationResults.overallConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    verificationResults.verifiedAt = new Date();
    verificationResults.verifiedBy = 'system';

    // Auto-approve if high confidence
    if (verificationResults.overallConfidence > 0.8) {
      action.status = 'approved';
      
      // Calculate credits
      const impact = await calculateImpact(action);
      action.impact = impact;
      
      // Update user stats
      await updateUserStats(action);
    } else if (verificationResults.overallConfidence < 0.3) {
      action.status = 'flagged';
    } else {
      action.status = 'pending'; // Needs manual review
    }

    action.verificationResults = verificationResults;
    await action.save();

  } catch (error) {
    console.error('Verification failed:', error);
    
    // Update action status to pending (manual review needed)
    await Action.findByIdAndUpdate(actionId, {
      status: 'pending',
      'verificationResults.error': error.message,
    });
  }
}

// Helper: Calculate environmental impact
async function calculateImpact(action) {
  const impact = {
    co2SavedKg: 0,
    energySavedKwh: 0,
    waterSavedL: 0,
    wasteDivertedKg: 0,
    treesEquivalent: 0,
    creditsEarned: 0,
  };

  switch (action.actionType) {
    case 'electricity':
      if (action.extractedData.unitsConsumed) {
        // Assuming 0.82 kg CO2 per kWh (India grid average)
        impact.co2SavedKg = action.extractedData.unitsConsumed * 0.82;
        impact.energySavedKwh = action.extractedData.unitsConsumed;
        // 1 credit = 10 kg CO2
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
      }
      break;

    case 'solar':
      if (action.extractedData.capacity) {
        // Estimated annual generation: capacity * 4.5 * 365
        const annualKwh = action.extractedData.capacity * 4.5 * 365;
        impact.co2SavedKg = annualKwh * 0.95; // Solar vs grid
        impact.energySavedKwh = annualKwh;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
      }
      break;

    case 'transport':
      if (action.extractedData.distance) {
        // Car emission: 0.15 kg/km, Metro: 0.03 kg/km
        const savedPerKm = 0.12; // 0.15 - 0.03
        impact.co2SavedKg = action.extractedData.distance * savedPerKm;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
      }
      break;

    // Add other action types...
  }

  // Calculate trees equivalent (approx 20 kg CO2 per tree per year)
  impact.treesEquivalent = Math.round(impact.co2SavedKg / 20);

  impact.calculationFormula = 'Standard emission factors based on IPCC guidelines';
  impact.calculatedAt = new Date();

  return impact;
}

// Helper: Update user stats after approval
async function updateUserStats(action) {
  const user = await User.findById(action.userId);
  
  if (!user) return;

  // Update wallet
  user.walletBalance += action.impact.creditsEarned;
  user.totalCreditsEarned += action.impact.creditsEarned;
  
  // Update environmental metrics
  user.totalCO2Saved += action.impact.co2SavedKg;
  user.totalEnergySaved += action.impact.energySavedKwh;
  user.totalWaterSaved += action.impact.waterSavedL;
  
  // Update action counts
  user.actionsCount += 1;
  user.verifiedActionsCount += 1;
  
  // Recalculate sustainability score
  // Formula: (credits earned / max possible) * 100
  const maxPossibleCredits = 1000; // Adjust based on typical usage
  user.sustainabilityScore = Math.min(
    Math.round((user.totalCreditsEarned / maxPossibleCredits) * 100),
    100
  );
  
  user.lastActive = new Date();
  
  await user.save();
}

module.exports = {
  uploadAction,
  getMyActions,
  getActionById,
  updateAction,
  deleteAction,
  getPendingActions,
  getFraudActions,
};
