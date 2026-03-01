// Premium shift detection: Friday/Saturday 5pm–close
export const PREMIUM_SHIFT_DAYS = [5, 6] // Friday=5, Saturday=6
export const PREMIUM_SHIFT_START_HOUR = 17 // 5pm

// Overtime thresholds
export const OVERTIME_WARNING_HOURS = 35
export const OVERTIME_LIMIT_HOURS = 40
export const DAILY_WARNING_HOURS = 8
export const DAILY_HARD_BLOCK_HOURS = 12
export const CONSECUTIVE_DAY_WARNING = 6
export const CONSECUTIVE_DAY_BLOCK = 7

export const OVERTIME_THRESHOLDS = {
  WEEKLY_WARNING_HOURS: OVERTIME_WARNING_HOURS,
  WEEKLY_LIMIT_HOURS: OVERTIME_LIMIT_HOURS,
  DAILY_WARNING_HOURS,
  DAILY_HARD_BLOCK_HOURS,
}

// Shift constraints
export const MINIMUM_GAP_HOURS = 10
export const DEFAULT_EDIT_CUTOFF_HOURS = 48
export const MAX_PENDING_SWAP_REQUESTS = 3
export const DROP_REQUEST_EXPIRE_HOURS_BEFORE_SHIFT = 24

// Overtime pay multiplier
export const OVERTIME_MULTIPLIER = 1.5
export const BASE_HOURLY_RATE = 18 // Default for estimation

// Navigation items per role
export const NAV_ITEMS = {
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Schedule', href: '/dashboard/schedule', icon: 'Calendar' },
    { label: 'Shifts', href: '/dashboard/shifts', icon: 'Clock' },
    { label: 'Staff', href: '/dashboard/staff', icon: 'Users' },
    { label: 'Swap Requests', href: '/dashboard/swap-requests', icon: 'ArrowLeftRight' },
    { label: 'Open Shifts', href: '/dashboard/open-shifts', icon: 'HandHelping' },
    { label: 'Overtime', href: '/dashboard/overtime', icon: 'AlertTriangle' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: 'BarChart3' },
    { label: 'On Duty', href: '/dashboard/on-duty', icon: 'Radio' },
    { label: 'Audit Log', href: '/dashboard/audit-log', icon: 'FileText' },
    { label: 'Notifications', href: '/dashboard/notifications', icon: 'Bell' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
  ],
  manager: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Schedule', href: '/dashboard/schedule', icon: 'Calendar' },
    { label: 'Shifts', href: '/dashboard/shifts', icon: 'Clock' },
    { label: 'Staff', href: '/dashboard/staff', icon: 'Users' },
    { label: 'Swap Requests', href: '/dashboard/swap-requests', icon: 'ArrowLeftRight' },
    { label: 'Open Shifts', href: '/dashboard/open-shifts', icon: 'HandHelping' },
    { label: 'Overtime', href: '/dashboard/overtime', icon: 'AlertTriangle' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: 'BarChart3' },
    { label: 'On Duty', href: '/dashboard/on-duty', icon: 'Radio' },
    { label: 'Audit Log', href: '/dashboard/audit-log', icon: 'FileText' },
    { label: 'Notifications', href: '/dashboard/notifications', icon: 'Bell' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
  ],
  staff: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'My Shifts', href: '/dashboard/my-shifts', icon: 'Calendar' },
    { label: 'Availability', href: '/dashboard/availability', icon: 'Clock' },
    { label: 'Open Shifts', href: '/dashboard/open-shifts', icon: 'HandHelping' },
    { label: 'Swap Requests', href: '/dashboard/swap-requests', icon: 'ArrowLeftRight' },
    { label: 'Notifications', href: '/dashboard/notifications', icon: 'Bell' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
  ],
} as const

export const SKILL_COLORS: Record<string, string> = {
  bartender: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'line cook': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  server: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  host: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  dishwasher: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  'prep cook': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
}

export const LOCATION_COLORS = [
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
]
