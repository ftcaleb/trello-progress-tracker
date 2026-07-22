import { usePortfolio } from '../hooks/usePortfolio'
import { useInterns } from '../hooks/useInterns'
import { ProjectCardTile } from '../components/ProjectCardTile'

export function PortfolioPage() {
  const {
    projects,
    loading,
    loadError,
    reload,
    progressByProject,
    internsByProject,
    setAssignment,
  } = usePortfolio()
  const { interns: allInterns } = useInterns()

  return (
    <div className="h-full overflow-y-auto fi-scroll">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-navy-900">
            Project Portfolio
          </h1>
          <p className="mt-1 text-sm text-navy-400">
            All cohort projects, their current phase, and who's working on each.
          </p>
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
                onToggleAssign={(internId, assigned) =>
                  void setAssignment(project.id, internId, assigned)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card"
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
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600 text-xl">
        📋
      </div>
      <h2 className="text-lg font-bold text-navy-900">No projects found</h2>
      <p className="mt-1 text-sm text-navy-400">
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
    <div className="mx-auto max-w-md rounded-2xl border border-sunburst-200 bg-sunburst-50/50 p-8 text-center">
      <div className="mb-2 text-2xl">⚠️</div>
      <h2 className="text-lg font-bold text-navy-900">
        Could not load the portfolio
      </h2>
      <p className="mt-1 text-sm text-navy-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunburst-600"
      >
        Retry
      </button>
    </div>
  )
}
