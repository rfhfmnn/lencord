-- ============================================================================
-- Migration: 20260925000005_add_notification_preferences_to_profiles.sql
-- Description: Add notification_preferences column to profiles table for multi-channel
--              notification preferences (email, sms, whatsapp).
-- Specification: _docs/next_tasks.md Task 27 & GitHub Issue #50
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL
  DEFAULT '{"email": true, "sms": true, "whatsapp": true}'::jsonb;

-- Comment on column
COMMENT ON COLUMN profiles.notification_preferences IS
  'User notification channel preferences allowing independent toggles for email, sms, and whatsapp alerts';
