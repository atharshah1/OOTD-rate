-- Migration: Add OAuth token storage and Instagram post tracking
-- Run this in the Supabase SQL Editor

-- Table to store OAuth provider tokens (Google, Instagram, etc.)
CREATE TABLE IF NOT EXISTS user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  instagram_handle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_id ON user_oauth_tokens(user_id);

-- Enable RLS
ALTER TABLE user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own tokens
CREATE POLICY "Users can view own OAuth tokens" ON user_oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth tokens" ON user_oauth_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OAuth tokens" ON user_oauth_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own OAuth tokens" ON user_oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_user_oauth_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_oauth_tokens_timestamp BEFORE UPDATE ON user_oauth_tokens
FOR EACH ROW EXECUTE FUNCTION update_user_oauth_tokens_timestamp();

-- Add Instagram-specific columns to posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS instagram_post_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_reel_id TEXT;
