import type { Role } from '../types'

// Avatar ring color per role (light theme): developer = maroon, designer = navy,
// cybersecurity = orange.
export const roleAvatarClass: Record<Role, string> = {
  developer: 'bg-maroon-50 text-maroon-700 ring-2 ring-maroon-600/70',
  designer: 'bg-navy-50 text-navy-700 ring-2 ring-navy-500/70',
  cybersecurity: 'bg-sunburst-50 text-sunburst-700 ring-2 ring-sunburst-500/80',
}

export const roleBadgeClass: Record<Role, string> = {
  developer: 'bg-maroon-50 text-maroon-700',
  designer: 'bg-navy-100 text-navy-700',
  cybersecurity: 'bg-sunburst-50 text-sunburst-700',
}

export const roleDotClass: Record<Role, string> = {
  developer: 'bg-maroon-600',
  designer: 'bg-navy-500',
  cybersecurity: 'bg-sunburst-500',
}

export function suggestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
