import { Queue, QueueOptions } from 'bullmq';
import { loadEnv } from '@nod/shared/dist/config/env';

const { redisUrl } = loadEnv();

const baseQueueOptions: QueueOptions = {
    connection: {
        url: redisUrl,
    },
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
};

// Suggested queues from the operations runbook: bull:rewards, bull:alerts.
export const rewardsQueue = new Queue('rewards', baseQueueOptions);
export const alertsQueue = new Queue('alerts', baseQueueOptions);

export const queueForEventType = (eventType: string): Queue => {
    return eventType === 'ORDER_CREATED' ? rewardsQueue : alertsQueue;
};