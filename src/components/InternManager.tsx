import { useState } from 'react'
import type { Intern, Role } from '../types'
import { ROLE_LABELS, ROLE_ORDER } from '../types'
import { useInterns } from '../hooks/useInterns'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { roleBadgeClass, suggestInitials } from '../lib/roleStyles'

export function InternManager({ onClose }: { onClose: () => void }) {
  const { interns, addIntern, updateIntern, deleteIntern } = useInterns()

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-xl"
      title="Intern Manager"
      subtitle={`${interns.length} team member${interns.length === 1 ? '' : 's'} in the pool`}
    >
      <div className="space-y-5">
        <AddInternForm onAdd={addIntern} />

        <div className="space-y-2">
          {interns.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-2 py-8 text-center text-sm text-ink-3">
              No interns yet — add your first team member above.
            </p>
          ) : (
            interns.map((intern) => (
              <InternRow
                key={intern.id}
                intern={intern}
                onUpdate={updateIntern}
                onDelete={deleteIntern}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

function RoleSelect({
  value,
  onChange,
}: {
  value: Role
  onChange: (r: Role) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      className="rounded-xl border border-line-2 bg-surface px-2.5 py-2 text-sm text-ink outline-none transition focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
    >
      {ROLE_ORDER.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  )
}

function AddInternForm({
  onAdd,
}: {
  onAdd: (input: { name: string; initials: string; role: Role }) => void
}) {
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('')
  const [initialsTouched, setInitialsTouched] = useState(false)
  const [role, setRole] = useState<Role>('developer')

  const effectiveInitials = initialsTouched ? initials : suggestInitials(name)

  const submit = () => {
    if (!name.trim()) return
    onAdd({ name, initials: effectiveInitials || suggestInitials(name), role })
    setName('')
    setInitials('')
    setInitialsTouched(false)
    setRole('developer')
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-3 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
        Add intern
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-ink-3">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="Jane Doe"
            className="rounded-xl border border-line-2 bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
          />
        </label>
        <label className="flex w-20 flex-col gap-1 text-xs font-medium text-ink-3">
          Initials
          <input
            value={effectiveInitials}
            onChange={(e) => {
              setInitials(e.target.value.toUpperCase().slice(0, 4))
              setInitialsTouched(true)
            }}
            placeholder="JD"
            className="rounded-xl border border-line-2 bg-surface px-3 py-2 text-sm uppercase text-ink outline-none transition placeholder:text-ink-3 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
          Role
          <RoleSelect value={role} onChange={setRole} />
        </label>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunburst-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function InternRow({
  intern,
  onUpdate,
  onDelete,
}: {
  intern: Intern
  onUpdate: (
    id: string,
    patch: Partial<Pick<Intern, 'name' | 'initials' | 'role'>>,
  ) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(intern.name)
  const [initials, setInitials] = useState(intern.initials)
  const [role, setRole] = useState<Role>(intern.role)

  const save = () => {
    if (!name.trim()) return
    onUpdate(intern.id, { name, initials, role })
    setEditing(false)
  }

  const cancel = () => {
    setName(intern.name)
    setInitials(intern.initials)
    setRole(intern.role)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-ring bg-accent-wash p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[8rem] flex-1 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-sunburst-500"
        />
        <input
          value={initials}
          onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
          className="w-16 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm uppercase text-ink outline-none focus:border-sunburst-500"
        />
        <RoleSelect value={role} onChange={setRole} />
        <button
          onClick={save}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Save
        </button>
        <button
          onClick={cancel}
          className="rounded-lg px-3 py-1.5 text-sm text-ink-3 transition hover:bg-surface-2 hover:text-ink-2"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-line-2">
      <Avatar intern={intern} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">
          {intern.name}
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass[intern.role]}`}
      >
        {ROLE_LABELS[intern.role]}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-3 transition hover:bg-surface-2 hover:text-ink"
      >
        Edit
      </button>
      <button
        onClick={() => {
          if (
            window.confirm(
              `Delete ${intern.name}? They will be removed from all projects.`,
            )
          )
            onDelete(intern.id)
        }}
        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-3 transition hover:bg-sunburst-50 hover:text-sunburst-700"
      >
        Delete
      </button>
    </div>
  )
}
