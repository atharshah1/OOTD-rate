-- Migration: Allow post owners to write media rows under RLS.
-- Without this, uploads can create posts but fail to persist media records.

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post owners can add media" ON media;
CREATE POLICY "Post owners can add media" ON media
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM posts
      WHERE posts.id = media.post_id
        AND posts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Post owners can update media" ON media;
CREATE POLICY "Post owners can update media" ON media
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM posts
      WHERE posts.id = media.post_id
        AND posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM posts
      WHERE posts.id = media.post_id
        AND posts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Post owners can delete media" ON media;
CREATE POLICY "Post owners can delete media" ON media
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM posts
      WHERE posts.id = media.post_id
        AND posts.user_id = auth.uid()
    )
  );
