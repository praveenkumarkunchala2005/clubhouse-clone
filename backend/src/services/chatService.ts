import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface Message {
    id: string;
    room_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

/**
 * Send a message to a room
 */
export async function sendMessage(
    userId: string,
    roomId: string,
    content: string
): Promise<Message> {
    // Validate content
    if (!content || content.trim().length === 0) {
        throw new Error('Message content cannot be empty');
    }
    if (content.length > 2000) {
        throw new Error('Message too long (max 2000 characters)');
    }

    // Verify user is a connected participant
    const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('is_connected', true)
        .single();

    if (!participant) {
        throw new Error('You must be a connected participant to send messages');
    }

    // Insert message
    const { data: message, error } = await supabase
        .from('messages')
        .insert({
            room_id: roomId,
            sender_id: userId,
            content: content.trim(),
        })
        .select()
        .single();

    if (error || !message) {
        logger.error({ error }, 'Failed to send message');
        throw new Error('Failed to send message');
    }

    logger.debug({ messageId: message.id, roomId, userId }, 'Message sent');
    return message;
}

/**
 * Get messages with cursor-based pagination
 */
export async function getMessages(
    roomId: string,
    cursor?: string,
    limit: number = 50
): Promise<{ messages: Message[]; nextCursor: string | null }> {
    let query = supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit + 1); // Fetch one extra to check for next page

    if (cursor) {
        query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
        logger.error({ error }, 'Failed to fetch messages');
        throw new Error('Failed to fetch messages');
    }

    const messages = data || [];
    let nextCursor: string | null = null;

    if (messages.length > limit) {
        nextCursor = messages[limit - 1].created_at;
        messages.pop(); // Remove the extra item
    }

    return { messages, nextCursor };
}

/**
 * Get messages since a specific timestamp (for reconnect resync)
 */
export async function getMessagesSince(
    roomId: string,
    since: string
): Promise<Message[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(200);

    if (error) {
        logger.error({ error }, 'Failed to fetch messages since timestamp');
        return [];
    }

    return data || [];
}
