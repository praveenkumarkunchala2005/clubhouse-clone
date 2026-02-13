import { supabase } from '../config/supabase';
import { generateLiveKitToken } from '../config/livekit';
import { logger } from '../utils/logger';
import type { ParticipantRole } from './roomService';

const ROLE_HIERARCHY: Record<string, number> = {
    host: 4,
    'co-host': 3,
    speaker: 2,
    listener: 1,
};

/**
 * Validate that the actor has sufficient privileges to perform a role action
 */
async function validateActorPrivileges(
    actorId: string,
    roomId: string,
    requiredRoles: ParticipantRole[]
): Promise<{ role: ParticipantRole }> {
    const { data: actor } = await supabase
        .from('participants')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', actorId)
        .eq('is_connected', true)
        .single();

    if (!actor || !requiredRoles.includes(actor.role as ParticipantRole)) {
        throw new Error('Insufficient privileges');
    }

    return { role: actor.role as ParticipantRole };
}

/**
 * Get a target participant's current state
 */
async function getTargetParticipant(targetId: string, roomId: string) {
    const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', targetId)
        .eq('is_connected', true)
        .single();

    if (!data) {
        throw new Error('Target user not found in room');
    }

    return data;
}

/**
 * Promote a user to a higher role
 */
export async function promoteUser(
    actorId: string,
    targetId: string,
    roomId: string,
    newRole: ParticipantRole
): Promise<{ participant: any; livekitToken?: string }> {
    const actor = await validateActorPrivileges(actorId, roomId, ['host', 'co-host']);
    const target = await getTargetParticipant(targetId, roomId);

    // Validate role hierarchy
    if (ROLE_HIERARCHY[newRole] >= ROLE_HIERARCHY[actor.role]) {
        throw new Error('Cannot promote to equal or higher role than your own');
    }

    if (ROLE_HIERARCHY[newRole] <= ROLE_HIERARCHY[target.role]) {
        throw new Error('Target already has equal or higher role');
    }

    // Only host can promote to co-host
    if (newRole === 'co-host' && actor.role !== 'host') {
        throw new Error('Only the host can promote to co-host');
    }

    const micEnabled = newRole !== 'listener';

    const { data: updated, error } = await supabase
        .from('participants')
        .update({ role: newRole, mic_enabled: micEnabled })
        .eq('room_id', roomId)
        .eq('user_id', targetId)
        .select()
        .single();

    if (error || !updated) {
        throw new Error('Failed to promote user');
    }

    // Generate new LiveKit token with updated permissions
    const canPublish = ['host', 'co-host', 'speaker'].includes(newRole);
    const livekitToken = await generateLiveKitToken(targetId, roomId, {
        canPublish,
        canSubscribe: true,
    });

    logger.info({ actorId, targetId, roomId, newRole }, 'User promoted');
    return { participant: updated, livekitToken };
}

/**
 * Demote a user to listener
 */
export async function demoteUser(
    actorId: string,
    targetId: string,
    roomId: string
): Promise<{ participant: any; livekitToken: string }> {
    const actor = await validateActorPrivileges(actorId, roomId, ['host', 'co-host']);
    const target = await getTargetParticipant(targetId, roomId);

    // Cannot demote someone with equal or higher role
    if (ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[actor.role]) {
        throw new Error('Cannot demote a user with equal or higher role');
    }

    const { data: updated, error } = await supabase
        .from('participants')
        .update({ role: 'listener', mic_enabled: false })
        .eq('room_id', roomId)
        .eq('user_id', targetId)
        .select()
        .single();

    if (error || !updated) {
        throw new Error('Failed to demote user');
    }

    // New listen-only token
    const livekitToken = await generateLiveKitToken(targetId, roomId, {
        canPublish: false,
        canSubscribe: true,
    });

    logger.info({ actorId, targetId, roomId }, 'User demoted to listener');
    return { participant: updated, livekitToken };
}

/**
 * Grant mic access to a user
 */
export async function grantMic(
    actorId: string,
    targetId: string,
    roomId: string
): Promise<{ participant: any; livekitToken: string }> {
    await validateActorPrivileges(actorId, roomId, ['host', 'co-host']);
    await getTargetParticipant(targetId, roomId);

    const { data: updated, error } = await supabase
        .from('participants')
        .update({ mic_enabled: true, role: 'speaker' })
        .eq('room_id', roomId)
        .eq('user_id', targetId)
        .select()
        .single();

    if (error || !updated) {
        throw new Error('Failed to grant mic');
    }

    // Generate publish-enabled token
    const livekitToken = await generateLiveKitToken(targetId, roomId, {
        canPublish: true,
        canSubscribe: true,
    });

    logger.info({ actorId, targetId, roomId }, 'Mic granted');
    return { participant: updated, livekitToken };
}

/**
 * Revoke mic access from a user
 */
export async function revokeMic(
    actorId: string,
    targetId: string,
    roomId: string
): Promise<{ participant: any; livekitToken: string }> {
    const actor = await validateActorPrivileges(actorId, roomId, ['host', 'co-host']);
    const target = await getTargetParticipant(targetId, roomId);

    if (ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[actor.role]) {
        throw new Error('Cannot revoke mic from a user with equal or higher role');
    }

    const { data: updated, error } = await supabase
        .from('participants')
        .update({ mic_enabled: false, role: 'listener' })
        .eq('room_id', roomId)
        .eq('user_id', targetId)
        .select()
        .single();

    if (error || !updated) {
        throw new Error('Failed to revoke mic');
    }

    // Subscribe-only token
    const livekitToken = await generateLiveKitToken(targetId, roomId, {
        canPublish: false,
        canSubscribe: true,
    });

    logger.info({ actorId, targetId, roomId }, 'Mic revoked');
    return { participant: updated, livekitToken };
}

/**
 * Remove a user from room (kick)
 */
export async function removeUser(
    actorId: string,
    targetId: string,
    roomId: string
): Promise<void> {
    const actor = await validateActorPrivileges(actorId, roomId, ['host']);
    const target = await getTargetParticipant(targetId, roomId);

    if (target.role === 'host') {
        throw new Error('Cannot remove the host');
    }

    const { error } = await supabase
        .from('participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetId);

    if (error) {
        throw new Error('Failed to remove user');
    }

    logger.info({ actorId, targetId, roomId }, 'User removed from room');
}
