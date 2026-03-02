// Re-export the generated Database type
export type { Database } from '@/lib/supabase/database.types';
import type { Database } from '@/lib/supabase/database.types';
export type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from '@/lib/supabase/database.types';

// ==============================
// Convenience type aliases for enums
// ==============================
export type UserRole = Database['public']['Enums']['user_role'];
export type ScheduleStatus = Database['public']['Enums']['schedule_status'];
export type AssignmentStatus = Database['public']['Enums']['assignment_status'];
export type SwapType = Database['public']['Enums']['swap_type'];
export type SwapStatus = Database['public']['Enums']['swap_status'];
export type AvailabilityType = Database['public']['Enums']['availability_type'];

// These types exist as text columns in the schema (not Postgres enums):
export type NotificationType =
  | 'shift_assigned'
  | 'shift_changed'
  | 'shift_removed'
  | 'schedule_published'
  | 'swap_requested'
  | 'swap_peer_accepted'
  | 'swap_approved'
  | 'swap_rejected'
  | 'swap_cancelled'
  | 'swap_expired'
  | 'drop_requested'
  | 'drop_claimed'
  | 'drop_approved'
  | 'overtime_warning'
  | 'availability_changed'
  | 'coverage_needed';
export type DeliveryMethod = 'in_app' | 'email_simulated';
export type AuditAction = 'create' | 'update' | 'delete';

// ==============================
// Row types — derived from the generated Database type
// ==============================
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];
export type Skill = Database['public']['Tables']['skills']['Row'];
export type StaffSkill = Database['public']['Tables']['staff_skills']['Row'];
export type StaffLocation =
  Database['public']['Tables']['staff_locations']['Row'];
export type ManagerLocation =
  Database['public']['Tables']['manager_locations']['Row'];
export type Availability = Database['public']['Tables']['availability']['Row'];
export type Schedule = Database['public']['Tables']['schedules']['Row'];
export type Shift = Database['public']['Tables']['shifts']['Row'];
export type ShiftAssignment =
  Database['public']['Tables']['shift_assignments']['Row'];
export type SwapRequest = Database['public']['Tables']['swap_requests']['Row'];
export type OvertimeOverride =
  Database['public']['Tables']['overtime_overrides']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AuditLog = Database['public']['Tables']['audit_log']['Row'];

// ==============================
// Notification preferences (stored as JSON in profiles)
// ==============================
export interface NotificationPreferences {
  shift_assigned: DeliveryMethod;
  shift_changed: DeliveryMethod;
  schedule_published: DeliveryMethod;
  swap_updates: DeliveryMethod;
  overtime_warnings: DeliveryMethod;
}

// ==============================
// Enriched types — used when selecting with joins
// ==============================

export type StaffSkillWithJoins = StaffSkill & {
  skill?: Skill;
  profile?: Profile;
};

export type StaffLocationWithJoins = StaffLocation & {
  location?: Location;
  profile?: Profile;
};

export type ManagerLocationWithJoins = ManagerLocation & {
  location?: Location;
};

export type ScheduleWithJoins = Schedule & {
  location?: Location;
};

export type ShiftWithJoins = Shift & {
  schedule?: Schedule;
  location?: Location;
  required_skill?: Skill;
  shift_assignments?: ShiftAssignmentWithJoins[];
};

export type ShiftAssignmentWithJoins = ShiftAssignment & {
  shift?: ShiftWithJoins;
  profile?: Profile;
  assigned_by_profile?: Profile;
};

export type SwapRequestWithJoins = SwapRequest & {
  requesting_assignment?: ShiftAssignmentWithJoins;
  target_staff?: Profile;
  target_assignment?: ShiftAssignmentWithJoins;
  manager?: Profile;
};

export type OvertimeOverrideWithJoins = OvertimeOverride & {
  staff?: Profile;
  manager?: Profile;
};

export type AuditLogWithJoins = AuditLog & {
  changed_by_profile?: Profile;
};

// ==============================
// Domain types
// ==============================

export interface ConstraintViolation {
  type:
    | 'double_booking'
    | 'minimum_gap'
    | 'missing_skill'
    | 'not_certified'
    | 'not_available'
    | 'overtime_daily'
    | 'overtime_weekly'
    | 'consecutive_days';
  severity: 'error' | 'warning';
  message: string;
  details: Record<string, unknown>;
}

export interface CoverageCandidate {
  profile: Profile;
  violations: ConstraintViolation[];
  weekly_hours: number;
  is_available: boolean;
  has_skill: boolean;
  is_certified: boolean;
}
