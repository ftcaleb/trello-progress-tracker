import { useState } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'
import { useInterns } from '../hooks/useInterns'
import { useAuth } from '../hooks/useAuth'
import { ProjectCardTile } from '../components/ProjectCardTile'
import { Modal } from '../components/Modal'
import { AlertTriangleIcon, CopyIcon, FolderIcon } from '../components/icons'
import type { Team } from '../types'

export function PortfolioPage() {
  const {
    projects,
    loading,
    loadError,
    reload,
    progressByProject,
    internsByProject,
    reportCountByProject,
    copyAllReports,
    setAssignment,
    teams,
    createProject,
    deleteProject,
    setProjectGroup,
  } = usePortfolio()
  const { interns: allInterns } = useInterns()
  const { isAdmin } = useAuth()
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="h-full overflow-y-auto fi-scroll">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              The{' '}
              <span className="bg-gradient-to-r from-sunburst-500 to-maroon-600 bg-clip-text text-transparent">
                Progress
              </span>{' '}
              Tracker
            </h1>
            <p className="mt-1.5 text-sm text-ink-3">
              All cohort projects, their current phase, and who's working on
              each.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-2 shadow-e1">
                <span className="h-2 w-2 rounded-full bg-sunburst-500" />
                Technical Specialist · Caleb
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-2 shadow-e1">
                <span className="h-2 w-2 rounded-full bg-maroon-600" />
                Business Analyst · Zama
              </span>
            </div>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void copyAllReports()}
                className="inline-flex items-center gap-2 rounded-xl border border-line-2 bg-surface px-4 py-2.5 text-sm font-semibold text-ink-2 shadow-e1 transition hover:border-line-2 hover:text-ink"
                title="Copy the latest report from every project as one document"
              >
                <CopyIcon size={16} /> Copy all reports
              </button>
              <button
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-rail px-4 py-2.5 text-sm font-semibold text-rail-ink shadow-e1 transition hover:opacity-90"
              >
                <span className="text-base leading-none">＋</span> New project
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={reload} />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCardTile
                key={project.id}
                project={project}
                progress={
                  progressByProject.get(project.id) ?? {
                    currentPhase: null,
                    phaseIndex: -1,
                    totalPhases: 4,
                    started: false,
                  }
                }
                interns={internsByProject.get(project.id) ?? []}
                allInterns={allInterns}
                reportCount={reportCountByProject.get(project.id) ?? 0}
                teams={teams}
                onToggleAssign={(internId, assigned) =>
                  void setAssignment(project.id, internId, assigned)
                }
                onSetGroup={(teamId) => void setProjectGroup(project.id, teamId)}
                onDelete={() => void deleteProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {newOpen ? (
        <NewProjectModal
          teams={teams}
          onClose={() => setNewOpen(false)}
          onCreate={async (name, teamId) => {
            const created = await createProject(name, teamId)
            if (created) setNewOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function NewProjectModal({
  teams,
  onClose,
  onCreate,
}: {
  teams: Team[]
  onClose: () => void
  onCreate: (name: string, teamId: string | null) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    await onCreate(name.trim(), teamId || null)
    setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New project"
      subtitle="Add a real project. You can set its phases, standup and details afterwards."
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">
            Project name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Quartago LLC"
            className="w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">
            Group <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
          >
            <option value="">Unassigned</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-3 transition hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!name.trim() || saving}
            className="rounded-xl bg-rail px-4 py-2 text-sm font-semibold text-rail-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-line bg-surface p-5 shadow-e1"
        >
          <div className="fi-skeleton h-5 w-2/3 rounded" />
          <div className="fi-skeleton mt-2 h-4 w-full rounded" />
          <div className="fi-skeleton mt-4 h-1.5 w-full rounded-full" />
          <div className="mt-4 flex gap-2">
            <div className="fi-skeleton h-8 w-8 rounded-full" />
            <div className="fi-skeleton h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 bg-surface py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600">
        <FolderIcon size={22} className="text-white" />
      </div>
      <h2 className="text-lg font-bold text-ink">No projects found</h2>
      <p className="mt-1 text-sm text-ink-3">
        Once projects are seeded they'll appear here.
      </p>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-st-pending bg-st-pending-bg p-8 text-center">
      <div className="mb-2 flex justify-center text-st-pending">
        <AlertTriangleIcon size={26} />
      </div>
      <h2 className="text-lg font-bold text-ink">
        Could not load the portfolio
      </h2>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunburst-600"
      >
        Retry
      </button>
    </div>
  )
}
