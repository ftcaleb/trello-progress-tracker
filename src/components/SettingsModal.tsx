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
      Pick<Project, 'name' | 'description' | 'standup_day' | 'standup_time'>
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

  const resetFromProject = () => {
    setName(project.name)
    setDescription(project.description ?? '')
    setStandupDay(project.standup_day)
    setStandupTime((project.standup_time ?? '10:00').slice(0, 5))
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
              className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
            />
          ) : (
            <p className="text-sm font-medium text-navy-900">{project.name}</p>
          )}
        </Field>

        <Field label="Description">
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add a description…"
              className="w-full resize-y rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
            />
          ) : (
            <p className="text-sm text-navy-600">
              {project.description || (
                <span className="italic text-navy-300">No description</span>
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
                className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-navy-900">
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
                className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
            ) : (
              <p className="text-sm font-medium text-navy-900">
                {(project.standup_time ?? '').slice(0, 5)}
              </p>
            )}
          </Field>
        </div>

        {editing ? (
          <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
            <button
              onClick={cancel}
              className="rounded-xl px-4 py-2 text-sm font-medium text-navy-600 transition hover:bg-navy-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!name.trim()}
              className="rounded-xl bg-maroon-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-700 disabled:opacity-50"
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-400">
        {label}
      </label>
      {children}
    </div>
  )
}
