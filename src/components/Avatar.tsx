import type { Intern } from '../types'
import { ROLE_LABELS } from '../types'
import { roleAvatarClass } from '../lib/roleStyles'

export function Avatar({
  intern,
  size = 'sm',
  title,
}: {
  intern: Intern
  size?: 'sm' | 'md'
  title?: string
}) {
  const dims = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm'
  return (
    <span
      title={title ?? `${intern.name} · ${ROLE_LABELS[intern.role]}`}
      className={`inline-flex ${dims} select-none items-center justify-center rounded-full font-bold uppercase ${roleAvatarClass[intern.role]}`}
    >
      {intern.initials}
    </span>
  )
}

export function AvatarStack({
  interns,
  max = 4,
  size = 'sm',
}: {
  interns: Intern[]
  max?: number
  size?: 'sm' | 'md'
}) {
  const shown = interns.slice(0, max)
  const overflow = interns.length - shown.length
  const ring = size === 'sm' ? 'ring-2 ring-white' : 'ring-2 ring-white'
  return (
    <div className="flex -space-x-2">
      {shown.map((i) => (
        <div key={i.id} className={`rounded-full ${ring}`}>
          <Avatar intern={i} size={size} />
        </div>
      ))}
      {overflow > 0 ? (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-600 ${ring} ${
            size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm'
          }`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
