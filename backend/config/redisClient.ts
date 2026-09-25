import { createClient, RedisClientType } from 'redis';
import { loadEnv } from '@nod/shared/dist/config/env';

// Use a singleton to ensure only one connection pool exists
let redisClient: RedisClientType;

const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    const { redisUrl } = loadEnv();
    redisClient = createClient({
      url: redisUrl,
      // Add reconnection strategy for production stability
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis connection lost');
          }
          return Math.min(retries * 100, 3000); // Backoff strategy
        }
      }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('🚀 Redis Connected'));
  }
  return redisClient;
};

export const redis = getRedisClient();

// Initial connection
export const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
};