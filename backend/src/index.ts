import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env';
import { createRedisAdapter } from './config/redis';
import { socketAuthMiddleware } from './middleware/auth';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { registerSocketHandlers } from './socket/handlers';
import { clearAllGracePeriods } from './socket/gracePeriod';
import roomsRouter from './routes/rooms';
import healthRouter from './routes/health';
import { logger } from './utils/logger';

async function main() {
    // ---- Express App ----
    const app = express();
    const server = http.createServer(app);

    // Security middleware
    app.use(helmet());
    app.use(cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
    }));
    app.use(express.json({ limit: '10kb' }));
    app.use(apiRateLimiter);

    // Request logging
    app.use((req, _res, next) => {
        logger.debug({ method: req.method, url: req.url }, 'Request');
        next();
    });

    // Routes
    app.use('/api/health', healthRouter);
    app.use('/api/rooms', roomsRouter);

    // Error handler
    app.use(errorHandler);

    // ---- Socket.io Server ----
    const io = new SocketIOServer(server, {
        cors: {
            origin: env.CORS_ORIGIN,
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
        connectionStateRecovery: {
            maxDisconnectionDuration: 30000,
        },
    });

    // Redis adapter for horizontal scaling
    try {
        const adapter = await createRedisAdapter();
        io.adapter(adapter);
        logger.info('✅ Socket.io Redis adapter connected');
    } catch (err) {
        logger.warn({ err }, '⚠️ Redis adapter failed — running without horizontal scaling');
    }

    // Socket auth middleware
    io.use(socketAuthMiddleware);

    // Register socket handlers
    registerSocketHandlers(io);

    // ---- Start Server ----
    server.listen(parseInt(env.PORT), () => {
        logger.info(`🚀 Server running on port ${env.PORT}`);
        logger.info(`📡 Socket.io ready`);
        logger.info(`🔗 CORS origin: ${env.CORS_ORIGIN}`);
    });

    // ---- Graceful Shutdown ----
    const shutdown = async () => {
        logger.info('Shutting down gracefully...');
        clearAllGracePeriods();
        io.close();
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });

        // Force exit after 10 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

main().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
});
