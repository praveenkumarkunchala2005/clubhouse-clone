import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from './env';
import { logger } from '../utils/logger';

export async function createRedisAdapter() {
    const pubClient = createClient({ url: env.REDIS_URL });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error({ err }, 'Redis pub client error'));
    subClient.on('error', (err) => logger.error({ err }, 'Redis sub client error'));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    logger.info('✅ Redis connected');

    return createAdapter(pubClient, subClient);
}

export async function createRedisClient() {
    const client = createClient({ url: env.REDIS_URL });
    client.on('error', (err) => logger.error({ err }, 'Redis client error'));
    await client.connect();
    return client;
}
