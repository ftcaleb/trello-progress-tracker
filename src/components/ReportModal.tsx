import { useState } from 'react'
import type { Phase } from '../types'
import type { UseProjectBoard } from '../hooks/useProjectBoard'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { FileTextIcon, PencilIcon } from './icons'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ReportModal({
  phase,
  board,
  onClose,
}: {
  phase: Phase
  board: UseProjectBoard
  onClose: () => void
}) {
  const toast = useToast()
  const report = board.reportsByPhase.get(phase.id)

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(report?.content ?? '')
  const [copied, setCopied] = useState(false)

  const wasEdited =
    report &&
    new Date(report.updated_at).getTime() -
      new Date(report.generated_at).getTime() >
      1500

  const runGenerate = async () => {
    if (
      report &&
      wasEdited &&
      !window.confirm(
        'Regenerating will overwrite your edits — continue?',
      )
    )
      return
    setGenerating(true)
    setGenError(null)
    try {
      await board.generatePhaseReport(phase.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed.'
      setGenError(msg)
      toast.error(`Report generation failed: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  const startEdit = () => {
    setDraft(report?.content ?? '')
    setEditing(true)
  }

  const saveEdit = () => {
    if (!draft.trim()) return
    void board.saveReportContent(phase.id, draft)
    setEditing(false)
  }

  const copy = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy to clipboard.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <FileTextIcon size={17} /> Phase Report
        </span>
      }
      subtitle={`${board.project?.name ?? ''} · ${phase.name} · Week ${phase.week_number}`}
    >
      <div className="space-y-4">
        {/* Document sheet */}
        <div className="rounded-xl border border-line bg-surface-3 p-3">
          <div className="min-h-[16rem] rounded-lg bg-surface p-6 shadow-e1 ring-1 ring-line">
            {generating ? (
              <GeneratingState />
            ) : editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={16}
                className="w-full resize-y rounded-lg border border-line-2 bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
            ) : report ? (
              <pre className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-ink">
                {report.content}
              </pre>
            ) : (
              <EmptyState onGenerate={runGenerate} />
            )}
          </div>

          {report && !generating && !editing ? (
            <div className="mt-2 px-1 text-[11px] text-ink-3">
              Generated {formatTimestamp(report.generated_at)}
              {wasEdited ? (
                <span> · edited {formatTimestamp(report.updated_at)}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {genError && !generating ? (
          <div className="rounded-lg border border-st-pending bg-st-pending-bg px-3.5 py-2.5 text-sm text-st-pending-fg">
            {genError}
          </div>
        ) : null}

        {/* Footer actions */}
        {!generating ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              {report && !editing ? (
                <button
                  onClick={copy}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                    copied
                      ? 'border-accent-ring bg-accent-wash text-accent'
                      : 'border-line-2 text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              ) : null}
              {report && !editing ? (
                <button
                  onClick={startEdit}
                  className="rounded-xl border border-line-2 px-3.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
                >
                  Edit
                </button>
              ) : null}
              {editing ? (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={!draft.trim()}
                    className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setDraft(report?.content ?? '')
                      setEditing(false)
                    }}
                    className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>

            {!editing ? (
              <button
                onClick={runGenerate}
                className="rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white shadow-e1 transition hover:bg-sunburst-600"
              >
                {report ? 'Regenerate' : 'Generate report'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function GeneratingState() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <span className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-sunburst-200 border-t-sunburst-500" />
      <p className="text-sm font-semibold text-ink-2">Haiku is writing…</p>
      <p className="mt-1 text-xs text-ink-3">
        Summarizing this phase into a report section.
      </p>
      <div className="mt-6 w-full max-w-sm space-y-2">
        <div className="fi-skeleton h-3 w-1/3 rounded" />
        <div className="fi-skeleton h-3 w-full rounded" />
        <div className="fi-skeleton h-3 w-5/6 rounded" />
        <div className="fi-skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  )
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600">
        <PencilIcon size={22} className="text-white" />
      </div>
      <h3 className="text-base font-bold text-ink">No report yet</h3>
      <p className="mt-1 max-w-xs text-sm text-ink-3">
        Generate an AI status-report section summarizing this phase's tasks and
        comments.
      </p>
      <button
        onClick={onGenerate}
        className="mt-4 rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white shadow-e1 transition hover:bg-sunburst-600"
      >
        Generate report
      </button>
    </div>
  )
}
