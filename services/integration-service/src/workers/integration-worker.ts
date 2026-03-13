import { config } from '../config';
import {
  getOutboundQueue,
  processEMROrderJob,
  processHL7ResultJob,
  processFHIRNotificationJob,
} from '../services/outbound-service';
import logger from '../utils/logger';

export function startIntegrationWorker(): void {
  const queue = getOutboundQueue();

  queue.process('emr_order', config.queue.concurrency, async (job) => {
    logger.info('Worker: Processing emr_order job', { jobId: job.id });
    await processEMROrderJob(job);
  });

  queue.process('hl7_result', config.queue.concurrency, async (job) => {
    logger.info('Worker: Processing hl7_result job', { jobId: job.id });
    await processHL7ResultJob(job);
  });

  queue.process('fhir_notification', config.queue.concurrency, async (job) => {
    logger.info('Worker: Processing fhir_notification job', { jobId: job.id });
    await processFHIRNotificationJob(job);
  });

  queue.on('completed', (job) => {
    logger.info('Worker: Job completed', { jobId: job.id, type: job.data.type });
  });

  queue.on('failed', (job, err) => {
    logger.error('Worker: Job failed', {
      jobId: job.id,
      type: job.data.type,
      attempt: job.attemptsMade,
      error: err.message,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn('Worker: Job stalled', { jobId: job.id });
  });

  queue.on('error', (error) => {
    logger.error('Worker: Queue error', { error: error.message });
  });

  logger.info('Integration worker started', { concurrency: config.queue.concurrency });
}

export async function stopIntegrationWorker(): Promise<void> {
  const queue = getOutboundQueue();
  await queue.close();
  logger.info('Integration worker stopped');
}

export async function getQueueStats() {
  const queue = getOutboundQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
