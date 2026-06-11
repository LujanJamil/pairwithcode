-- ============ ROLE-BASED ACCESS CONTROL (RBAC) ============

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
  ('owner', 'Full access to session and user management', ARRAY['session:create', 'session:delete', 'session:manage_users', 'session:view', 'session:edit', 'message:send', 'code-review:create', 'recording:start', 'encryption:manage'], TRUE),
  ('editor', 'Can edit files and participate in session', ARRAY['session:view', 'session:edit', 'message:send', 'code-review:create', 'code-review:view'], TRUE),
  ('reviewer', 'Can view and review code', ARRAY['session:view', 'code-review:create', 'code-review:view', 'message:send'], TRUE),
  ('viewer', 'Read-only access', ARRAY['session:view', 'code-review:view', 'message:send'], TRUE)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL,
  assigned_by VARCHAR(255),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(user_id, session_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX idx_role_assignments_session ON user_role_assignments(session_id);
CREATE INDEX idx_role_assignments_role ON user_role_assignments(role_id);

-- ============ AUDIT LOGGING ============

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  session_id VARCHAR(255),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  changes JSONB,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_id, resource_type);
CREATE INDEX idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ============ CODE REVIEW THREADING ============

CREATE TABLE IF NOT EXISTS code_review_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_code_review_threads_session ON code_review_threads(session_id);
CREATE INDEX idx_code_review_threads_file ON code_review_threads(file_path);
CREATE INDEX idx_code_review_threads_status ON code_review_threads(status);

-- Update code_review_comments to add threadId
ALTER TABLE code_review_comments ADD COLUMN IF NOT EXISTS thread_id UUID;
ALTER TABLE code_review_comments ADD CONSTRAINT fk_thread_id FOREIGN KEY (thread_id) REFERENCES code_review_threads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_code_review_comments_thread ON code_review_comments(thread_id);

-- ============ ANALYTICS ENHANCEMENTS ============

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL UNIQUE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  total_edits INTEGER DEFAULT 0,
  total_conflicts INTEGER DEFAULT 0,
  total_characters_added INTEGER DEFAULT 0,
  total_characters_deleted INTEGER DEFAULT 0,
  average_latency_ms INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_sessions_session ON analytics_sessions(session_id);
CREATE INDEX idx_analytics_sessions_time ON analytics_sessions(start_time, end_time);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  metadata JSONB,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_events_session ON analytics_events(session_id, timestamp DESC);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);

-- ============ SESSION INVITATIONS ============

CREATE TABLE IF NOT EXISTS session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by VARCHAR(255),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_session_invitations_token ON session_invitations(token);
CREATE INDEX idx_session_invitations_session ON session_invitations(session_id);
CREATE INDEX idx_session_invitations_expires ON session_invitations(expires_at);

-- ============ FEATURE FLAGS ============

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  target_users TEXT[], -- user IDs that have access to this feature
  target_percentage INTEGER DEFAULT 100, -- 0-100 percentage of users
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO feature_flags (name, enabled, description) VALUES
  ('encryption', TRUE, 'End-to-end encryption'),
  ('recording', TRUE, 'Session recording'),
  ('code_review', TRUE, 'Code review annotations'),
  ('saml_sso', FALSE, 'SAML/SSO authentication'),
  ('analytics_dashboard', TRUE, 'Analytics dashboard'),
  ('av_calls', TRUE, 'Audio/Video calls'),
  ('shared_terminal', TRUE, 'Shared terminal'),
  ('debug_session_sharing', FALSE, 'Debugger session sharing')
ON CONFLICT (name) DO NOTHING;

-- ============ OAUTH TOKENS (for refresh tokens) ============

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens(expires_at);

-- ============ SESSION METADATA ============

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS encryption_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_tags ON sessions USING GIN(tags);

-- ============ PERFORMANCE VIEWS ============

CREATE OR REPLACE VIEW active_sessions AS
SELECT
  s.id,
  s.name,
  s.created_at,
  COUNT(DISTINCT sp.user_id) as participant_count,
  MAX(sp.last_active_at) as last_activity,
  s.is_recording
FROM sessions s
LEFT JOIN session_participants sp ON s.id = sp.session_id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.created_at, s.is_recording
ORDER BY s.created_at DESC;

CREATE OR REPLACE VIEW user_session_stats AS
SELECT
  sp.user_id,
  COUNT(DISTINCT sp.session_id) as total_sessions,
  SUM(ae.duration_ms) as total_duration_ms,
  COUNT(DISTINCT ae.id) as total_events,
  MAX(ae.timestamp) as last_activity
FROM session_participants sp
LEFT JOIN analytics_events ae ON sp.user_id = ae.user_id
WHERE sp.deleted_at IS NULL
GROUP BY sp.user_id;
