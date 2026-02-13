import React from 'react';

interface RoomControlsProps {
  role: 'host' | 'co-host' | 'speaker' | 'listener';
  isMicOn: boolean;
  showChat: boolean;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleChat: () => void;
  onRequestMic: () => void;
  onEndRoom: () => void;
}

export default function RoomControls({
  role,
  isMicOn,
  showChat,
  onLeave,
  onToggleMic,
  onToggleChat,
  onRequestMic,
  onEndRoom,
}: RoomControlsProps) {
  const isHost = role === 'host' || role === 'co-host';
  const canSpeak = role === 'host' || role === 'co-host' || role === 'speaker';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="glass-strong shadow-glass px-5 py-3 flex items-center gap-3 rounded-full">
        {/* Leave Button */}
        <button
          className="w-11 h-11 rounded-full bg-white/[0.06] hover:bg-red-500/20 text-white/50 hover:text-red-400 flex items-center justify-center transition-all duration-200 border border-white/[0.06] hover:border-red-500/30"
          onClick={onLeave}
          title="Leave Room"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Mic Toggle — only for speakers/hosts */}
        {canSpeak && (
          <button
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 ${
              isMicOn
                ? 'bg-gradient-to-br from-accent-500 to-accent-600 border-accent-400 text-white shadow-glow-accent'
                : 'bg-white/[0.04] border-white/[0.1] text-white/40 hover:text-white/60 hover:border-white/20'
            }`}
            onClick={onToggleMic}
            title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
          >
            {isMicOn ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18z" />
                <path d="M8.25 4.5a3.75 3.75 0 017.5 0v4.94l-7.5-7.5V4.5zM6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 007.88 4.547l1.08 1.08A6.73 6.73 0 0112.75 19.96v1.79h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-1.79A6.751 6.751 0 015.25 13.5v-1.5A.75.75 0 016 10.5z" />
                <path d="M15.75 12.75V4.94l1.5 1.5v6.31a.75.75 0 001.5 0v-1.5a.75.75 0 011.5 0v1.5a5.222 5.222 0 01-.674 2.56l-1.08-1.08a3.72 3.72 0 00.254-1.48z" />
              </svg>
            )}
          </button>
        )}

        {/* Request Mic — only for listeners */}
        {role === 'listener' && (
          <button
            className="w-11 h-11 rounded-full bg-white/[0.06] hover:bg-amber-500/20 text-white/50 hover:text-amber-400 flex items-center justify-center transition-all duration-200 border border-white/[0.06] hover:border-amber-500/30"
            onClick={onRequestMic}
            title="Request to Speak"
          >
            <span className="text-lg">✋</span>
          </button>
        )}

        {/* Chat Toggle */}
        <button
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border ${
            showChat
              ? 'bg-accent-500/20 text-accent-400 border-accent-500/30'
              : 'bg-white/[0.06] text-white/50 hover:text-white/70 border-white/[0.06] hover:border-white/[0.12]'
          }`}
          onClick={onToggleChat}
          title="Toggle Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 24.308 24.308 0 003.55-.414c1.438-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
          </svg>
        </button>

        {/* End Room — only for host (bug #5 fix) */}
        {isHost && (
          <button
            className="w-11 h-11 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 flex items-center justify-center transition-all duration-200 border border-red-500/10 hover:border-red-500/30"
            onClick={onEndRoom}
            title="End Room"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
