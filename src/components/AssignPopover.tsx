import type { Intern } from '../types'
import { ROLE_LABELS } from '../types'
import { roleDotClass } from '../lib/roleStyles'
import { Popover } from './Popover'

export function AssignPopover({
  anchorEl,
  interns,
  assignedIds,
  onToggle,
  onClose,
}: {
  anchorEl: HTMLElement | null
  interns: Intern[]
  assignedIds: Set<string>
  onToggle: (internId: string, assigned: boolean) => void
  onClose: () => void
}) {
  return (
    <Popover anchorEl={anchorEl} onClose={onClose} width={256} align="right">
      <div className="shrink-0 border-b border-navy-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
        Assign interns
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto fi-scroll py-1">
        {interns.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-navy-400">
            No interns yet. Add them from the Interns menu.
          </p>
        ) : (
          interns.map((intern) => {
            const checked = assignedIds.has(intern.id)
            return (
              <label
                key={intern.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition hover:bg-navy-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle(intern.id, e.target.checked)}
                  className="h-4 w-4 rounded border-navy-300 text-sunburst-500 focus:ring-sunburst-500/30"
                />
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${roleDotClass[intern.role]}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-navy-800">
                    {intern.name}
                  </span>
                  <span className="block text-[11px] text-navy-400">
                    {ROLE_LABELS[intern.role]}
                  </span>
                </span>
              </label>
            )
          })
        )}
      </div>
    </Popover>
  )
}
