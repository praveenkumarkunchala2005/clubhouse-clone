import React, { useRef, useEffect, FormEvent } from 'react';
import type { Message } from '../context/RoomContext';

interface ChatPanelProps {
  messages: Message[];
  currentUserId: string;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: (e: FormEvent) => void;
  onClose: () => void;
}

export default function ChatPanel({
  messages,
  currentUserId,
  chatInput,
  onChatInputChange,
  onSendMessage,
  onClose,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-full sm:w-80 glass flex flex-col absolute right-0 inset-y-0 z-50 shadow-glass animate-slide-in-right border-l-0 sm:rounded-l-2xl rounded-none">
      {/* Header — close button always visible (bug #4 fix) */}
      <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
        <h3 className="font-semibold text-white/90 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-accent-400">
            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 24.308 24.308 0 003.55-.414c1.438-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
          </svg>
          Chat
        </h3>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-white/20 text-sm">No messages yet</p>
            <p className="text-white/10 text-xs mt-1">Start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const senderName = isMe ? 'You' : (msg.sender_id.includes('@') ? msg.sender_id.split('@')[0] : msg.sender_id.slice(0, 8));
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-slide-up`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  isMe
                    ? 'bg-accent-600/80 text-white rounded-tr-sm'
                    : 'bg-white/[0.06] text-white/80 rounded-tl-sm border border-white/[0.06]'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-white/20 mt-1 px-1">{senderName}</span>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={onSendMessage} className="p-3 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-accent-500/30 focus:border-accent-500/40 transition-all"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="p-2.5 bg-accent-600/80 hover:bg-accent-500 text-white rounded-full transition-all disabled:opacity-30 disabled:hover:bg-accent-600/80"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
