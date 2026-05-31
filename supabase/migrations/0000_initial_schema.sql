-- Supabase Initial Schema for DefensDark AI

-- 1. Chats
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  user_id TEXT NOT NULL,
  finish_reason TEXT,
  active_stream_id TEXT,
  active_trigger_run_id TEXT,
  canceled_at BIGINT,
  default_model_slug TEXT,
  todos JSONB DEFAULT '[]'::jsonb,
  branched_from_chat_id UUID REFERENCES chats(id),
  latest_summary_id UUID,
  update_time BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
  share_id TEXT,
  share_date BIGINT,
  pinned_at BIGINT,
  sandbox_type TEXT,
  selected_model TEXT,
  codex_thread_id TEXT
);

CREATE INDEX idx_chats_user_time ON chats(user_id, update_time);
CREATE INDEX idx_chats_share_id ON chats(share_id);

-- 2. Chat Summaries
CREATE TABLE chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  summary_up_to_message_id UUID NOT NULL,
  summary_up_to_message_creation_time BIGINT,
  previous_summaries JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX idx_chat_summaries_chat_id ON chat_summaries(chat_id);
ALTER TABLE chats ADD CONSTRAINT fk_latest_summary FOREIGN KEY (latest_summary_id) REFERENCES chat_summaries(id) ON DELETE SET NULL;

-- 3. Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT,
  file_ids JSONB DEFAULT '[]'::jsonb,
  feedback_id UUID,
  source_message_id UUID,
  update_time BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
  model TEXT,
  mode TEXT,
  generation_started_at BIGINT,
  generation_time_ms BIGINT,
  finish_reason TEXT,
  usage JSONB,
  is_hidden BOOLEAN DEFAULT false
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- 4. Files
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  s3_key TEXT,
  storage_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  file_token_size BIGINT NOT NULL,
  content TEXT,
  is_attached BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_s3_key ON files(s3_key);

-- 5. User Customization
CREATE TABLE user_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  nickname TEXT,
  occupation TEXT,
  personality TEXT,
  traits TEXT,
  additional_info TEXT,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
  include_memory_entries BOOLEAN DEFAULT true,
  guardrails_config TEXT,
  caido_enabled BOOLEAN DEFAULT false,
  caido_port INTEGER,
  extra_usage_enabled BOOLEAN DEFAULT false,
  max_mode_enabled BOOLEAN DEFAULT false
);

-- 6. Usage Logs
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('included', 'extra')),
  input_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  cache_read_tokens BIGINT,
  cache_write_tokens BIGINT,
  total_tokens BIGINT NOT NULL,
  cost_dollars NUMERIC NOT NULL,
  max_mode BOOLEAN,
  byok BOOLEAN,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);

-- 7. Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  note_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  tokens INTEGER NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_note_id ON notes(note_id);

-- ROW LEVEL SECURITY (RLS)

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Note: We are using a custom JWT from WorkOS, so `auth.uid()` might not work directly
-- unless the custom JWT is properly configured in Supabase.
-- For a custom JWT where the `sub` claim is the WorkOS user_id:
-- We can use: `auth.jwt() ->> 'sub' = user_id`

CREATE POLICY "Users can manage their own chats" ON chats
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can manage their own chat summaries" ON chat_summaries
  FOR ALL USING (
    chat_id IN (SELECT id FROM chats WHERE auth.jwt() ->> 'sub' = user_id)
  );

CREATE POLICY "Users can manage their own messages" ON messages
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can manage their own files" ON files
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can manage their own customization" ON user_customization
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can view their own usage logs" ON usage_logs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can manage their own notes" ON notes
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);
