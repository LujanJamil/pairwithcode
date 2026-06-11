-- Pair With Code Database Schema
-- PostgreSQL 16+
-- Created for comprehensive collaborative IDE extension

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== USERS TABLE =====
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  avatar_url TEXT,
  avatar_color VARCHAR(7) DEFAULT '#0078d4',

  -- OAuth
  oauth_provider VARCHAR(50), -- 'github', 'gitlab', etc
  oauth_id VARCHAR(255),
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,

  -- Profile
  bio TEXT,
  company VARCHAR(255),
  location VARCHAR(255),
  website VARCHAR(255),

  -- Settings
  email_verified_at TIMESTAMP,
  email_notifications BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ===== SESSIONS (ROOMS) TABLE =====
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,

  -- Access control
  is_public BOOLEAN DEFAULT false,
  password_hash VARCHAR(255), -- For private sessions

  -- Recording & Encryption
  recording_enabled BOOLEAN DEFAULT true,
  recording_url TEXT,
  is_recorded BOOLEAN DEFAULT false,

  encryption_key TEXT,
  encryption_algorithm VARCHAR(50), -- 'none', 'aes-256', 'chacha20'

  -- Session metadata
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'closed'
  max_participants INT DEFAULT 10,
  idle_timeout_minutes INT DEFAULT 60,

  -- Analytics
  total_edits INT DEFAULT 0,
  total_conflicts INT DEFAULT 0,
  total_conflicts_resolved INT DEFAULT 0,
  average_latency_ms DECIMAL(10, 2),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_sessions_owner_id ON sessions(owner_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- ===== SESSION PARTICIPANTS TABLE =====
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Participation tracking
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  -- Permissions
  role VARCHAR(50) DEFAULT 'editor', -- 'owner', 'editor', 'viewer', 'reviewer'
  can_edit BOOLEAN DEFAULT true,
  can_comment BOOLEAN DEFAULT true,
  can_record BOOLEAN DEFAULT true,

  -- Statistics
  edits_count INT DEFAULT 0,
  characters_added INT DEFAULT 0,
  characters_deleted INT DEFAULT 0,
  lines_added INT DEFAULT 0,
  lines_deleted INT DEFAULT 0,
  last_activity_at TIMESTAMP,

  UNIQUE(session_id, user_id),
  CONSTRAINT check_left_after_joined CHECK (left_at IS NULL OR left_at > joined_at)
);

CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX idx_session_participants_joined_at ON session_participants(joined_at DESC);

-- ===== MESSAGES TABLE =====
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'code', 'mention', 'file', 'emoji'

  -- Threading
  thread_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Mentions
  mentions TEXT[], -- Array of user IDs

  -- Encryption
  is_encrypted BOOLEAN DEFAULT false,
  encrypted_content TEXT,

  -- Metadata
  file_path VARCHAR(255), -- If message references a file
  start_line INT, -- Code block line reference
  end_line INT,
  language VARCHAR(50), -- Programming language

  -- Status
  status VARCHAR(50) DEFAULT 'sent', -- 'pending', 'sent', 'delivered', 'failed'

  -- Editing
  edited_at TIMESTAMP,
  edit_count INT DEFAULT 0,

  -- Reactions
  reaction_count INT DEFAULT 0,

  -- Moderation
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_thread_different_from_id CHECK (thread_id != id),
  CONSTRAINT check_reply_different_from_id CHECK (reply_to_id != id)
);

