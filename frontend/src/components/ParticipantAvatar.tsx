import React from 'react';
import type { Participant } from '../context/RoomContext';

interface ParticipantAvatarProps {
  participant: Participant;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
}

const sizeClasses = {
  sm: { container: 'w-12 h-12', text: 'text-xs', nameWidth: 'max-w-[72px]' },
  md: { container: 'w-16 h-16', text: 'text-sm', nameWidth: 'max-w-[90px]' },
  lg: { container: 'w-20 h-20', text: 'text-lg', nameWidth: 'max-w-[100px]' },
};

/** Gradient based on first char code for visual variety */
function getAvatarGradient(id: string): string {
  const code = id.charCodeAt(0) % 6;
  const gradients = [
    'from-emerald-500/30 to-teal-500/30',
    'from-violet-500/30 to-purple-500/30',
    'from-amber-500/30 to-orange-500/30',
    'from-sky-500/30 to-blue-500/30',
    'from-rose-500/30 to-pink-500/30',
    'from-lime-500/30 to-green-500/30',
  ];
  return gradients[code];
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'host': return 'badge-host';
    case 'co-host': return 'badge-cohost';
    case 'speaker': return 'badge-speaker';
    default: return 'badge-listener';
  }
}

export default function ParticipantAvatar({
  participant: p,
  isLocal,
  isSpeaking,
  isMuted,
  size = 'lg',
  onClick,
}: ParticipantAvatarProps) {
  const s = sizeClasses[size];
  const displayName = isLocal ? 'You' : (p.user_id.includes('@') ? p.user_id.split('@')[0] : p.user_id.slice(0, 8));
  const initials = p.user_id.slice(0, 2).toUpperCase();
  const gradient = getAvatarGradient(p.user_id);
  const isDisconnected = !p.is_connected;

  return (
    <div
      className={`flex flex-col items-center gap-2 relative group cursor-pointer animate-fade-in ${isDisconnected ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      {/* Avatar Circle */}
      <div className={`relative transition-all duration-300 ${isSpeaking ? 'scale-105' : ''}`}>
        {/* Speaking glow ring */}
        {isSpeaking && (
          <div className={`absolute -inset-1.5 rounded-full bg-accent-500/20 speaking-ring`} />
        )}

        <div
          className={`${s.container} rounded-full flex items-center justify-center ${s.text} font-bold
            bg-gradient-to-br ${gradient} border-2 transition-all duration-300
            ${isSpeaking ? 'border-accent-400 shadow-glow-accent-sm' : 'border-white/10'}
            ${isDisconnected ? 'grayscale' : ''}
          `}
        >
          <span className="text-white/80">{initials}</span>
        </div>

        {/* Mic Status Badge */}
        {p.role !== 'listener' && (
          <div className={`absolute -bottom-0.5 -right-0.5 rounded-full p-1 border transition-all duration-200
            ${isSpeaking
              ? 'bg-accent-500 border-accent-400 shadow-glow-accent-sm'
              : isMuted
                ? 'bg-red-500/80 border-red-400/50'
                : 'bg-surface-400 border-white/10'
            }
          `}>
            {isSpeaking ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-white">
                <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z" />
                <path d="M4.5 7A.5.5 0 0 0 4 7.5 4 4 0 0 0 7.5 11.45V13H6a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8.5v-1.55A4 4 0 0 0 12 7.5a.5.5 0 0 0-1 0 3 3 0 1 1-6 0 .5.5 0 0 0-1 0Z" />
              </svg>
            ) : isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-white">
                <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l10.5 10.5a.75.75 0 1 0 1.06-1.06l-10.5-10.5Z" />
                <path d="M8 1a2 2 0 0 0-2 2v4c0 .094.007.187.02.278l3.98 3.98V3a2 2 0 0 0-2-2Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-white/50">
                <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z" />
              </svg>
            )}
          </div>
        )}

        {/* Disconnected indicator */}
        {isDisconnected && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-surface-900/60">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Name + Role */}
      <div className="text-center">
        <div className={`text-xs font-semibold text-white/90 truncate ${s.nameWidth} leading-tight`}>
          {displayName}
        </div>
        {size !== 'sm' && (
          <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${getRoleBadgeClass(p.role)}`}>
            {p.role}
          </span>
        )}
      </div>
    </div>
  );
}
