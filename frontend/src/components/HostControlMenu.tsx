import React from 'react';
import type { Participant } from '../context/RoomContext';

interface HostControlMenuProps {
  participant: Participant;
  position?: 'above' | 'below';
  onAction: (action: 'promote' | 'demote' | 'grant' | 'revoke' | 'remove', targetId: string) => void;
  onClose: () => void;
}

export default function HostControlMenu({ participant: p, position = 'below', onAction, onClose }: HostControlMenuProps) {
  const posClass = position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div
      className={`absolute ${posClass} left-1/2 -translate-x-1/2 z-50 w-44 glass-strong shadow-glass py-1.5 animate-scale-in`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 border-b border-white/[0.06] mb-1">
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Actions</p>
      </div>

      {p.role === 'listener' ? (
        <button
          onClick={() => onAction('grant', p.user_id)}
          className="w-full text-left px-3 py-2 hover:bg-accent-500/10 text-xs font-medium text-white/70 hover:text-accent-400 flex items-center gap-2 transition-colors"
        >
          <span>🎤</span> Make Speaker
        </button>
      ) : (
        <>
          {p.role === 'speaker' && (
            <button
              onClick={() => onAction('promote', p.user_id)}
              className="w-full text-left px-3 py-2 hover:bg-violet-500/10 text-xs font-medium text-white/70 hover:text-violet-400 flex items-center gap-2 transition-colors"
            >
              <span>⬆️</span> Promote Co-host
            </button>
          )}
          <button
            onClick={() => onAction('revoke', p.user_id)}
            className="w-full text-left px-3 py-2 hover:bg-amber-500/10 text-xs font-medium text-white/70 hover:text-amber-400 flex items-center gap-2 transition-colors"
          >
            <span>🔇</span> Move to Audience
          </button>
        </>
      )}

      <div className="border-t border-white/[0.06] mt-1 pt-1">
        <button
          onClick={() => onAction('remove', p.user_id)}
          className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-xs font-medium text-red-400/70 hover:text-red-400 flex items-center gap-2 transition-colors"
        >
          <span>🚫</span> Remove User
        </button>
      </div>
    </div>
  );
}
