-- ============================================================================
-- Migration: 20260925000003_create_notifications_table_and_rls.sql
-- Description: In-app notifications table, indexes, profile schema extensions,
--              and Row Level Security (RLS) policies for Lencord P2P Platform.
-- Specification: _docs/next_plan.md Sections 3.1 & 3.2, _docs/next_tasks.md Task 2 & 23
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Custom ENUM Types & Profile Extensions
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend user_role to support 'borrower' alongside 'sme', 'investor', 'admin'
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'borrower';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend profiles table with email, name, and verification fields if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. Table: notifications
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Indexes for Query Performance
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Activation
-- ----------------------------------------------------------------------------

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security Policies for notifications
-- ----------------------------------------------------------------------------

-- 5.1. Admins have full access to notifications
DROP POLICY IF EXISTS "Admins have full access to notifications" ON notifications;
CREATE POLICY "Admins have full access to notifications"
  ON notifications FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 5.2. Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- 5.3. Users can update their own notifications (e.g. mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5.4. Users, admins, and service role can insert notifications
DROP POLICY IF EXISTS "Users and services can insert notifications" ON notifications;
CREATE POLICY "Users and services can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin());
