import type { Role } from '../types'

// Avatar ring color per role (light theme): developer = maroon, designer = navy,
// cybersecurity = orange.
export const roleAvatarClass: Record<Role, string> = {
  developer: 'bg-role-developer-bg text-role-developer-fg ring-2 ring-role-developer-ring',
  designer: 'bg-role-designer-bg text-role-designer-fg ring-2 ring-role-designer-ring',
  cybersecurity: 'bg-role-cyber-bg text-role-cyber-fg ring-2 ring-role-cyber-ring',
}

export const roleBadgeClass: Record<Role, string> = {
  developer: 'bg-role-developer-bg text-role-developer-fg',
  designer: 'bg-role-designer-bg text-role-designer-fg',
  cybersecurity: 'bg-role-cyber-bg text-role-cyber-fg',
}

export const roleDotClass: Record<Role, string> = {
  developer: 'bg-role-developer',
  designer: 'bg-role-designer',
  cybersecurity: 'bg-role-cyber',
}

export function suggestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
