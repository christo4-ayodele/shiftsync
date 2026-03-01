-- ShiftSync Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE schedule_status AS ENUM ('draft', 'published');
CREATE TYPE assignment_status AS ENUM ('assigned', 'swapped', 'dropped');
CREATE TYPE swap_type AS ENUM ('swap', 'drop');
CREATE TYPE swap_status AS ENUM ('pending_peer', 'pending_manager', 'approved', 'rejected', 'cancelled', 'expired');
CREATE TYPE availability_type AS ENUM ('recurring', 'exception');

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'staff',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  desired_weekly_hours INTEGER,
  notification_preferences JSONB NOT NULL DEFAULT '{"shift_assigned":"in_app","shift_changed":"in_app","schedule_published":"in_app","swap_updates":"in_app","overtime_warnings":"in_app"}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skills
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff Skills (many-to-many)
CREATE TABLE staff_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, skill_id)
);

-- Staff Locations (certifications, soft-delete via decertified_at)
CREATE TABLE staff_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  certified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decertified_at TIMESTAMPTZ,
  UNIQUE(staff_id, location_id)
);

-- Manager Locations (which locations a manager oversees)
CREATE TABLE manager_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(manager_id, location_id)
);

-- Availability (recurring weekly + one-off exceptions)
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type availability_type NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  specific_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (type = 'recurring' AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (type = 'exception' AND specific_date IS NOT NULL)
  )
);

-- Schedules (per location per week)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Always a Monday
  status schedule_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id),
  edit_cutoff_hours INTEGER NOT NULL DEFAULT 48,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, week_start)
);

-- Shifts
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  required_skill_id UUID NOT NULL REFERENCES skills(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  headcount_needed INTEGER NOT NULL DEFAULT 1 CHECK (headcount_needed > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- Shift Assignments
CREATE TABLE shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status assignment_status NOT NULL DEFAULT 'assigned',
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, staff_id)
);

-- Swap Requests
CREATE TABLE swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type swap_type NOT NULL,
  requesting_assignment_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
  target_staff_id UUID REFERENCES profiles(id),
  target_assignment_id UUID REFERENCES shift_assignments(id),
  status swap_status NOT NULL DEFAULT 'pending_peer',
  manager_id UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CHECK (
    (type = 'swap' AND target_staff_id IS NOT NULL) OR
    (type = 'drop')
  )
);

-- Overtime Overrides (for 7th consecutive day)
CREATE TABLE overtime_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  manager_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_method TEXT NOT NULL DEFAULT 'in_app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_staff_skills_staff ON staff_skills(staff_id);
CREATE INDEX idx_staff_skills_skill ON staff_skills(skill_id);
CREATE INDEX idx_staff_locations_staff ON staff_locations(staff_id);
CREATE INDEX idx_staff_locations_location ON staff_locations(location_id);
CREATE INDEX idx_availability_staff ON availability(staff_id);
CREATE INDEX idx_availability_day ON availability(day_of_week);
CREATE INDEX idx_schedules_location ON schedules(location_id);
CREATE INDEX idx_schedules_week ON schedules(week_start);
CREATE INDEX idx_shifts_schedule ON shifts(schedule_id);
CREATE INDEX idx_shifts_location ON shifts(location_id);
CREATE INDEX idx_shifts_time ON shifts(start_time, end_time);
CREATE INDEX idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX idx_shift_assignments_staff ON shift_assignments(staff_id);
CREATE INDEX idx_swap_requests_status ON swap_requests(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_time ON audit_log(created_at);
CREATE INDEX idx_manager_locations_manager ON manager_locations(manager_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user manages a location
CREATE OR REPLACE FUNCTION manages_location(loc_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_locations 
    WHERE manager_id = auth.uid() AND location_id = loc_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can read all profiles, update own
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Service role can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- Locations: everyone can read
CREATE POLICY "Anyone can view locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Admins can manage locations" ON locations FOR ALL USING (get_user_role() = 'admin');

-- Skills: everyone can read
CREATE POLICY "Anyone can view skills" ON skills FOR SELECT USING (true);
CREATE POLICY "Admins can manage skills" ON skills FOR ALL USING (get_user_role() = 'admin');

-- Staff Skills: everyone can read, admins/managers can manage
CREATE POLICY "Anyone can view staff skills" ON staff_skills FOR SELECT USING (true);
CREATE POLICY "Admins can manage staff skills" ON staff_skills FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Managers can manage staff skills" ON staff_skills FOR ALL USING (get_user_role() = 'manager');

-- Staff Locations: everyone can read, admins/managers can manage
CREATE POLICY "Anyone can view staff locations" ON staff_locations FOR SELECT USING (true);
CREATE POLICY "Admins can manage staff locations" ON staff_locations FOR ALL USING (get_user_role() = 'admin');

-- Manager Locations: everyone can read, admins can manage
CREATE POLICY "Anyone can view manager locations" ON manager_locations FOR SELECT USING (true);
CREATE POLICY "Admins can manage manager locations" ON manager_locations FOR ALL USING (get_user_role() = 'admin');

-- Availability: staff can manage own, managers can view their location's staff
CREATE POLICY "Staff can view own availability" ON availability FOR SELECT USING (staff_id = auth.uid());
CREATE POLICY "Staff can manage own availability" ON availability FOR ALL USING (staff_id = auth.uid());
CREATE POLICY "Managers can view availability" ON availability FOR SELECT USING (
  get_user_role() IN ('manager', 'admin')
);

-- Schedules: staff see published only at their locations, managers see their locations
CREATE POLICY "Staff see published schedules" ON schedules FOR SELECT USING (
  status = 'published' OR get_user_role() IN ('manager', 'admin')
);
CREATE POLICY "Managers can manage schedules" ON schedules FOR ALL USING (
  get_user_role() = 'admin' OR manages_location(location_id)
);

-- Shifts: follow schedule visibility
CREATE POLICY "Anyone can view shifts" ON shifts FOR SELECT USING (true);
CREATE POLICY "Managers can manage shifts" ON shifts FOR ALL USING (
  get_user_role() = 'admin' OR manages_location(location_id)
);

-- Shift Assignments: everyone can read, managers can manage
CREATE POLICY "Anyone can view assignments" ON shift_assignments FOR SELECT USING (true);
CREATE POLICY "Managers can manage assignments" ON shift_assignments FOR ALL USING (
  get_user_role() IN ('admin', 'manager')
);

-- Swap Requests: participants can view, managers can manage
CREATE POLICY "Users can view swap requests" ON swap_requests FOR SELECT USING (true);
CREATE POLICY "Staff can create swap requests" ON swap_requests FOR INSERT WITH CHECK (
  get_user_role() = 'staff' OR get_user_role() = 'manager' OR get_user_role() = 'admin'
);
CREATE POLICY "Users can update swap requests" ON swap_requests FOR UPDATE USING (true);

-- Overtime Overrides: managers and admins
CREATE POLICY "Anyone can view overrides" ON overtime_overrides FOR SELECT USING (true);
CREATE POLICY "Managers can create overrides" ON overtime_overrides FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'manager')
);

-- Notifications: users see only their own
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Audit Log: managers and admins can view
CREATE POLICY "Managers and admins can view audit log" ON audit_log FOR SELECT USING (
  get_user_role() IN ('admin', 'manager')
);
CREATE POLICY "System can create audit entries" ON audit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE swap_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
