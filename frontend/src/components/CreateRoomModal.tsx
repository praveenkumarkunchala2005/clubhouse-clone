import React, { FormEvent } from 'react';

interface CreateRoomModalProps {
  title: string;
  type: 'public' | 'private';
  onTitleChange: (value: string) => void;
  onTypeChange: (value: 'public' | 'private') => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export default function CreateRoomModal({
  title,
  type,
  onTitleChange,
  onTypeChange,
  onSubmit,
  onClose,
}: CreateRoomModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong shadow-glass w-full max-w-md overflow-hidden p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Start a Room</h3>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
              Topic
            </label>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="What's on your mind?"
              className="input-dark text-lg"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {(['public', 'private'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTypeChange(t)}
                className={`py-3 px-4 rounded-xl font-medium border transition-all duration-200 flex items-center justify-center gap-2 capitalize ${
                  type === t
                    ? 'bg-accent-500/10 border-accent-500/30 text-accent-400 ring-1 ring-accent-500/20'
                    : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                }`}
              >
                {t === 'public' ? '🌍' : '🔒'} {t}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="btn-primary"
            >
              Let's Go 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
