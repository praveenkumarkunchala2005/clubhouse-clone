import React from 'react';

interface RoomCardProps {
  id: string;
  title: string;
  type: string;
  participantCount: number;
  onClick: () => void;
}

export default function RoomCard({ title, type, participantCount, onClick }: RoomCardProps) {
  return (
    <div
      onClick={onClick}
      className="group glass hover:bg-white/[0.08] cursor-pointer hover:shadow-glass hover:-translate-y-1 transition-all duration-300 ease-out p-5 animate-slide-up"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-base text-white/90 group-hover:text-accent-400 transition-colors line-clamp-2 leading-tight">
          {title}
        </h3>
        {type === 'private' && (
          <span className="bg-white/[0.06] text-white/40 text-[10px] px-2 py-1 rounded-md font-bold border border-white/[0.08] flex-shrink-0 ml-2">
            🔒 Private
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">
        <div className="flex items-center gap-2 text-white/40 text-sm font-medium">
          {/* Live pulse */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500" />
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/20">
            <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
          </svg>
          {participantCount} listening
        </div>
        <span className="text-accent-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          Join →
        </span>
      </div>
    </div>
  );
}
