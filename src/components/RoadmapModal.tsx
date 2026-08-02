import { useRef, useState, type DragEvent } from 'react'
import { Modal } from './Modal'
import type { UseProjectDocuments } from '../hooks/useProjectDocuments'
import type { ProjectDocument, PublicProfile } from '../types'
import {
  ExternalLinkIcon,
  FileTextIcon,
  TrashIcon,
  UploadIcon,
} from './icons'

function uploaderName(p: PublicProfile | undefined): string {
  if (!p) return 'A team member'
  return p.full_name?.trim() || (p.moodle_username ? `@${p.moodle_username}` : 'A team member')
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function RoadmapModal({
  docs,
  isAdmin,
  currentUserId,
  onClose,
}: {
  docs: UseProjectDocuments
  isAdmin: boolean
  currentUserId: string | null
  onClose: () => void
}) {
  const { documents, uploaders, loading, uploading, upload, remove, open } = docs
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const pick = () => inputRef.current?.click()

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (file) await upload(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void onFiles(e.dataTransfer.files)
  }

  const canDelete = (d: ProjectDocument) =>
    isAdmin || (Boolean(currentUserId) && d.uploaded_by === currentUserId)

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <FileTextIcon size={17} /> Detailed Roadmap
        </span>
      }
      subtitle="The full written plan behind the phases — each contributor's detailed roadmap, saved as a PDF."
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Upload dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition ${
            dragOver
              ? 'border-sunburst-400 bg-sunburst-50/50'
              : 'border-line-2 bg-surface-2'
          }`}
        >
          <UploadIcon size={22} className="text-ink-3" />
          <div className="text-sm text-ink-2">
            Drag a PDF here, or{' '}
            <button
              onClick={pick}
              disabled={uploading}
              className="font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-60"
            >
              browse
            </button>
          </div>
          <div className="text-[11px] text-ink-3">PDF · up to 20 MB</div>
          {uploading ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-2 border-t-sunburst-500" />
              Uploading…
            </div>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              void onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="py-6 text-center text-sm text-ink-3">Loading…</div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-2 py-8 text-center text-sm text-ink-3">
            No roadmaps yet — upload the first detailed roadmap PDF.
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2">
                  <FileTextIcon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink" title={d.file_name}>
                    {d.file_name}
                  </div>
                  <div className="truncate text-[11px] text-ink-3">
                    {uploaderName(uploaders[d.uploaded_by ?? ''])} · {fmtDate(d.created_at)}
                    {d.file_size ? ` · ${fmtSize(d.file_size)}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => void open(d)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-accent-ring hover:text-accent"
                >
                  <ExternalLinkIcon size={13} /> Open
                </button>
                {canDelete(d) ? (
                  <button
                    onClick={() => void remove(d)}
                    aria-label="Delete roadmap"
                    title="Delete"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-st-cancelled-bg hover:text-st-cancelled-fg"
                  >
                    <TrashIcon size={15} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
