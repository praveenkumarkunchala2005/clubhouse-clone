import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/health — System health check
 */
router.get('/', async (_req: Request, res: Response) => {
    const checks: Record<string, string> = {};

    // Check Supabase
    try {
        const { error } = await supabase.from('rooms').select('id').limit(1);
        checks.supabase = error ? 'unhealthy' : 'healthy';
    } catch {
        checks.supabase = 'unhealthy';
    }

    const allHealthy = Object.values(checks).every((v) => v === 'healthy');

    if (!allHealthy) {
        logger.warn({ checks }, 'Health check: some services unhealthy');
    }

    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
    });
});

export default router;
