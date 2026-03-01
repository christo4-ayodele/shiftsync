-- ShiftSync Seed Data  
-- "Coastal Eats" restaurant group demo data
-- Run this AFTER the migration (001_schema.sql)
-- 
-- NOTE: This uses fixed UUIDs so it's idempotent.
-- All demo user passwords are: password123
-- You must create the auth.users entries first in Supabase Auth,
-- then this script populates their profiles and all related data.

-- ============================================
-- STEP 1: Create Auth Users via Supabase Auth API
-- Use the Supabase dashboard or the management API to create these users.
-- After creating them, note their UUIDs and update below if needed.
--
-- For demo purposes, we use supabase.auth.admin.createUser() in a script.
-- See src/lib/seed.ts for the programmatic seeder.
-- ============================================

-- Clean existing data (in reverse dependency order)
TRUNCATE audit_log CASCADE;
TRUNCATE notifications CASCADE;
TRUNCATE overtime_overrides CASCADE;
TRUNCATE swap_requests CASCADE;
TRUNCATE shift_assignments CASCADE;
TRUNCATE shifts CASCADE;
TRUNCATE schedules CASCADE;
TRUNCATE availability CASCADE;
TRUNCATE manager_locations CASCADE;
TRUNCATE staff_locations CASCADE;
TRUNCATE staff_skills CASCADE;
TRUNCATE skills CASCADE;
TRUNCATE locations CASCADE;
-- Don't truncate profiles - those are tied to auth.users

-- ============================================
-- LOCATIONS (4 restaurants in the Coastal Eats group)
-- ============================================
INSERT INTO locations (id, name, address, timezone) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Downtown Bistro', '123 Main St, Charleston, SC 29401', 'America/New_York'),
  ('a0000000-0000-0000-0000-000000000002', 'Harbor View', '456 Harbor Dr, Charleston, SC 29401', 'America/New_York'),
  ('a0000000-0000-0000-0000-000000000003', 'Folly Beach Grill', '789 Center St, Folly Beach, SC 29439', 'America/New_York'),
  ('a0000000-0000-0000-0000-000000000004', 'Airport Express', '5500 International Blvd, N Charleston, SC 29418', 'America/New_York');

-- ============================================
-- SKILLS
-- ============================================
INSERT INTO skills (id, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Grill'),
  ('b0000000-0000-0000-0000-000000000002', 'Sauté'),
  ('b0000000-0000-0000-0000-000000000003', 'Prep'),
  ('b0000000-0000-0000-0000-000000000004', 'FOH'),
  ('b0000000-0000-0000-0000-000000000005', 'Bar'),
  ('b0000000-0000-0000-0000-000000000006', 'Expo');
