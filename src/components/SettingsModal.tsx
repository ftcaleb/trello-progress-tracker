import { useState } from 'react'
import type { Project } from '../types'
import { WEEKDAYS } from '../types'
import { Modal } from './Modal'

export function SettingsModal({
  project,
  onSave,
  onClose,
}: {
  project: Project
  onSave: (
    patch: Partial<
      Pick<
        Project,
        | 'name'
        | 'description'
        | 'standup_day'
        | 'standup_time'
        | 'initial_meet_date'
      >
    >,
  ) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [standupDay, setStandupDay] = useState(project.standup_day)
  const [standupTime, setStandupTime] = useState(
    (project.standup_time ?? '10:00').slice(0, 5),
  )
  const [initialMeetDate, setInitialMeetDate] = useState(
    project.initial_meet_date ?? '',
  )

  const resetFromProject = () => {
    setName(project.name)
    setDescription(project.description ?? '')
    setStandupDay(project.standup_day)
    setStandupTime((project.standup_time ?? '10:00').slice(0, 5))
    setInitialMeetDate(project.initial_meet_date ?? '')
  }

  const startEdit = () => {
    resetFromProject()
    setEditing(true)
  }

  const cancel = () => {
    resetFromProject()
    setEditing(false)
  }

  const save = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      standup_day: standupDay,
      standup_time: standupTime,
      initial_meet_date: initialMeetDate || null,
    })
    setEditing(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-lg"
      title="Project Settings"
      subtitle={editing ? 'Editing' : 'View details'}
      headerRight={
        !editing ? (
          <button
            onClick={startEdit}
            className="rounded-lg bg-sunburst-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sunburst-600"
          >
            Edit
          </button>
        ) : null
      }
    >
      <div className="space-y-5">
        <Field label="Project name">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
            />
          ) : (
            <p className="text-sm font-medium text-ink">{project.name}</p>
          )}
        </Field>

        <Field label="Description">
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add a description…"
              className="w-full resize-y rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
            />
          ) : (
            <p className="text-sm text-ink-2">
              {project.description || (
                <span className="italic text-ink-3">No description</span>
              )}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Standup day">
            {editing ? (
              <select
                value={standupDay}
                onChange={(e) => setStandupDay(e.target.value)}
                className="w-full rounded-xl border border-line-2 bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-ink">
                {project.standup_day}
              </p>
            )}
          </Field>

          <Field label="Standup time">
            {editing ? (
              <input
                type="time"
                value={standupTime}
                onChange={(e) => setStandupTime(e.target.value)}
                className="w-full rounded-xl border border-line-2 bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
            ) : (
              <p className="text-sm font-medium text-ink">
                {(project.standup_time ?? '').slice(0, 5)}
              </p>
            )}
          </Field>
        </div>

        <Field label="Initial meet date">
          {editing ? (
            <>
              <input
                type="date"
                value={initialMeetDate}
                onChange={(e) => setInitialMeetDate(e.target.value)}
                className="w-full rounded-xl border border-line-2 bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
              <p className="mt-1.5 text-xs text-ink-3">
                The first standup ("Project Initial Meet"). Setting this
                generates the weekly attendance register for 3 months from this
                date. A meet that has already occurred can't be moved.
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-ink">
              {project.initial_meet_date || (
                <span className="italic text-ink-3">
                  Not set — no register yet
                </span>
              )}
            </p>
          )}
        </Field>

        {editing ? (
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              onClick={cancel}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!name.trim()}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
            >
              Save changes
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
        {label}
      </label>
      {children}
    </div>
  )
}
