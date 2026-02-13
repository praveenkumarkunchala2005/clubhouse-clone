import { logger } from '../utils/logger';

// Map of `userId:roomId` → timeout handle
const gracePeriods = new Map<string, NodeJS.Timeout>();

const GRACE_PERIOD_MS = 30_000; // 30 seconds

function makeKey(userId: string, roomId: string): string {
    return `${userId}:${roomId}`;
}

/**
 * Start a grace period for a disconnected user.
 * After 30 seconds, the callback is invoked to finalize disconnection.
 */
export function startGracePeriod(
    userId: string,
    roomId: string,
    onExpired: () => void
): void {
    const key = makeKey(userId, roomId);

    // Clear any existing grace period
    clearGracePeriod(userId, roomId);

    logger.info({ userId, roomId }, `Grace period started (${GRACE_PERIOD_MS / 1000}s)`);

    const timeout = setTimeout(() => {
        gracePeriods.delete(key);
        logger.info({ userId, roomId }, 'Grace period expired — removing participant');
        onExpired();
    }, GRACE_PERIOD_MS);

    gracePeriods.set(key, timeout);
}

/**
 * Cancel a grace period (user reconnected within window)
 */
export function clearGracePeriod(userId: string, roomId: string): boolean {
    const key = makeKey(userId, roomId);
    const timeout = gracePeriods.get(key);

    if (timeout) {
        clearTimeout(timeout);
        gracePeriods.delete(key);
        logger.info({ userId, roomId }, 'Grace period cancelled — user reconnected');
        return true;
    }

    return false;
}

/**
 * Check if a user has an active grace period
 */
export function hasGracePeriod(userId: string, roomId: string): boolean {
    return gracePeriods.has(makeKey(userId, roomId));
}

/**
 * Clean up all grace periods (for shutdown)
 */
export function clearAllGracePeriods(): void {
    for (const [key, timeout] of gracePeriods) {
        clearTimeout(timeout);
    }
    gracePeriods.clear();
}
