import type { UserRole } from '@/lib/types/database'

interface RoleGateProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  userRole: UserRole
  fallback?: React.ReactNode
}

export function RoleGate({ children, allowedRoles, userRole, fallback }: RoleGateProps) {
  if (!allowedRoles.includes(userRole)) {
    return fallback || (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <p>You don&apos;t have permission to access this.</p>
      </div>
    )
  }

  return <>{children}</>
}
