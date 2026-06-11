-- ============ SESSION RECORDINGS ============
CREATE TABLE IF NOT EXISTS session_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'recording', -- recording, completed, failed
  frames JSONB DEFAULT '[]'::jsonb,
  duration INTEGER,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_recordings_session ON session_recordings(session_id);
CREATE INDEX idx_recordings_status ON session_recordings(status);
CREATE INDEX idx_recordings_created ON session_recordings(created_at);

-- ============ DEBUG SESSIONS ============
CREATE TABLE IF NOT EXISTS debug_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  session_name VARCHAR(255),
  state VARCHAR(50) DEFAULT 'stopped', -- running, stopped, paused
  call_stack JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_debug_sessions_session ON debug_sessions(session_id);
CREATE INDEX idx_debug_sessions_state ON debug_sessions(state);

-- ============ DEBUG BREAKPOINTS ============
CREATE TABLE IF NOT EXISTS debug_breakpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  column_number INTEGER DEFAULT 0,
  user_id VARCHAR(255),
  condition TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_breakpoints_session ON debug_breakpoints(session_id);
CREATE INDEX idx_breakpoints_file ON debug_breakpoints(file_path);
CREATE INDEX idx_breakpoints_line ON debug_breakpoints(line_number);

-- ============ ENCRYPTION KEYS ============
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  provider VARCHAR(50) DEFAULT 'custom', -- custom, github, gitlab, etc.
  fingerprint VARCHAR(16),
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, session_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_encryption_keys_session ON user_encryption_keys(session_id);
CREATE INDEX idx_encryption_keys_user ON user_encryption_keys(user_id);
CREATE INDEX idx_encryption_keys_fingerprint ON user_encryption_keys(fingerprint);

-- ============ TERMINAL SESSIONS ============
CREATE TABLE IF NOT EXISTS terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  terminal_name VARCHAR(255),
  shell_type VARCHAR(50),
  cols INTEGER DEFAULT 80,
  rows INTEGER DEFAULT 30,
  status VARCHAR(50) DEFAULT 'active', -- active, closed
  created_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_terminal_sessions_session ON terminal_sessions(session_id);
CREATE INDEX idx_terminal_sessions_user ON terminal_sessions(user_id);

-- ============ AUDIO/VIDEO SESSIONS ============
CREATE TABLE IF NOT EXISTS av_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  initiator_id VARCHAR(255) NOT NULL,
  recipient_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, ended, failed
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_av_sessions_session ON av_sessions(session_id);
CREATE INDEX idx_av_sessions_status ON av_sessions(status);

-- ============ UPDATE EXISTING TABLES ============

-- Add encryption flags to existing messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encryption_provider VARCHAR(50);

-- Add recording info to sessions if not exists
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_recording BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_recording_id UUID;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(encrypted);
CREATE INDEX IF NOT EXISTS idx_sessions_recording ON sessions(is_recording);
