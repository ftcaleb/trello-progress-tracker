import { useState } from 'react'
import type { Phase } from '../types'
import type { UseProjectBoard } from '../hooks/useProjectBoard'
import { Modal } from './Modal'
import { useToast } from './Toast'

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
          <span aria-hidden="true">📄</span> Phase Report
        </span>
      }
      subtitle={`${board.project?.name ?? ''} · ${phase.name} · Week ${phase.week_number}`}
    >
      <div className="space-y-4">
        {/* Document sheet */}
        <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-3">
          <div className="min-h-[16rem] rounded-lg bg-white p-6 shadow-card ring-1 ring-navy-100">
            {generating ? (
              <GeneratingState />
            ) : editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={16}
                className="w-full resize-y rounded-lg border border-navy-200 bg-white p-3 font-mono text-[13px] leading-relaxed text-navy-800 outline-none focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
            ) : report ? (
              <pre className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-navy-900">
                {report.content}
              </pre>
            ) : (
              <EmptyState onGenerate={runGenerate} />
            )}
          </div>

          {report && !generating && !editing ? (
            <div className="mt-2 px-1 text-[11px] text-navy-400">
              Generated {formatTimestamp(report.generated_at)}
              {wasEdited ? (
                <span> · edited {formatTimestamp(report.updated_at)}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {genError && !generating ? (
          <div className="rounded-lg border border-sunburst-200 bg-sunburst-50 px-3.5 py-2.5 text-sm text-sunburst-800">
            {genError}
          </div>
        ) : null}

        {/* Footer actions */}
        {!generating ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-100 pt-4">
            <div className="flex items-center gap-2">
              {report && !editing ? (
                <button
                  onClick={copy}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                    copied
                      ? 'border-maroon-200 bg-maroon-50 text-maroon-700'
                      : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                  }`}
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              ) : null}
              {report && !editing ? (
                <button
                  onClick={startEdit}
                  className="rounded-xl border border-navy-200 px-3.5 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
                >
                  Edit
                </button>
              ) : null}
              {editing ? (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={!draft.trim()}
                    className="rounded-xl bg-maroon-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setDraft(report?.content ?? '')
                      setEditing(false)
                    }}
                    className="rounded-xl px-3.5 py-2 text-sm font-medium text-navy-600 transition hover:bg-navy-50"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>

            {!editing ? (
              <button
                onClick={runGenerate}
                className="rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sunburst-600"
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
      <p className="text-sm font-semibold text-navy-700">Haiku is writing…</p>
      <p className="mt-1 text-xs text-navy-400">
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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600 text-xl">
        ✍️
      </div>
      <h3 className="text-base font-bold text-navy-900">No report yet</h3>
      <p className="mt-1 max-w-xs text-sm text-navy-400">
        Generate an AI status-report section summarizing this phase's tasks and
        comments.
      </p>
      <button
        onClick={onGenerate}
        className="mt-4 rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sunburst-600"
      >
        Generate report
      </button>
    </div>
  )
}
