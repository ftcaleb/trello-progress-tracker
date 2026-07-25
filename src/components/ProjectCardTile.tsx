import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Intern, Project } from '../types'
import { WEEKDAY_SHORT } from '../types'
import type { ProjectProgress } from '../hooks/usePortfolio'
import { useAuth } from '../hooks/useAuth'
import { AvatarStack } from './Avatar'
import { AssignPopover } from './AssignPopover'

export function ProjectCardTile({
  project,
  progress,
  interns,
  allInterns,
  reportCount,
  onToggleAssign,
}: {
  project: Project
  progress: ProjectProgress
  interns: Intern[]
  allInterns: Intern[]
  reportCount: number
  onToggleAssign: (internId: string, assigned: boolean) => void
}) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [assignOpen, setAssignOpen] = useState(false)
  const assignedIds = new Set(interns.map((i) => i.id))

  const total = progress.totalPhases || 4
  const filledUpTo = progress.started ? progress.phaseIndex + 1 : 0

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-navy-100 bg-white p-5 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lift"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-navy-900">
            {project.name}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-navy-400">
            {project.description || 'No description yet.'}
          </p>
        </div>

        {/* Assign affordance — admins only */}
        {isAdmin ? (
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setAssignOpen((v) => !v)
              }}
              className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-600 transition hover:border-sunburst-400 hover:text-sunburst-600"
            >
              + Assign
            </button>
            {assignOpen ? (
              <AssignPopover
                interns={allInterns}
                assignedIds={assignedIds}
                onToggle={onToggleAssign}
                onClose={() => setAssignOpen(false)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-navy-700">
            {progress.started && progress.currentPhase
              ? `${progress.currentPhase.name} · Week ${progress.currentPhase.week_number}`
              : 'Not started'}
          </span>
          <span className="text-navy-400">
            {progress.started
              ? `${filledUpTo}/${total}`
              : `0/${total}`}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < filledUpTo
                  ? 'bg-gradient-to-r from-sunburst-400 to-sunburst-600'
                  : 'bg-navy-100'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Footer: avatars + standup */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-navy-50 pt-3">
        {interns.length > 0 ? (
          <AvatarStack interns={interns} max={4} />
        ) : (
          <span className="text-xs text-navy-300">Unassigned</span>
        )}

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              reportCount > 0 ? 'text-navy-500' : 'text-navy-300'
            }`}
            title={`${reportCount} saved report${reportCount === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true">📄</span>
            {reportCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-500">
            <span aria-hidden="true">🕑</span>
            {WEEKDAY_SHORT[project.standup_day] ?? project.standup_day}{' '}
            {project.standup_time?.slice(0, 5)}
          </span>
        </div>
      </div>
    </div>
  )
}
