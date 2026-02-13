import { Server, Socket } from 'socket.io';
import * as roomService from '../services/roomService';
import * as participantService from '../services/participantService';
import * as chatService from '../services/chatService';
import { startGracePeriod, clearGracePeriod } from './gracePeriod';
import { socketRateLimit, cleanupSocketRateLimit } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

type Callback = (response: { success: boolean; data?: any; error?: string }) => void;

function success(cb: Callback, data?: any) {
    cb({ success: true, data });
}

function fail(cb: Callback, error: string) {
    cb({ success: false, error });
}

export function registerSocketHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        const user = socket.data.user!;
        logger.info({ userId: user.id, socketId: socket.id }, 'Socket connected');

        // ==========================================
        // ROOM EVENTS
        // ==========================================

        socket.on('create_room', async (data: { title: string; type?: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                const result = await roomService.createRoom(user.id, data.title, (data.type as any) || 'public');
                socket.join(result.room.id);
                await roomService.updateSocketId(user.id, result.room.id, socket.id);

                // Notify lobby
                io.emit('room_created', {
                    room: result.room,
                    participant_count: 1,
                });

                success(cb, {
                    room: result.room,
                    participant: result.participant,
                    livekitToken: result.livekitToken,
                });
            } catch (err: any) {
                logger.error({ err }, 'create_room failed');
                fail(cb, err.message);
            }
        });

        socket.on('join_room', async (data: { roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                // Clear any grace period for this user in this room
                clearGracePeriod(user.id, data.roomId);

                const result = await roomService.joinRoom(user.id, data.roomId, socket.id);
                socket.join(data.roomId);

                // Get full room state
                const roomState = await roomService.getRoomState(data.roomId);

                // Notify other participants
                socket.to(data.roomId).emit('participant_joined', {
                    participant: result.participant,
                });

                // Update lobby
                io.emit('room_updated', {
                    roomId: data.roomId,
                    participant_count: roomState.participants.length,
                });

                // Get recent messages
                const { messages } = await chatService.getMessages(data.roomId, undefined, 50);
                // The service returns newest first, so reverse them for the client
                const chronologicalMessages = messages.reverse();

                success(cb, {
                    room: result.room,
                    participant: result.participant,
                    livekitToken: result.livekitToken,
                    participants: roomState.participants,
                    messages: chronologicalMessages,
                });
            } catch (err: any) {
                logger.error({ err }, 'join_room failed');
                fail(cb, err.message);
            }
        });

        socket.on('leave_room', async (data: { roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                await roomService.leaveRoom(user.id, data.roomId);
                socket.leave(data.roomId);

                // Notify room
                socket.to(data.roomId).emit('participant_left', {
                    userId: user.id,
                });

                // Update lobby
                const roomState = await roomService.getRoomState(data.roomId);
                io.emit('room_updated', {
                    roomId: data.roomId,
                    participant_count: roomState.participants.length,
                });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'leave_room failed');
                fail(cb, err.message);
            }
        });

        socket.on('end_room', async (data: { roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                await roomService.endRoom(user.id, data.roomId);

                // Notify all participants
                io.to(data.roomId).emit('room_ended', { roomId: data.roomId });

                // Make all sockets leave the room
                const sockets = await io.in(data.roomId).fetchSockets();
                for (const s of sockets) {
                    s.leave(data.roomId);
                }

                // Update lobby
                io.emit('room_removed', { roomId: data.roomId });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'end_room failed');
                fail(cb, err.message);
            }
        });

        // ==========================================
        // ROLE & MIC EVENTS
        // ==========================================

        socket.on('request_mic', async (data: { roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                // Get room host/co-hosts
                const roomState = await roomService.getRoomState(data.roomId);
                const hosts = roomState.participants.filter(
                    (p: any) => p.role === 'host' || p.role === 'co-host'
                );

                // Emit mic request to hosts
                for (const host of hosts) {
                    const hostSockets = await io.in(data.roomId).fetchSockets();
                    for (const hs of hostSockets) {
                        if (hs.data.user?.id === host.user_id) {
                            hs.emit('mic_requested', {
                                userId: user.id,
                                roomId: data.roomId,
                            });
                        }
                    }
                }

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'request_mic failed');
                fail(cb, err.message);
            }
        });

        socket.on('grant_mic', async (data: { targetId: string; roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                const result = await participantService.grantMic(user.id, data.targetId, data.roomId);

                // Notify the target user with their new token
                const targetSockets = await io.in(data.roomId).fetchSockets();
                for (const ts of targetSockets) {
                    if (ts.data.user?.id === data.targetId) {
                        ts.emit('mic_granted', {
                            participant: result.participant,
                            livekitToken: result.livekitToken,
                        });
                    }
                }

                // Notify room about role change
                io.to(data.roomId).emit('participant_updated', {
                    participant: result.participant,
                });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'grant_mic failed');
                fail(cb, err.message);
            }
        });

        socket.on('revoke_mic', async (data: { targetId: string; roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                const result = await participantService.revokeMic(user.id, data.targetId, data.roomId);

                // Notify the target user
                const targetSockets = await io.in(data.roomId).fetchSockets();
                for (const ts of targetSockets) {
                    if (ts.data.user?.id === data.targetId) {
                        ts.emit('mic_revoked', {
                            participant: result.participant,
                            livekitToken: result.livekitToken,
                        });
                    }
                }

                // Notify room
                io.to(data.roomId).emit('participant_updated', {
                    participant: result.participant,
                });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'revoke_mic failed');
                fail(cb, err.message);
            }
        });

        socket.on('promote_user', async (data: { targetId: string; roomId: string; role: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                const result = await participantService.promoteUser(
                    user.id,
                    data.targetId,
                    data.roomId,
                    data.role as any
                );

                // Notify target with new token
                if (result.livekitToken) {
                    const targetSockets = await io.in(data.roomId).fetchSockets();
                    for (const ts of targetSockets) {
                        if (ts.data.user?.id === data.targetId) {
                            ts.emit('role_changed', {
                                participant: result.participant,
                                livekitToken: result.livekitToken,
                            });
                        }
                    }
                }

                // Notify room
                io.to(data.roomId).emit('participant_updated', {
                    participant: result.participant,
                });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'promote_user failed');
                fail(cb, err.message);
            }
        });

        socket.on('demote_user', async (data: { targetId: string; roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                const result = await participantService.demoteUser(user.id, data.targetId, data.roomId);

                // Notify target with new token
                const targetSockets = await io.in(data.roomId).fetchSockets();
                for (const ts of targetSockets) {
                    if (ts.data.user?.id === data.targetId) {
                        ts.emit('role_changed', {
                            participant: result.participant,
                            livekitToken: result.livekitToken,
                        });
                    }
                }

                // Notify room
                io.to(data.roomId).emit('participant_updated', {
                    participant: result.participant,
                });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'demote_user failed');
                fail(cb, err.message);
            }
        });

        socket.on('remove_user', async (data: { targetId: string; roomId: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                await participantService.removeUser(user.id, data.targetId, data.roomId);

                // Notify the removed user
                const targetSockets = await io.in(data.roomId).fetchSockets();
                for (const ts of targetSockets) {
                    if (ts.data.user?.id === data.targetId) {
                        ts.emit('removed_from_room', { roomId: data.roomId });
                        ts.leave(data.roomId);
                    }
                }

                // Notify room
                io.to(data.roomId).emit('participant_left', {
                    userId: data.targetId,
                    removed: true,
                });

                success(cb);
            } catch (err: any) {
                logger.error({ err }, 'remove_user failed');
                fail(cb, err.message);
            }
        });

        // ==========================================
        // CHAT EVENTS
        // ==========================================

        socket.on('send_message', async (data: { roomId: string; content: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id, 30)) return fail(cb, 'Rate limit exceeded');
            try {
                const message = await chatService.sendMessage(user.id, data.roomId, data.content);

                // Broadcast to room
                io.to(data.roomId).emit('receive_message', { message });

                success(cb, { message });
            } catch (err: any) {
                logger.error({ err }, 'send_message failed');
                fail(cb, err.message);
            }
        });

        // ==========================================
        // RECONNECT EVENTS
        // ==========================================

        socket.on('restore_room_state', async (data: { roomId: string; lastMessageAt?: string }, cb: Callback) => {
            if (!socketRateLimit(socket.id)) return fail(cb, 'Rate limit exceeded');
            try {
                // Clear grace period
                clearGracePeriod(user.id, data.roomId);

                // Restore participant connection
                await roomService.updateSocketId(user.id, data.roomId, socket.id);
                socket.join(data.roomId);

                // Get full room state
                const roomState = await roomService.getRoomState(data.roomId);

                // Get missed messages
                let missedMessages: any[] = [];
                if (data.lastMessageAt) {
                    missedMessages = await chatService.getMessagesSince(data.roomId, data.lastMessageAt);
                }

                // Get participant info for LiveKit token
                const myParticipant = roomState.participants.find((p: any) => p.user_id === user.id);
                let livekitToken: string | undefined;

                if (myParticipant) {
                    const canPublish = ['host', 'co-host', 'speaker'].includes(myParticipant.role);
                    const { generateLiveKitToken } = await import('../config/livekit');
                    livekitToken = await generateLiveKitToken(user.id, data.roomId, {
                        canPublish,
                        canSubscribe: true,
                    });
                }

                // Notify room that user reconnected
                socket.to(data.roomId).emit('participant_reconnected', {
                    userId: user.id,
                });

                success(cb, {
                    room: roomState.room,
                    participants: roomState.participants,
                    missedMessages,
                    livekitToken,
                });
            } catch (err: any) {
                logger.error({ err }, 'restore_room_state failed');
                fail(cb, err.message);
            }
        });

        // ==========================================
        // DISCONNECT HANDLING
        // ==========================================

        socket.on('disconnect', async (reason) => {
            logger.info({ userId: user.id, socketId: socket.id, reason }, 'Socket disconnected');
            cleanupSocketRateLimit(socket.id);

            try {
                // Find all rooms this user was in
                const rooms = await roomService.getParticipantRooms(socket.id);

                for (const { room_id, user_id } of rooms) {
                    // Mark as disconnected but DON'T remove yet
                    await roomService.markDisconnected(user_id, room_id, socket.id);

                    // Notify room
                    socket.to(room_id).emit('participant_disconnected', {
                        userId: user_id,
                    });

                    // Start grace period
                    startGracePeriod(user_id, room_id, async () => {
                        // Grace period expired — finalize removal
                        await roomService.removeParticipant(user_id, room_id);

                        // Notify room
                        io.to(room_id).emit('participant_left', {
                            userId: user_id,
                            expired: true,
                        });

                        // Update lobby
                        try {
                            const state = await roomService.getRoomState(room_id);
                            io.emit('room_updated', {
                                roomId: room_id,
                                participant_count: state.participants.length,
                            });
                        } catch {
                            // Room may no longer exist
                        }
                    });
                }
            } catch (err) {
                logger.error({ err }, 'Error handling disconnect');
            }
        });
    });
}
