-- Migration: Enforce safer rating and sharing rules
-- Run this in Supabase SQL editor

-- Ensure one rating per authenticated user per post
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique_user_per_post
  ON ratings(post_id, user_id)
  WHERE user_id IS NOT NULL;

-- Replace permissive ratings insert policy with guarded version
DROP POLICY IF EXISTS "Users can create ratings" ON ratings;
CREATE POLICY "Users can create ratings" ON ratings
  FOR INSERT
  WITH CHECK (
    (
      auth.uid() IS NULL
      AND user_id IS NULL
    )
    OR (
      auth.uid() IS NOT NULL
      AND user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM posts
        WHERE posts.id = ratings.post_id
          AND posts.user_id = auth.uid()
      )
    )
  );

-- Allow post owners to create share links for their own posts
CREATE POLICY "Post owners can create share links" ON shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM posts
      WHERE posts.id = shares.post_id
        AND posts.user_id = auth.uid()
    )
  );
