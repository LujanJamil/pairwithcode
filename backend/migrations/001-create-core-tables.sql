-- Create extensions
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
CREATE EXTENSION IF NOT EXISTS hstore;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  oauth_provider VARCHAR(50),
  oauth_provider_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  UNIQUE(oauth_provider, oauth_provider_id)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_name VARCHAR(255) NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  max_participants INT DEFAULT 10,
  is_public BOOLEAN DEFAULT false,
  encryption_enabled BOOLEAN DEFAULT true
);

-- Session participants
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  UNIQUE(session_id, user_id)
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  file_path TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Code review comments
CREATE TABLE IF NOT EXISTS code_review_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_number INT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  content TEXT NOT NULL,
  type VARCHAR(50),
  severity VARCHAR(50),
  status VARCHAR(50) DEFAULT 'open',
  thread_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50),
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- User encryption keys
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  key_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  rotated_at TIMESTAMP
);

-- OAuth accounts linking
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50),
  provider_id VARCHAR(255),
  provider_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Session recordings
CREATE TABLE IF NOT EXISTS session_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  video_url TEXT,
  storage_path TEXT,
  duration_seconds INT,
  file_size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_analytics_session ON analytics_events(session_id);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_code_review_session ON code_review_comments(session_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_sessions_created ON sessions(created_at);
CREATE INDEX idx_participants_session ON session_participants(session_id);

-- Create views for common queries
CREATE OR REPLACE VIEW active_sessions AS
SELECT s.*, COUNT(sp.user_id) as participant_count
FROM sessions s
LEFT JOIN session_participants sp ON s.id = sp.session_id AND sp.left_at IS NULL
WHERE s.ended_at IS NULL
GROUP BY s.id;
