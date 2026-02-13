-- ============================================
-- Clubhouse Clone — Supabase Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  host_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_participants INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'co-host', 'speaker', 'listener')),
  mic_enabled BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  socket_id TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_rooms_is_active ON rooms(is_active) WHERE is_active = true;
CREATE INDEX idx_participants_room_id ON participants(room_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_participants_connected ON participants(room_id, is_connected) WHERE is_connected = true;
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(room_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ----- ROOMS POLICIES -----

-- Anyone authenticated can view active public rooms
CREATE POLICY "rooms_select_public" ON rooms
  FOR SELECT
  TO authenticated
  USING (is_active = true AND type = 'public');

-- Participants can view private rooms they belong to
CREATE POLICY "rooms_select_private" ON rooms
  FOR SELECT
  TO authenticated
  USING (
    type = 'private' AND
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.room_id = rooms.id
        AND participants.user_id = auth.uid()
    )
  );

-- Authenticated users can create rooms
CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

-- Only host can update their room
CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- ----- PARTICIPANTS POLICIES -----

-- Participants can view other participants in the same room
CREATE POLICY "participants_select" ON participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM participants AS p
      WHERE p.room_id = participants.room_id
        AND p.user_id = auth.uid()
    )
  );

-- Users can join rooms (insert themselves)
CREATE POLICY "participants_insert" ON participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own participant record (mic toggle, connection)
CREATE POLICY "participants_update_self" ON participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Host/co-host can update any participant in their room (role changes)
CREATE POLICY "participants_update_host" ON participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM participants AS p
      WHERE p.room_id = participants.room_id
        AND p.user_id = auth.uid()
        AND p.role IN ('host', 'co-host')
    )
  );

-- Users can remove themselves from a room
CREATE POLICY "participants_delete_self" ON participants
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Host can remove anyone from their room
CREATE POLICY "participants_delete_host" ON participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM participants AS p
      WHERE p.room_id = participants.room_id
        AND p.user_id = auth.uid()
        AND p.role = 'host'
    )
  );

-- ----- MESSAGES POLICIES -----

-- Only room participants can read messages
CREATE POLICY "messages_select" ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.room_id = messages.room_id
        AND participants.user_id = auth.uid()
    )
  );

-- Only room participants can send messages
CREATE POLICY "messages_insert" ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.room_id = messages.room_id
        AND participants.user_id = auth.uid()
        AND participants.is_connected = true
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Prevent role escalation: listeners cannot self-promote
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  -- If user is updating their own record and changing role, block it
  IF OLD.user_id = auth.uid() AND NEW.role != OLD.role THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- If someone else is changing the role, verify they are host/co-host
  IF OLD.user_id != auth.uid() AND NEW.role != OLD.role THEN
    SELECT role INTO actor_role FROM participants
    WHERE room_id = OLD.room_id AND user_id = auth.uid();

    IF actor_role NOT IN ('host', 'co-host') THEN
      RAISE EXCEPTION 'Only host or co-host can change roles';
    END IF;

    -- Prevent promoting to host
    IF NEW.role = 'host' AND actor_role != 'host' THEN
      RAISE EXCEPTION 'Only host can promote to host';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON participants
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION prevent_role_escalation();

-- ============================================
-- SERVICE ROLE BYPASS
-- ============================================
-- Note: The backend uses the service_role key which bypasses RLS.
-- RLS policies above protect direct client access via Supabase client libraries.
