import { Router, Request, Response } from 'express';
import * as roomService from '../services/roomService';
import * as chatService from '../services/chatService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All room routes require auth
router.use(authMiddleware);

/**
 * GET /api/rooms — List active rooms
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const rooms = await roomService.getActiveRooms();
        res.json({ rooms });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/rooms/:id — Get room details with participants
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const roomState = await roomService.getRoomState(req.params.id);
        res.json(roomState);
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
});

/**
 * GET /api/rooms/:id/messages — Get paginated messages
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
    try {
        const cursor = req.query.cursor as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

        const result = await chatService.getMessages(req.params.id, cursor, limit);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