CREATE INDEX idx_messages_session_id ON messages(session_id, created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_status ON messages(status);

-- ===== MESSAGE REACTIONS TABLE =====
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

-- ===== CODE REVIEW COMMENTS TABLE =====
CREATE TABLE code_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  file_path VARCHAR(255) NOT NULL,
  line_number INT NOT NULL,
  start_char INT,
  end_char INT,

  content TEXT NOT NULL,
  comment_type VARCHAR(50) DEFAULT 'comment', -- 'comment', 'suggestion', 'question', 'issue', 'blocker'
  severity VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'error'

  -- Threading
  thread_id UUID,
  reply_to_id UUID REFERENCES code_review_comments(id) ON DELETE CASCADE,

  -- Status
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'resolved', 'dismissed'
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_code_review_session_id ON code_review_comments(session_id);
CREATE INDEX idx_code_review_file_path ON code_review_comments(session_id, file_path);
CREATE INDEX idx_code_review_status ON code_review_comments(status);

-- ===== SESSION ANALYTICS TABLE =====
CREATE TABLE session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  event_type VARCHAR(50) NOT NULL, -- 'typing', 'cursor_move', 'file_switch', 'conflict', 'save', 'paste'
  duration_ms INT,

  -- Metrics
  character_count INT,
  line_count INT,
  conflict_severity VARCHAR(50), -- 'low', 'medium', 'high'

  -- File context
  file_path VARCHAR(255),
  language VARCHAR(50),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_analytics_session_id ON session_analytics(session_id, created_at DESC);
CREATE INDEX idx_session_analytics_user_id ON session_analytics(user_id);
CREATE INDEX idx_session_analytics_event_type ON session_analytics(event_type);

-- ===== SESSION RECORDINGS TABLE =====
CREATE TABLE session_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  storage_path TEXT,
  storage_url TEXT,

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'recording', 'processing', 'ready', 'failed'
  status_message TEXT,

  -- Video metadata
  duration_ms INT,
  frame_count INT,
  fps INT DEFAULT 30,
  bitrate VARCHAR(50) DEFAULT '2500k',
  format VARCHAR(20) DEFAULT 'mp4', -- 'mp4', 'webm', 'mkv'
  resolution VARCHAR(20) DEFAULT '1920x1080',

  -- Processing
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  processing_duration_ms INT,

  -- Sharing
  is_public BOOLEAN DEFAULT false,
  shared_at TIMESTAMP,
  share_token VARCHAR(255) UNIQUE,
  share_expiry_at TIMESTAMP,

  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_session_recordings_session_id ON session_recordings(session_id);
CREATE INDEX idx_session_recordings_status ON session_recordings(status);
CREATE INDEX idx_session_recordings_created_at ON session_recordings(created_at DESC);

-- ===== USER ENCRYPTION KEYS TABLE =====
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  public_key TEXT NOT NULL,
  private_key TEXT, -- Encrypted before storage

  algorithm VARCHAR(50) NOT NULL DEFAULT 'x25519', -- 'x25519', 'rsa-4096'
  fingerprint VARCHAR(255) UNIQUE NOT NULL,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE INDEX idx_user_encryption_keys_user_id ON user_encryption_keys(user_id);
CREATE INDEX idx_user_encryption_keys_fingerprint ON user_encryption_keys(fingerprint);

-- ===== SESSION INVITATIONS TABLE =====
CREATE TABLE session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  email VARCHAR(255), -- For inviting non-users
  role VARCHAR(50) DEFAULT 'editor',

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,

  token VARCHAR(255) UNIQUE,
  token_expiry_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_invitations_session_id ON session_invitations(session_id);
CREATE INDEX idx_session_invitations_invited_user_id ON session_invitations(invited_user_id);
CREATE INDEX idx_session_invitations_token ON session_invitations(token);

-- ===== AUDIT LOG TABLE =====
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  action VARCHAR(100) NOT NULL, -- 'user.created', 'session.created', 'message.deleted', etc
  resource_type VARCHAR(50), -- 'user', 'session', 'message', 'file', etc
  resource_id VARCHAR(255),

  changes JSONB, -- Before/after values for auditing
  ip_address INET,
  user_agent TEXT,

  status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed'
  error_message TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ===== FEATURE FLAGS TABLE =====
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,

  -- Gradual rollout
  rollout_percentage INT DEFAULT 0, -- 0-100
  targeted_user_ids UUID[], -- For specific user targeting

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===== SESSIONS TABLE INDEXES FOR QUERIES =====
CREATE INDEX idx_sessions_active ON sessions(status) WHERE status = 'active';
CREATE INDEX idx_users_active ON users(username) WHERE deleted_at IS NULL;

-- ===== VIEWS =====
CREATE VIEW active_sessions AS
SELECT
  s.id,
  s.name,
  s.owner_id,
  COUNT(sp.user_id) as participant_count,
  MAX(sp.joined_at) as last_joined_at,
  s.created_at
FROM sessions s
LEFT JOIN session_participants sp ON s.id = sp.session_id AND sp.is_active = true
WHERE s.status = 'active' AND s.deleted_at IS NULL
GROUP BY s.id, s.name, s.owner_id, s.created_at;

CREATE VIEW user_session_stats AS
SELECT
  u.id as user_id,
  u.username,
  COUNT(DISTINCT sp.session_id) as total_sessions,
  COUNT(DISTINCT m.id) as total_messages,
  SUM(sa.character_count) as total_characters_typed,
  MAX(m.created_at) as last_message_at
FROM users u
LEFT JOIN session_participants sp ON u.id = sp.user_id
LEFT JOIN messages m ON u.id = m.user_id
LEFT JOIN session_analytics sa ON u.id = sa.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username;

-- ===== TRIGGERS FOR UPDATED_AT =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER messages_updated_at BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER code_review_comments_updated_at BEFORE UPDATE ON code_review_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== GRANT PERMISSIONS =====
-- Create application role (for security in production)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pairwithcode_app') THEN
    CREATE ROLE pairwithcode_app LOGIN PASSWORD 'app_password_change_in_production';
  END IF;
END $$;

-- Grant appropriate permissions
GRANT CONNECT ON DATABASE pairwithcode TO pairwithcode_app;
GRANT USAGE ON SCHEMA public TO pairwithcode_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pairwithcode_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pairwithcode_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pairwithcode_app;

-- Create read-only role for analytics
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pairwithcode_readonly') THEN
    CREATE ROLE pairwithcode_readonly LOGIN PASSWORD 'readonly_password_change_in_production';
  END IF;
END $$;

GRANT CONNECT ON DATABASE pairwithcode TO pairwithcode_readonly;
GRANT USAGE ON SCHEMA public TO pairwithcode_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pairwithcode_readonly;
