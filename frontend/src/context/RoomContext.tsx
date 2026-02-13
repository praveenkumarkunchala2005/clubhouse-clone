import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  role: 'host' | 'co-host' | 'speaker' | 'listener';
  mic_enabled: boolean;
  is_connected: boolean;
  joined_at: string;
}

export interface Room {
  id: string;
  title: string;
  host_id: string;
  type: 'public' | 'private';
  is_active: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface RoomContextType {
  room: Room | null;
  participants: Participant[];
  messages: Message[];
  myParticipant: Participant | null;
  livekitToken: string | null;
  setRoom: (room: Room | null) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (participant: Participant) => void;
  updateParticipantField: (userId: string, fields: Partial<Participant>) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setMyParticipant: (participant: Participant | null) => void;
  setLivekitToken: (token: string | null) => void;
  clearRoom: () => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);

  // Full participant replacement
  const updateParticipant = useCallback((updated: Participant) => {
    setParticipants((prev) =>
      prev.map((p) => (p.user_id === updated.user_id ? updated : p))
    );
    setMyParticipant((prev) =>
      prev && prev.user_id === updated.user_id ? updated : prev
    );
  }, []);

  // Partial field update — merges fields without wiping others (bug #6 fix)
  const updateParticipantField = useCallback((userId: string, fields: Partial<Participant>) => {
    setParticipants((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, ...fields } : p))
    );
    setMyParticipant((prev) =>
      prev && prev.user_id === userId ? { ...prev, ...fields } : prev
    );
  }, []);

  const addParticipant = useCallback((participant: Participant) => {
    setParticipants((prev) => {
      if (prev.find((p) => p.user_id === participant.user_id)) {
        return prev.map((p) => (p.user_id === participant.user_id ? participant : p));
      }
      return [...prev, participant];
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    setParticipants((prev) => prev.filter((p) => p.user_id !== userId));
  }, []);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearRoom = useCallback(() => {
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    setMyParticipant(null);
    setLivekitToken(null);
  }, []);

  return (
    <RoomContext.Provider
      value={{
        room,
        participants,
        messages,
        myParticipant,
        livekitToken,
        setRoom,
        setParticipants,
        updateParticipant,
        updateParticipantField,
        addParticipant,
        removeParticipant,
        setMessages,
        addMessage,
        setMyParticipant,
        setLivekitToken,
        clearRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
}
