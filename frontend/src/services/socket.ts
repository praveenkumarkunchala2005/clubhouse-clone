import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// In development, use empty string to go through Vite proxy (avoids CORS).
const BACKEND_URL = import.meta.env.PROD ? (import.meta.env.VITE_BACKEND_URL || '') : '';

export function getSocket(): Socket {
    if (!socket) {
        throw new Error('Socket not initialized. Call initSocket first.');
    }
    return socket;
}

export function initSocket(token: string): Socket {
    if (socket?.connected) {
        return socket;
    }

    socket = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
    });

    socket.on('connect', () => {
        console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message);
    });

    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Emit a socket event with acknowledgement
 */
export function emitWithAck<T = any>(
    event: string,
    data: any
): Promise<{ success: boolean; data?: T; error?: string }> {
    return new Promise((resolve, reject) => {
        const s = getSocket();
        const timeout = setTimeout(() => {
            reject(new Error(`Socket event '${event}' timed out`));
        }, 10000);

        s.emit(event, data, (response: any) => {
            clearTimeout(timeout);
            resolve(response);
        });
    });
}
