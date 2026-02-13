import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface AuthUser {
    id: string;
    email?: string;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

// Extend Socket.io socket data
declare module 'socket.io' {
    interface SocketData {
        user?: AuthUser;
    }
}

// JWKS client for fetching Supabase public keys (RS256)
const jwks = jwksClient({
    jwksUri: `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000, // 10 minutes
});

/**
 * Get the signing key from JWKS endpoint
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
    if (header.alg && header.alg.startsWith('HS')) {
        // HMAC algorithm — use shared secret (legacy Supabase projects)
        callback(null, env.SUPABASE_JWT_SECRET);
    } else {
        // Asymmetric algorithm (RS256, etc.) — fetch public key from JWKS
        jwks.getSigningKey(header.kid, (err, key) => {
            if (err) {
                callback(err);
                return;
            }
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
        });
    }
}

/**
 * Verify a Supabase JWT token (supports both RS256 and HS256)
 */
function verifyToken(token: string): Promise<AuthUser> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, getKey, {
            algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'HS256', 'HS384', 'HS512'],
        }, (err, decoded: any) => {
            if (err) {
                reject(err);
                return;
            }
            if (!decoded?.sub) {
                reject(new Error('Invalid token: missing sub claim'));
                return;
            }
            resolve({
                id: decoded.sub,
                email: decoded.email,
            });
        });
    });
}

/**
 * Express middleware for JWT authentication
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = await verifyToken(token);
        next();
    } catch (err) {
        logger.warn({ err }, 'JWT verification failed');
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Socket.io middleware for JWT authentication
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    verifyToken(token)
        .then((user) => {
            socket.data.user = user;
            logger.debug({ userId: user.id }, 'Socket authenticated');
            next();
        })
        .catch((err) => {
            logger.warn({ err }, 'Socket JWT verification failed');
            next(new Error('Invalid or expired token'));
        });
}

