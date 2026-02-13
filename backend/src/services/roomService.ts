import { supabase } from '../config/supabase';
import { generateLiveKitToken, LiveKitGrants } from '../config/livekit';
import { logger } from '../utils/logger';

export type RoomType = 'public' | 'private';
export type ParticipantRole = 'host' | 'co-host' | 'speaker' | 'listener';

export interface Room {
    id: string;
    title: string;
    host_id: string;
    type: RoomType;
    is_active: boolean;
    max_participants: number;
    created_at: string;
}

export interface Participant {
    id: string;
    room_id: string;
    user_id: string;
    role: ParticipantRole;
    mic_enabled: boolean;
    is_connected: boolean;
    socket_id: string | null;
    joined_at: string;
    disconnected_at: string | null;
}

function getGrantsForRole(role: ParticipantRole): LiveKitGrants {
    switch (role) {
        case 'host':
        case 'co-host':
        case 'speaker':
            return { canPublish: true, canSubscribe: true };
        case 'listener':
            return { canPublish: false, canSubscribe: true };
    }
}

// =========================================
// Room Operations
// =========================================

export async function createRoom(
    userId: string,
    title: string,
    type: RoomType = 'public'
): Promise<{ room: Room; participant: Participant; livekitToken: string }> {
    // Create the room
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ title, host_id: userId, type })
        .select()
        .single();

    if (roomError || !room) {
        logger.error({ roomError }, 'Failed to create room');
        throw new Error('Failed to create room');
    }

    // Add the host as a participant
    const { data: participant, error: partError } = await supabase
        .from('participants')
        .insert({
            room_id: room.id,
            user_id: userId,
            role: 'host',
            mic_enabled: true,
            is_connected: true,
        })
        .select()
        .single();

    if (partError || !participant) {
        logger.error({ partError }, 'Failed to add host as participant');
        throw new Error('Failed to add host as participant');
    }

    // Generate LiveKit token for host
    const livekitToken = await generateLiveKitToken(userId, room.id, getGrantsForRole('host'));

    logger.info({ roomId: room.id, userId }, 'Room created');
    return { room, participant, livekitToken };
}

export async function joinRoom(
    userId: string,
    roomId: string,
    socketId: string
): Promise<{ participant: Participant; livekitToken: string; room: Room }> {
    // Check room exists and is active
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .eq('is_active', true)
        .single();

    if (roomError || !room) {
        throw new Error('Room not found or inactive');
    }

    // Check participant count
    const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('is_connected', true);

    if (count && count >= room.max_participants) {
        throw new Error('Room is full');
    }

    // Check if user already has a participant record (reconnect scenario)
    const { data: existing } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

    let participant: Participant;

    if (existing) {
        // Restore existing participant
        const { data: updated, error: updateError } = await supabase
            .from('participants')
            .update({
                is_connected: true,
                socket_id: socketId,
                disconnected_at: null,
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (updateError || !updated) {
            throw new Error('Failed to restore participant');
        }
        participant = updated;
        logger.info({ roomId, userId, role: participant.role }, 'Participant restored');
    } else {
        // New participant joins as listener
        const { data: newPart, error: insertError } = await supabase
            .from('participants')
            .insert({
                room_id: roomId,
                user_id: userId,
                role: 'listener',
                mic_enabled: false,
                is_connected: true,
                socket_id: socketId,
            })
            .select()
            .single();

        if (insertError || !newPart) {
            logger.error({ insertError }, 'Failed to join room');
            throw new Error('Failed to join room');
        }
        participant = newPart;
        logger.info({ roomId, userId }, 'New participant joined');
    }

    // Generate LiveKit token based on role
    const livekitToken = await generateLiveKitToken(
        userId,
        roomId,
        getGrantsForRole(participant.role as ParticipantRole)
    );

    return { participant, livekitToken, room };
}

export async function leaveRoom(userId: string, roomId: string): Promise<void> {
    const { error } = await supabase
        .from('participants')
        .update({
            is_connected: false,
            socket_id: null,
            disconnected_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .eq('user_id', userId);

    if (error) {
        logger.error({ error }, 'Failed to leave room');
        throw new Error('Failed to leave room');
    }

    logger.info({ roomId, userId }, 'Participant left room');
}

export async function endRoom(userId: string, roomId: string): Promise<void> {
    // Verify the user is the host
    const { data: room } = await supabase
        .from('rooms')
        .select('host_id')
        .eq('id', roomId)
        .single();

    if (!room || room.host_id !== userId) {
        throw new Error('Only the host can end the room');
    }

    // Mark room as inactive
    const { error: roomError } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', roomId);

    if (roomError) {
        throw new Error('Failed to end room');
    }

    // Disconnect all participants
    const { error: partError } = await supabase
        .from('participants')
        .update({
            is_connected: false,
            disconnected_at: new Date().toISOString(),
        })
        .eq('room_id', roomId);

    if (partError) {
        logger.error({ partError }, 'Failed to disconnect participants');
    }

    logger.info({ roomId, userId }, 'Room ended');
}

export async function getActiveRooms(): Promise<(Room & { participant_count: number })[]> {
    const { data: rooms, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error || !rooms) {
        logger.error({ error }, 'Failed to fetch rooms');
        return [];
    }

    // Get participant counts
    const roomsWithCounts = await Promise.all(
        rooms.map(async (room) => {
            const { count } = await supabase
                .from('participants')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', room.id)
                .eq('is_connected', true);

            return { ...room, participant_count: count || 0 };
        })
    );

    return roomsWithCounts;
}

export async function getRoomState(roomId: string) {
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

    if (roomError || !room) {
        throw new Error('Room not found');
    }

    const { data: participants, error: partError } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_connected', true)
        .order('joined_at', { ascending: true });

    if (partError) {
        throw new Error('Failed to fetch participants');
    }

    return { room, participants: participants || [] };
}

export async function markDisconnected(userId: string, roomId: string, socketId: string): Promise<void> {
    await supabase
        .from('participants')
        .update({
            is_connected: false,
            disconnected_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('socket_id', socketId);
}

export async function removeParticipant(userId: string, roomId: string): Promise<void> {
    await supabase
        .from('participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);
}

export async function getParticipantRooms(socketId: string): Promise<{ room_id: string; user_id: string }[]> {
    const { data } = await supabase
        .from('participants')
        .select('room_id, user_id')
        .eq('socket_id', socketId)
        .eq('is_connected', true);

    return data || [];
}

export async function updateSocketId(userId: string, roomId: string, socketId: string): Promise<void> {
    await supabase
        .from('participants')
        .update({ socket_id: socketId, is_connected: true, disconnected_at: null })
        .eq('room_id', roomId)
        .eq('user_id', userId);
}
