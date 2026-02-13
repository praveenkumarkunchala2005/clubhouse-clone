import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { useSocketRoom } from '../hooks/useSocketRoom';
import { useLiveKit } from '../hooks/useLiveKit';
import { emitWithAck } from '../services/socket';
import ParticipantAvatar from '../components/ParticipantAvatar';
import HostControlMenu from '../components/HostControlMenu';
import ChatPanel from '../components/ChatPanel';
import RoomControls from '../components/RoomControls';
import MicRequestsPanel from '../components/MicRequestsPanel';

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    room,
    participants,
    messages,
    myParticipant,
    livekitToken,
    setRoom,
    setParticipants,
    setMyParticipant,
    setLivekitToken,
    clearRoom,
    setMessages,
  } = useRoom();

  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [micRequests, setMicRequests] = useState<string[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Bug #2, #3 fix: pass navigation callbacks
  useSocketRoom(roomId || null, {
    onRoomEnded: () => navigate('/'),
    onRemovedFromRoom: () => navigate('/'),
  });

  const livekit = useLiveKit({
    url: import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880',
    token: livekitToken,
    roomId: roomId || null,
  });

  // Join room on mount
  useEffect(() => {
    if (!roomId) return;
    emitWithAck('join_room', { roomId })
      .then((res) => {
        if (res.success && res.data) {
          setRoom(res.data.room);
          setParticipants(res.data.participants);
          setMyParticipant(res.data.participant);
          setLivekitToken(res.data.livekitToken);
          setMessages(res.data.messages || []);
        } else {
          navigate('/');
        }
      })
      .catch(() => navigate('/'));
    return () => {
      clearRoom();
    };
  }, [roomId]);

  // Mic request events
  useEffect(() => {
    const handleMicRequest = (e: any) => {
      const { userId } = e.detail;
      if (!micRequests.includes(userId)) {
        setMicRequests((prev) => [...prev, userId]);
      }
    };
    window.addEventListener('mic_requested', handleMicRequest);
    return () => window.removeEventListener('mic_requested', handleMicRequest);
  }, [micRequests]);

  // Sync mic state if permission revoked
  useEffect(() => {
    // Debugging mic state
    if (myParticipant) {
      console.log('[RoomPage] Mic State Check:', {
        role: myParticipant.role,
        mic_enabled: myParticipant.mic_enabled, // DB permission
        isMicOn: livekit.isMicOn, // Local LiveKit state
        livekit_mic_enabled: livekitToken ? 'Token Present' : 'No Token'
      });
    }

    // Checking if we should force mute
    if (myParticipant && !myParticipant.mic_enabled && livekit.isMicOn) {
      console.warn('[RoomPage] Force Muting because mic_enabled is FALSE');
      // livekit.forceMute(); // DISABLED FOR DEBUGGING
    }
  }, [myParticipant, livekit.isMicOn]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomId) return;
    await emitWithAck('send_message', { roomId, content: chatInput.trim() });
    setChatInput('');
  };

  const handleLeave = async () => {
    if (roomId) await emitWithAck('leave_room', { roomId });
    navigate('/');
  };

  const handleEndRoom = async () => {
    if (roomId) await emitWithAck('end_room', { roomId });
    navigate('/');
  };

  const handleHostAction = async (
    action: 'promote' | 'demote' | 'grant' | 'revoke' | 'remove',
    targetId: string
  ) => {
    if (!roomId) return;
    try {
      if (action === 'promote') await emitWithAck('promote_user', { roomId, targetId, role: 'co-host' });
      if (action === 'demote') await emitWithAck('demote_user', { roomId, targetId });
      if (action === 'grant') await emitWithAck('grant_mic', { roomId, targetId });
      if (action === 'revoke') await emitWithAck('revoke_mic', { roomId, targetId });
      if (action === 'remove') await emitWithAck('remove_user', { roomId, targetId });
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const participantsList = participants || [];
  const speakers = participantsList.filter((p) => ['host', 'co-host', 'speaker'].includes(p.role));
  const listeners = participantsList.filter((p) => p.role === 'listener');
  const isHost = myParticipant?.role === 'host' || myParticipant?.role === 'co-host';

  if (!room)
    return (
      <div className="h-screen flex items-center justify-center bg-surface-900">
        <div className="loading-spinner" />
      </div>
    );

  return (
    <div className="h-screen flex flex-col bg-surface-900 overflow-hidden" onClick={() => setSelectedUser(null)}>
      {/* Room Header */}
      <header className="flex-none h-16 glass border-b border-white/[0.04] flex items-center justify-between px-4 lg:px-8 z-20 rounded-none">
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 text-white/30 hover:text-white/70 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.06]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline text-sm">All Rooms</span>
        </button>

        <div className="flex flex-col items-center">
          <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            {room.title}
            {room.type === 'private' && <span className="text-xs text-white/20">🔒</span>}
          </h2>
          <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest">
            <span className="relative flex h-1.5 w-1.5 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-500" />
            </span>
            Live • {participants.length} online
          </div>
        </div>

        <div className="flex gap-3 relative">
          {isHost && micRequests.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRequests(!showRequests);
              }}
              className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-amber-500/20 animate-pulse-slow transition-colors"
            >
              <span>✋</span> {micRequests.length}
            </button>
          )}

          {showRequests && isHost && (
            <MicRequestsPanel
              requests={micRequests}
              roomId={roomId!}
              onApprove={(id) => setMicRequests((p) => p.filter((i) => i !== id))}
              onDeny={(id) => setMicRequests((p) => p.filter((i) => i !== id))}
            />
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 pb-32">
          {/* Speakers Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 justify-items-center max-w-5xl mx-auto">
            {speakers.map((p) => {
              const isLocal = p.user_id === user?.id;
              const isSpeaking = livekit.speakingParticipants.get(p.user_id) || false;
              const isMuted = isLocal ? !livekit.isMicOn : livekit.mutedParticipants.get(p.user_id) || false;

              return (
                <div key={p.user_id} className="relative">
                  <ParticipantAvatar
                    participant={p}
                    isLocal={isLocal}
                    isSpeaking={isSpeaking}
                    isMuted={isMuted}
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isHost && !isLocal) setSelectedUser(p.user_id);
                    }}
                  />
                  {selectedUser === p.user_id && isHost && (
                    <HostControlMenu
                      participant={p}
                      position="below"
                      onAction={handleHostAction}
                      onClose={() => setSelectedUser(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Listeners Section */}
          {listeners.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/[0.04] max-w-5xl mx-auto">
              <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-widest text-center mb-6">
                Audience ({listeners.length})
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 justify-items-center">
                {listeners.map((p) => {
                  const isLocal = p.user_id === user?.id;
                  return (
                    <div key={p.user_id} className="relative">
                      <ParticipantAvatar
                        participant={p}
                        isLocal={isLocal}
                        isSpeaking={false}
                        isMuted={false}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isHost && !isLocal) setSelectedUser(p.user_id);
                        }}
                      />
                      {selectedUser === p.user_id && isHost && (
                        <HostControlMenu
                          participant={p}
                          position="above"
                          onAction={handleHostAction}
                          onClose={() => setSelectedUser(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {showChat && (
          <ChatPanel
            messages={messages}
            currentUserId={user?.id || ''}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            onSendMessage={handleSendMessage}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>

      {/* Floating Controls */}
      {myParticipant && (
        <RoomControls
          role={myParticipant.role}
          isMicOn={livekit.isMicOn}
          showChat={showChat}
          onLeave={handleLeave}
          onToggleMic={() => livekit.toggleMic()}
          onToggleChat={() => setShowChat(!showChat)}
          onRequestMic={() => emitWithAck('request_mic', { roomId })}
          onEndRoom={handleEndRoom}
        />
      )}
    </div>
  );
}
