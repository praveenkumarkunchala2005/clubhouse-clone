import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { env } from './env';

// LiveKit Room Service Client for server-side room management
export const roomServiceClient = new RoomServiceClient(
    env.LIVEKIT_URL.replace('ws://', 'http://').replace('wss://', 'https://'),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET
);

export type LiveKitGrants = {
    canPublish: boolean;
    canSubscribe: boolean;
};

/**
 * Generate a LiveKit access token for a participant
 */
export async function generateLiveKitToken(
    userId: string,
    roomId: string,
    grants: LiveKitGrants
): Promise<string> {
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity: userId,
        ttl: '6h',
    });

    token.addGrant({
        room: roomId,
        roomJoin: true,
        canPublish: grants.canPublish,
        canSubscribe: grants.canSubscribe,
        canPublishData: true,
    });

    return await token.toJwt();
}
