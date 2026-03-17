const Action = require('../models/Action');
const User = require('../models/User');
const FraudAlert = require('../models/FraudAlert');
const asyncHandler = require('../utils/asyncHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { callOCRService, callDuplicateCheck, callAnomalyDetection, callFraudAnalysis, callTamperDetection, getPHash } = require('../services/aiService');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

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

// Helper: Calculate Hamming Distance between two hex strings
const calculateHammingDistance = (h1, h2) => {
    if (!h1 || !h2 || h1.length !== h2.length) return 999;
    let distance = 0;
    for (let i = 0; i < h1.length; i++) {
        const char1 = parseInt(h1[i], 16);
        const char2 = parseInt(h2[i], 16);
        let xor = char1 ^ char2;
        while (xor > 0) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
};

// @desc    Upload new action (bill/proof)
// @route   POST /api/actions/upload
// @access  Private
const uploadAction = asyncHandler(async (req, res) => {
    const { actionType, userInput, latitude, longitude } = req.body;
    console.log(`[Upload Process] Started upload for action: ${actionType}`);
    console.log(`[Upload Process] Received ${req.files?.length || 0} files`);

    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('Please upload at least one proof document');
    }

    const files = req.files;
    const proofUrls = [];
    const proofMetadata = [];

    for (const file of files) {
        // Generate SHA-256 hash for duplicate detection
        const fileBuffer = await fs.readFile(file.path);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Calculate PHash for similar image detection
        const filePHash = await getPHash(fileBuffer);

        // Check for exact content match (SHA-256)
        const exactDuplicate = await Action.findOne({ 'proofMetadata.hash': fileHash });
        
        let similarDuplicate = null;
        if (!exactDuplicate && filePHash) {
            // Check for similar content (Perceptual Hash) - Global search across all action types
            const candidates = await Action.find({ 
                'proofMetadata.phash': { $exists: true } 
            }).select('proofMetadata.phash');

            for (const cand of candidates) {
                for (const meta of cand.proofMetadata) {
                    if (meta.phash && calculateHammingDistance(filePHash, meta.phash) <= 5) {
                        similarDuplicate = cand;
                        break;
                    }
                }
                if (similarDuplicate) break;
            }
        }

        const isDuplicate = !!(exactDuplicate || similarDuplicate);

        if (isDuplicate) {
            console.log(`[Duplicate Detection] Hard blocking duplicate. Exact: ${!!exactDuplicate}, Similar: ${!!similarDuplicate}`);
            res.status(400);
            // Clean up files before throwing
            await fs.unlink(file.path).catch(console.error);
            throw new Error(`File "${file.originalname}" has already been uploaded by someone else.`);
        }

        let fileUrl;
        let publicId;

        if (isCloudinaryConfigured()) {
            const result = await uploadToCloudinary(file.path, {
                folder: `greenledger/actions/${req.user._id}`,
                resource_type: 'auto',
            });
            fileUrl = result.secure_url;
            publicId = result.public_id;
            await fs.unlink(file.path).catch(console.error);
        } else {
            fileUrl = buildLocalUrl(file);
            publicId = path.basename(file.path);
        }

        proofUrls.push(fileUrl);
        proofMetadata.push({
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
            hash: fileHash,
            phash: filePHash,
            isDuplicate: false, // Should always be false here since we block duplicates above
            duplicateType: null
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

    console.log(`[Database Record Transition] Creating record with ${proofMetadata.length} entries in metadata`);
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
        submissionLocation: latitude && longitude ? { lat: latitude, lng: longitude } : undefined,
        extractedData: {
            ...(parsedUserInput.provided ? parsedUserInput.data : {}), // Keep existing parsed user input
            location: latitude && longitude ? { lat: latitude, lng: longitude } : undefined,
        },
        status: 'pending',
    });
    console.log(`[Database Record Creation] Action ${action._id} created with initial status: ${action.status}`);

    // If duplicate, set impact to zero immediately
    if (action.status === 'flagged') {
        action.impact = {
            creditsEarned: 0,
            co2SavedKg: 0,
            calculationFormula: 'Duplicate file content detected: 0 credits awarded',
            calculatedAt: new Date()
        };
        await action.save();
    }

    // Trigger async verification (only if not already flagged as duplicate)
    if (action.status !== 'flagged') {
        verifyAction(action._id).catch(console.error);
    }

    res.status(201).json({
        success: true,
        message: action.status === 'flagged' ? 'Action recorded (Duplicate detected - 0 credits)' : 'Action uploaded successfully. Verification in progress.',
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
            duplicateCheck: { passed: true, confidence: 1 },
            tamperCheck: { passed: true, confidence: 0.9 },
            anomalyCheck: { passed: true, confidence: 0.9 },
            trendCheck: { passed: true, confidence: 0.9 },
            sourceCheck: { passed: true, confidence: 0.9 },
            fraudDetection: { fraudProbability: 0.01, riskLevel: 'LOW' },
            verifiedAt: new Date(),
            verifiedBy: 'system',
            overallConfidence: 0.95
        };

        // 0. SECONDARY DUPLICATE GUARD
        const currentFileHashes = action.proofMetadata.map(m => m.hash);
        const currentFilenames = action.proofMetadata.map(m => m.filename);
        
        const possibleDuplicate = await Action.findOne({
            _id: { $ne: action._id },
            $or: [
                { 'proofMetadata.hash': { $in: currentFileHashes } }
            ]
        });

        if (possibleDuplicate) {
            console.log(`[VerifyAction] Duplicate detected after upload for action ${action._id}. Flagging.`);
            action.status = 'flagged';
            action.impact.creditsEarned = 0;
            action.impact.calculationFormula = 'Duplicate submission detected during verification';
            await action.save();
            return;
        }

        // 1. Check for duplicates (keeping some security)
        for (const proof of action.proofUrls) {
            const duplicateResult = await callDuplicateCheck(proof);
            if (duplicateResult.is_duplicate) {
                verificationResults.duplicateCheck = {
                    passed: false,
                    confidence: duplicateResult.confidence,
                    details: 'Duplicate document detected',
                };
                verificationResults.overallConfidence = 0.2;

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

        // 2. Perform OCR (if applicable)
        if (action.actionType === 'electricity') {
            const ocrResult = await callOCRService(action.proofUrls[0]);
            if (ocrResult.success) {
                action.extractedData = { ...action.extractedData, ...ocrResult.data };
            }
        }

        // 3. TAMPER DETECTION
        const tamperResult = await callTamperDetection(action.proofUrls[0]);
        verificationResults.tamperCheck = {
            passed: tamperResult.risk_level !== 'HIGH',
            confidence: 1 - (tamperResult.tamper_score || 0),
            details: tamperResult.risk_level === 'HIGH' ? 'Potential document tampering detected' : 'No tampering detected'
        };

        // 4. COLLECT ENSEMBLE FEATURES
        const user = await User.findById(action.userId);
        const lastAction = await Action.findOne({
            userId: action.userId,
            _id: { $ne: action._id }
        }).sort({ createdAt: -1 });

        const historyCount = await Action.countDocuments({ userId: action.userId, status: 'approved' });
        const avgValueRecord = await Action.aggregate([
            { $match: { userId: action.userId, actionType: action.actionType, status: 'approved' } },
            { $group: { _id: null, avg: { $avg: '$impact.creditsEarned' } } }
        ]);

        const fraudFeatures = {
            tamper_score: tamperResult.tamper_score || 0,
            metadata_risk: 0.1, // Placeholder
            z_score: 0.5, // Placeholder
            trend_deviation: 0.2, // Placeholder
            user_history_length: historyCount,
            previous_fraud_count: 0, // Should be fetched from a fraud history log
            submission_hour: new Date(action.createdAt).getHours(),
            is_weekend: [0, 6].includes(new Date(action.createdAt).getDay()),
            claimed_value: 0, // Will be calculated below
            has_qr: false,
            proof_count: action.proofUrls.length,
            action_type: action.actionType,
            time_since_last_action: lastAction ? (new Date(action.createdAt) - new Date(lastAction.createdAt)) / (1000 * 60 * 60) : 168,
            avg_claim_value: avgValueRecord[0]?.avg || 0
        };

        // 5. CALL ENSEMBLE FRAUD ANALYSIS
        const fraudResult = await callFraudAnalysis(fraudFeatures);
        verificationResults.fraudDetection = {
            fraudProbability: fraudResult.fraud_probability,
            riskLevel: fraudResult.risk_level,
            factors: fraudResult.contributing_factors || []
        };
        verificationResults.overallConfidence = 1 - fraudResult.fraud_probability;

        // Rejection if critical risk
        if (fraudResult.risk_level === 'CRITICAL' || fraudResult.risk_level === 'HIGH') {
            action.status = 'flagged';
            action.verificationResults = verificationResults;
            
            await FraudAlert.create({
                actionId: action._id,
                userId: action.userId,
                alertType: 'ensemble_ml',
                severity: fraudResult.risk_level.toLowerCase(),
                confidence: fraudResult.fraud_probability,
                description: `Ensemble ML detected ${fraudResult.risk_level} risk: ${fraudResult.contributing_factors?.join(', ')}`,
                detectedBy: 'ensemble_detector',
            });
            
            await action.save();
            return;
        }

        // 6. Anomaly Detection (Direct)
        const anomalyResult = await callAnomalyDetection(action);
        verificationResults.anomalyCheck = {
            passed: !anomalyResult.is_anomaly,
            confidence: 1 - (anomalyResult.confidence || 0)
        };

        // AUTO-APPROVE if checks pass
        action.status = 'approved';

        // Calculate credits based on the new rules
        // Award zero credits if direct anomaly detected OR ensemble probability > 0.4
        const impact = await calculateImpact(action, anomalyResult.is_anomaly || fraudResult.fraud_probability > 0.4);
        action.impact = impact;

        // Update user stats and wallet
        await updateUserStats(action);

        action.verificationResults = verificationResults;
        await action.save();

    } catch (error) {
        console.error('Verification/Auto-approval failed:', error);
        // Fallback to manual review (pending) if system fails
        await Action.findByIdAndUpdate(actionId, {
            status: 'pending',
            'verificationResults.error': error.message,
        });
    }
}

// Helper: Calculate environmental impact
async function calculateImpact(action, isAnomaly = false) {
    const impact = {
        co2SavedKg: 0,
        energySavedKwh: 0,
        waterSavedL: 0,
        wasteDivertedKg: 0,
        treesEquivalent: 0,
        creditsEarned: 0,
    };

    // If an anomaly is detected, award zero credits as requested
    if (isAnomaly) {
        impact.creditsEarned = 0;
        impact.calculationFormula = 'Anomaly detected: Zero credits awarded';
        impact.calculatedAt = new Date();
        return impact;
    }

    switch (action.actionType) {
        case 'electricity':
            // Rule: Electricity = 2 credits
            impact.creditsEarned = 2;
            impact.co2SavedKg = (action.extractedData.unitsConsumed || 10) * 0.82;
            break;

        case 'solar':
            // Rule: Solar = 10 credits
            impact.creditsEarned = 10;
            impact.co2SavedKg = 50; // Estimated
            break;

        case 'ev':
            // Rule: Electric Vehicle = 5 credits
            impact.creditsEarned = 5;
            impact.co2SavedKg = 20; // Estimated
            break;

        case 'transport':
            // Rule: Public Transport = 1 credit
            impact.creditsEarned = 1;
            impact.co2SavedKg = (action.extractedData.distance || 10) * 0.12;
            break;

        case 'water':
            // Rule: Water Conservation = 8 credits
            impact.creditsEarned = 8;
            impact.waterSavedL = action.extractedData.volume || 100;
            break;

        case 'tree':
            // Tiered logic: 1st time = 1, 2nd time = 2, 3rd+ time = 3
            const treeCount = await Action.countDocuments({
                userId: action.userId,
                actionType: 'tree',
                status: 'approved',
                _id: { $ne: action._id } // Don't count the current one if it was already marked as approved in some race condition
            });

            if (treeCount === 0) {
                impact.creditsEarned = 1; // Planting
            } else if (treeCount === 1) {
                impact.creditsEarned = 2; // Medium level growing
            } else {
                impact.creditsEarned = 3; // Plantation of tree
            }
            impact.treesEquivalent = 1;
            break;
    }

    impact.calculationFormula = 'Custom credit rules as specified by user';
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
