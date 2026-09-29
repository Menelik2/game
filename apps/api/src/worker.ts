import { Logger } from '@nestjs/common';

/**
 * Background worker entrypoint.
 * In production this would consume Redis/BullMQ jobs for:
 * - email, notifications, payment reconciliation
 * - bonus expiration, fraud analysis, reports
 */
const logger = new Logger('Worker');
logger.log('Apex Casino worker started (idle – no queues configured in demo yet)');

setInterval(() => {
  // heartbeat
}, 60_000);
