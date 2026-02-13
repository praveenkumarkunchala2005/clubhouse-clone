import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Express API rate limiter
export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        logger.warn('Rate limit exceeded');
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
    },
});

// Socket.io event rate limiter (in-memory per socket)
const socketRateLimits = new Map<string, { count: number; resetAt: number }>();

export function socketRateLimit(socketId: string, maxPerMinute: number = 60): boolean {
    const now = Date.now();
    const entry = socketRateLimits.get(socketId);

    if (!entry || now > entry.resetAt) {
        socketRateLimits.set(socketId, { count: 1, resetAt: now + 60000 });
        return true;
    }

    entry.count++;
    if (entry.count > maxPerMinute) {
        logger.warn({ socketId }, 'Socket rate limit exceeded');
        return false;
    }

    return true;
}

export function cleanupSocketRateLimit(socketId: string): void {
    socketRateLimits.delete(socketId);
}
