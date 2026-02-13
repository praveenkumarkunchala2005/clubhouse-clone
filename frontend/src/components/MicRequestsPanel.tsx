import React from 'react';
import { emitWithAck } from '../services/socket';

interface MicRequestsPanelProps {
  requests: string[];
  roomId: string;
  onApprove: (userId: string) => void;
  onDeny: (userId: string) => void;
}

export default function MicRequestsPanel({ requests, roomId, onApprove, onDeny }: MicRequestsPanelProps) {
  const handleApprove = (userId: string) => {
    // Bug #1 fix: send `targetId` instead of `userId` to match backend handler
    emitWithAck('grant_mic', { roomId, targetId: userId });
    onApprove(userId);
  };

  return (
    <div className="absolute top-14 right-0 w-72 glass-strong shadow-glass p-4 z-50 animate-scale-in">
      <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
        Mic Requests
      </h4>

      {requests.length === 0 && (
        <p className="text-sm text-white/20">No active requests</p>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {requests.map((id) => {
          const displayName = id.includes('@') ? id.split('@')[0] : id.slice(0, 8);
          return (
            <div key={id} className="flex justify-between items-center bg-white/[0.04] p-2.5 rounded-lg border border-white/[0.06]">
              <span className="text-sm font-medium text-white/80 truncate max-w-[140px]">{displayName}</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleApprove(id)}
                  className="p-1.5 bg-accent-500/20 text-accent-400 hover:bg-accent-500/30 rounded-md transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeny(id)}
                  className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-md transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
