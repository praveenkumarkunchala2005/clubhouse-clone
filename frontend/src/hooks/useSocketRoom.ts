import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { emitWithAck } from '../services/socket';

interface UseSocketRoomOptions {
    onRoomEnded?: () => void;
    onRemovedFromRoom?: () => void;
}

/**
 * Hook to manage all Socket.io room events.
 * Accepts callbacks for navigation on room_ended / removed_from_room (bug #2, #3 fix).
 */
export function useSocketRoom(roomId: string | null, options?: UseSocketRoomOptions) {
    const {
        updateParticipant,
        updateParticipantField,
        addParticipant,
        removeParticipant,
        addMessage,
        setLivekitToken,
        setMyParticipant,
        clearRoom,
        setRoom,
        setParticipants,
        setMessages,
    } = useRoom();
    const { user } = useAuth();
    const lastMessageRef = useRef<string | null>(null);

    useEffect(() => {
        if (!roomId || !user) return;

        const socket = getSocket();

        // --- Room Events ---
        const handleParticipantJoined = ({ participant }: any) => {
            addParticipant(participant);
        };

        const handleParticipantLeft = ({ userId }: any) => {
            removeParticipant(userId);
        };

        const handleParticipantUpdated = ({ participant }: any) => {
            updateParticipant(participant);
        };

        // Bug #6 fix: use partial field update instead of full object replacement
        const handleParticipantDisconnected = ({ userId }: any) => {
            updateParticipantField(userId, { is_connected: false });
        };

        const handleParticipantReconnected = ({ userId }: any) => {
            updateParticipantField(userId, { is_connected: true });
        };

        // Bug #2 fix: call onRoomEnded callback for navigation
        const handleRoomEnded = () => {
            clearRoom();
            options?.onRoomEnded?.();
        };

        // --- Role Events ---
        const handleMicGranted = ({ participant, livekitToken }: any) => {
            setMyParticipant(participant);
            setLivekitToken(livekitToken);
        };

        const handleMicRevoked = ({ participant, livekitToken }: any) => {
            setMyParticipant(participant);
            setLivekitToken(livekitToken);
        };

        const handleRoleChanged = ({ participant, livekitToken }: any) => {
            setMyParticipant(participant);
            setLivekitToken(livekitToken);
        };

        // Bug #3 fix: call onRemovedFromRoom callback for navigation
        const handleRemovedFromRoom = () => {
            clearRoom();
            options?.onRemovedFromRoom?.();
        };

        const handleMicRequested = ({ userId, roomId }: any) => {
            window.dispatchEvent(
                new CustomEvent('mic_requested', { detail: { userId, roomId } })
            );
        };

        // --- Chat Events ---
        const handleReceiveMessage = ({ message }: any) => {
            addMessage(message);
            lastMessageRef.current = message.created_at;
        };

        // Register event listeners
        socket.on('participant_joined', handleParticipantJoined);
        socket.on('participant_left', handleParticipantLeft);
        socket.on('participant_updated', handleParticipantUpdated);
        socket.on('participant_disconnected', handleParticipantDisconnected);
        socket.on('participant_reconnected', handleParticipantReconnected);
        socket.on('room_ended', handleRoomEnded);
        socket.on('mic_granted', handleMicGranted);
        socket.on('mic_revoked', handleMicRevoked);
        socket.on('role_changed', handleRoleChanged);
        socket.on('removed_from_room', handleRemovedFromRoom);
        socket.on('mic_requested', handleMicRequested);
        socket.on('receive_message', handleReceiveMessage);

        // Handle reconnection — restore room state
        const handleReconnect = () => {
            console.log('[Socket] Reconnected — restoring room state');
            emitWithAck('restore_room_state', {
                roomId,
                lastMessageAt: lastMessageRef.current,
            }).then((res) => {
                if (res.success && res.data) {
                    setRoom(res.data.room);
                    setParticipants(res.data.participants);
                    if (res.data.missedMessages?.length) {
                        res.data.missedMessages.forEach((m: any) => addMessage(m));
                    }
                    if (res.data.livekitToken) {
                        setLivekitToken(res.data.livekitToken);
                    }
                    const myPart = res.data.participants.find(
                        (p: any) => p.user_id === user.id
                    );
                    if (myPart) {
                        setMyParticipant(myPart);
                    }
                }
            });
        };

        socket.on('connect', handleReconnect);

        return () => {
            socket.off('participant_joined', handleParticipantJoined);
            socket.off('participant_left', handleParticipantLeft);
            socket.off('participant_updated', handleParticipantUpdated);
            socket.off('participant_disconnected', handleParticipantDisconnected);
            socket.off('participant_reconnected', handleParticipantReconnected);
            socket.off('room_ended', handleRoomEnded);
            socket.off('mic_granted', handleMicGranted);
            socket.off('mic_revoked', handleMicRevoked);
            socket.off('role_changed', handleRoleChanged);
            socket.off('removed_from_room', handleRemovedFromRoom);
            socket.off('mic_requested', handleMicRequested);
            socket.off('receive_message', handleReceiveMessage);
            socket.off('connect', handleReconnect);
        };
    }, [roomId, user]);
}
