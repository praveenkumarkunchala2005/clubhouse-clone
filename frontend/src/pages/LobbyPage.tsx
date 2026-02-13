import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRooms } from '../services/api';
import { emitWithAck, getSocket } from '../services/socket';
import RoomCard from '../components/RoomCard';
import CreateRoomModal from '../components/CreateRoomModal';

interface RoomPreview {
  id: string;
  title: string;
  type: string;
  host_id: string;
  participant_count: number;
}

export default function LobbyPage() {
  const { user, signOut, getToken } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomPreview[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'public' | 'private'>('public');

  const fetchRooms = () => {
    const token = getToken();
    if (token) getRooms(token).then((data) => setRooms(data.rooms || [])).catch(console.error);
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [getToken]);

  useEffect(() => {
    try {
      const socket = getSocket();

      const handleCreated = ({ room, participant_count }: any) => {
        setRooms((prev) => {
          if (prev.find((r) => r.id === room.id)) return prev;
          return [{ ...room, participant_count }, ...prev];
        });
      };

      const handleUpdated = ({ roomId, participant_count }: any) => {
        setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, participant_count } : r)));
      };

      const handleRemoved = ({ roomId }: any) => {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
      };

      socket.on('room_created', handleCreated);
      socket.on('room_updated', handleUpdated);
      socket.on('room_removed', handleRemoved);

      return () => {
        socket.off('room_created', handleCreated);
        socket.off('room_updated', handleUpdated);
        socket.off('room_removed', handleRemoved);
      };
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await emitWithAck('create_room', { title: newTitle.trim(), type: newType });
      if (res.success && res.data) {
        setShowCreate(false);
        navigate(`/room/${res.data.room.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass border-b border-white/[0.04] rounded-none">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-lg text-white tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500/30 to-accent-600/30 flex items-center justify-center border border-accent-500/20">
              <span className="text-base">⚡</span>
            </div>
            <span className="text-gradient">foundersTribe</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-500/30 to-violet-500/30 flex items-center justify-center text-white/80 font-bold text-xs ring-2 ring-white/[0.06]">
                {user?.email?.slice(0, 2).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                className="text-sm font-medium text-white/30 hover:text-red-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Active Rooms</h1>
            <p className="text-white/30 text-sm mt-1">Join a conversation or start your own.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Start Room
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              id={room.id}
              title={room.title}
              type={room.type}
              participantCount={room.participant_count}
              onClick={() => navigate(`/room/${room.id}`)}
            />
          ))}
          {rooms.length === 0 && (
            <div className="col-span-full py-20 text-center animate-fade-in">
              <div className="w-16 h-16 glass rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                😴
              </div>
              <h3 className="text-white/70 font-medium text-lg">No active rooms</h3>
              <p className="text-white/30 mt-1">Be the first to start a conversation!</p>
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreate && (
        <CreateRoomModal
          title={newTitle}
          type={newType}
          onTitleChange={setNewTitle}
          onTypeChange={setNewType}
          onSubmit={handleCreateRoom}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
