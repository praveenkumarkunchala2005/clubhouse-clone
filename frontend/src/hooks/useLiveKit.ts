import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Room,
    RoomEvent,
    Track,
    LocalTrackPublication,
    RemoteTrackPublication,
    Participant,
    RemoteParticipant,
    ConnectionState,
    createLocalAudioTrack,
    TrackPublication,
} from 'livekit-client';

interface UseLiveKitOptions {
    url: string;
    token: string | null;
    roomId: string | null;
}

export function useLiveKit({ url, token, roomId }: UseLiveKitOptions) {
    const roomRef = useRef<Room | null>(null);
    const [connected, setConnected] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [speakingParticipants, setSpeakingParticipants] = useState<Map<string, boolean>>(new Map());
    const [mutedParticipants, setMutedParticipants] = useState<Map<string, boolean>>(new Map());
    const [error, setError] = useState<string | null>(null);
    const localTrackRef = useRef<LocalTrackPublication | null>(null);

    // Connect to LiveKit room
    useEffect(() => {
        if (!token || !roomId) return;

        const lkRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        roomRef.current = lkRoom;

        // Event: speaking state changes
        const handleSpeaking = (participant: Participant) => {
            setSpeakingParticipants((prev) => {
                const next = new Map(prev);
                next.set(participant.identity, participant.isSpeaking);
                return next;
            });
        };

        // Event: connection state changes
        const handleConnectionChange = (state: ConnectionState) => {
            setConnected(state === ConnectionState.Connected);
            if (state === ConnectionState.Disconnected) {
                setIsMicOn(false);
            }
        };

        // Event: track subscribed (remote audio auto-plays)
        const handleTrackSubscribed = (
            track: any,
            _pub: RemoteTrackPublication,
            _participant: RemoteParticipant
        ) => {
            if (track.kind === Track.Kind.Audio) {
                const el = track.attach();
                el.id = `audio-${_participant.identity}`;
                document.body.appendChild(el);
            }
        };

        // Event: track unsubscribed
        const handleTrackUnsubscribed = (
            track: any,
            _pub: RemoteTrackPublication,
            _participant: RemoteParticipant
        ) => {
            track.detach().forEach((el: HTMLElement) => el.remove());
        };

        // Event: Track Muted (User physically muted their mic)
        const handleTrackMuted = (pub: TrackPublication, participant: Participant) => {
            if (pub.kind === Track.Kind.Audio) {
                setMutedParticipants(prev => {
                    const next = new Map(prev);
                    next.set(participant.identity, true);
                    return next;
                });
            }
        };

        // Event: Track Unmuted
        const handleTrackUnmuted = (pub: TrackPublication, participant: Participant) => {
            if (pub.kind === Track.Kind.Audio) {
                setMutedParticipants(prev => {
                    const next = new Map(prev);
                    next.set(participant.identity, false);
                    return next;
                });
            }
        };

        lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
            setSpeakingParticipants((prev) => {
                const next = new Map<string, boolean>();
                // Reset all
                prev.forEach((_, key) => next.set(key, false));
                // Set active speakers
                speakers.forEach((s) => next.set(s.identity, true));
                return next;
            });
        });

        let aborted = false;

        lkRoom.on(RoomEvent.ConnectionStateChanged, handleConnectionChange);
        lkRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        lkRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        lkRoom.on(RoomEvent.TrackMuted, handleTrackMuted);
        lkRoom.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

        // Resolve URL (handle relative paths for proxy)
        let connectionUrl = url;
        if (url.startsWith('/')) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            connectionUrl = `${protocol}//${window.location.host}${url}`;
        }

        // Connect
        lkRoom
            .connect(connectionUrl, token)
            .then(() => {
                if (aborted) return;
                setConnected(true);
                setError(null);
                console.log('[LiveKit] Connected to room:', roomId, 'URL:', connectionUrl);

                // Initialize muted state for existing participants
                const initialMuted = new Map<string, boolean>();
                lkRoom.remoteParticipants.forEach((p: RemoteParticipant) => {
                    const audioPub = p.getTrackPublication(Track.Source.Microphone);
                    if (audioPub) {
                        initialMuted.set(p.identity, audioPub.isMuted);
                    }
                });
                setMutedParticipants(initialMuted);
            })
            .catch((err) => {
                if (aborted) return;
                console.error('[LiveKit] Connection failed:', err);
                setError(err.message);
            });

        return () => {
            aborted = true;
            // Clean up audio elements
            document.querySelectorAll('[id^="audio-"]').forEach((el) => el.remove());

            lkRoom.disconnect(true);
            roomRef.current = null;
            setConnected(false);
            setIsMicOn(false);
        };
    }, [token, roomId, url]);

    // Mic toggle
    const toggleMic = useCallback(async () => {
        const room = roomRef.current;
        if (!room || !connected) return;

        try {
            if (isMicOn) {
                // MUTE: unpublish local audio track
                const localPart = room.localParticipant;

                // Instead of unpublishing (which removes the track entirely), we can just disable/mute it
                // But typically in these apps we might unpublish to save bandwidth or strictly enforce privacy.
                // However, for "mute" state to be visible to others without "permission" loss, 
                // we should probably keep it published but muted if that's the intention.
                // BUT, the backend logic grants a token. 
                // Let's stick to unpublishing for "hard mute" / permission revocation, 
                // OR use track.mute() for user-initiated mute.

                // Strategy: User-toggle = track.mute() / track.unmute() if track exists.
                // If track doesn't exist (fresh join), we publish.

                // Let's see if we have a track
                const tracks = Array.from(localPart.audioTrackPublications.values());
                const audioPub = tracks.find(t => t.kind === Track.Kind.Audio);

                if (audioPub && audioPub.track) {
                    // If we have a track, we just mute it? 
                    // No, `unpublishTrack` is safer for "Mic Off" visual. 
                    // Getting consistent behavior: 
                    // "Mic On" -> Publish Track
                    // "Mic Off" -> Unpublish Track (matches original implementation)

                    await localPart.unpublishTrack(audioPub.track);
                    audioPub.track.stop();
                }

                localTrackRef.current = null;
                setIsMicOn(false);
            } else {
                // UNMUTE: create and publish local audio track
                const track = await createLocalAudioTrack({
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                });
                const pub = await room.localParticipant.publishTrack(track);
                localTrackRef.current = pub;
                setIsMicOn(true);
            }
        } catch (err: any) {
            console.error('[LiveKit] Mic toggle error:', err);
            setError(err.message);
        }
    }, [connected, isMicOn]);

    // Force mute (external trigger from host revoking mic)
    const forceMute = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;

        try {
            const localPart = room.localParticipant;
            const audioTracks = localPart.audioTrackPublications;
            for (const [, pub] of audioTracks) {
                if (pub.track) {
                    await localPart.unpublishTrack(pub.track);
                    pub.track.stop();
                }
            }
            localTrackRef.current = null;
            setIsMicOn(false);
        } catch (err: any) {
            console.error('[LiveKit] Force mute error:', err);
        }
    }, []);

    return {
        connected,
        isMicOn,
        speakingParticipants,
        mutedParticipants,
        error,
        toggleMic,
        forceMute,
    };
}
