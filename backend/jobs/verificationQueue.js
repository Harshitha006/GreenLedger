let verificationQueue = null;
let queueAvailable = false;

const verificationService = require('../services/verificationService');
const Action = require('../models/Action');
const logger = require('../config/logger');

// Try to set up Bull queue - gracefully degrade if Redis is unavailable
try {
  const Queue = require('bull');

  verificationQueue = new Queue('action verification', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false
    }
  });

  // Process jobs
  verificationQueue.process(async (job) => {
    const { actionId } = job.data;
    logger.info(`Processing verification job for action: ${actionId}, attempt: ${job.attemptsMade + 1}`);
    try {
      const result = await verificationService.verifyAction(actionId);
      await job.progress(100);
      return result;
    } catch (error) {
      logger.error(`Verification job failed for action ${actionId}:`, error);
      if (job.attemptsMade >= 2) {
        await Action.findByIdAndUpdate(actionId, {
          status: 'needs_review',
          'verificationResults.error': 'Max verification attempts reached'
        });
      }
      throw error;
    }
  });

  verificationQueue.on('error', (err) => {
    if (!queueAvailable) return; // suppress repeated errors
    logger.warn('Verification queue error (Redis may be unavailable):', err.message);
    queueAvailable = false;
  });

  verificationQueue.on('ready', () => {
    logger.info('✅ Verification queue connected to Redis');
    queueAvailable = true;
  });

  verificationQueue.on('completed', (job, result) => {
    logger.info(`Verification job ${job.id} completed for action ${job.data.actionId}. Status: ${result?.status}`);
  });

  verificationQueue.on('failed', (job, error) => {
    logger.error(`Verification job ${job.id} failed for action ${job.data.actionId}:`, error);
  });

  verificationQueue.on('stalled', (job) => {
    logger.warn(`Verification job ${job.id} stalled`);
  });

} catch (err) {
  logger.warn('⚠️  Bull/Redis queue not available. Verification will run synchronously.');
}

// Add job to queue (falls back to synchronous verification if Redis unavailable)
const addToVerificationQueue = async (actionId, priority = 1) => {
  if (verificationQueue && queueAvailable) {
    try {
      const job = await verificationQueue.add(
        { actionId },
        { priority, attempts: 3, jobId: `verify-${actionId}` }
      );
      logger.info(`Added action ${actionId} to verification queue. Job ID: ${job.id}`);
      return job;
    } catch (error) {
      logger.warn(`Queue unavailable, running verification synchronously for ${actionId}`);
    }
  }

  // Fallback: run synchronously
  logger.info(`Running synchronous verification for action: ${actionId}`);
  await verificationService.verifyAction(actionId);
  return { id: `sync-${actionId}` };
};

// Get queue status (returns zeros if Redis unavailable)
const getQueueStatus = async () => {
  if (!verificationQueue || !queueAvailable) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0, mode: 'synchronous' };
  }
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      verificationQueue.getWaitingCount(),
      verificationQueue.getActiveCount(),
      verificationQueue.getCompletedCount(),
      verificationQueue.getFailedCount()
    ]);
    return { waiting, active, completed, failed, total: waiting + active + completed + failed, mode: 'queue' };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0, mode: 'synchronous' };
  }
};

// Clean old jobs
const cleanOldJobs = async () => {
  if (!verificationQueue || !queueAvailable) return;
  try {
    await verificationQueue.clean(24 * 3600 * 1000, 'completed');
    await verificationQueue.clean(7 * 24 * 3600 * 1000, 'failed');
  } catch (err) {
    logger.warn('Could not clean old jobs:', err.message);
  }
};

module.exports = {
  verificationQueue,
  addToVerificationQueue,
  getQueueStatus,
  cleanOldJobs
};

