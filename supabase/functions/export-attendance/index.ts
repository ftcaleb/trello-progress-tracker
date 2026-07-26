// Supabase Edge Function: export-attendance
//
// Admin-only CSV export of the weekly standup attendance register.
//
// Security: requires a valid Supabase user JWT AND that the user is an admin
// (app_role='admin'). The service key bypasses RLS, so the admin check is
// enforced here explicitly — identical to generate-phase-report.
//
// The absent / N-A rows are DERIVED server-side (interns assigned but without
// a present record), never trusting the client to filter.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** RFC-4180-ish CSV cell: quote when needed, double embedded quotes. */
function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const SAST = 'Africa/Johannesburg'
const fmtDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const fmtTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: SAST,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const fmtStamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // 1) Validate the user JWT.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const secretKey =
      Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !secretKey) {
      return json({ error: 'Server is not configured' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

    // 2) Admin-only gate (service key bypasses RLS → enforce explicitly).
    const admin = createClient(supabaseUrl, secretKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('app_role')
      .eq('id', userData.user.id)
      .single()
    if (!profile || profile.app_role !== 'admin') {
      return json({ error: 'Admins only' }, 403)
    }

    // 3) Optional single-project filter (server-side only).
    const body = (await req.json().catch(() => null)) as { projectId?: string } | null
    const projectFilter = body?.projectId ?? null

    // 4) Load everything needed for derivation.
    let projQ = admin.from('projects').select('id, name')
    if (projectFilter) projQ = projQ.eq('id', projectFilter)
    const { data: projects, error: pErr } = await projQ
    if (pErr) throw pErr
    const projectIds = (projects ?? []).map((p) => p.id)
    const projectName = new Map((projects ?? []).map((p) => [p.id, p.name as string]))

    if (projectIds.length === 0) {
      return json({ filename: 'attendance.csv', csv: '' })
    }

    let sessQ = admin
      .from('standup_sessions')
      .select('id, project_id, session_date, starts_at, is_initial_meet')
      .in('project_id', projectIds)
    const { data: sessions, error: sErr } = await sessQ
    if (sErr) throw sErr

    const { data: assigns, error: aErr } = await admin
      .from('project_interns')
      .select('project_id, intern_id, assigned_at')
      .in('project_id', projectIds)
    if (aErr) throw aErr

    const { data: interns, error: iErr } = await admin
      .from('interns')
      .select('id, name, role')
    if (iErr) throw iErr
    const internById = new Map(
      (interns ?? []).map((i) => [i.id, { name: i.name as string, role: i.role as string }]),
    )

    const sessionIds = (sessions ?? []).map((s) => s.id)
    let records: { session_id: string; intern_id: string; marked_at: string; marked_by: string | null }[] = []
    let amendments: {
      session_id: string
      intern_id: string
      changed_by: string | null
      reason: string | null
      changed_at: string
    }[] = []
    if (sessionIds.length > 0) {
      const { data: rec, error: rErr } = await admin
        .from('attendance_records')
        .select('session_id, intern_id, marked_at, marked_by')
        .in('session_id', sessionIds)
      if (rErr) throw rErr
      records = rec ?? []
      const { data: amd, error: amErr } = await admin
        .from('attendance_amendments')
        .select('session_id, intern_id, changed_by, reason, changed_at')
        .in('session_id', sessionIds)
        .order('changed_at', { ascending: true })
      if (amErr) throw amErr
      amendments = amd ?? []
    }

    // Resolve corrected_by uids → display names.
    const uids = Array.from(
      new Set(
        amendments
          .map((a) => a.changed_by)
          .filter((x): x is string => Boolean(x)),
      ),
    )
    const nameByUid = new Map<string, string>()
    if (uids.length > 0) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, full_name, moodle_username, email')
        .in('id', uids)
      for (const p of profs ?? []) {
        nameByUid.set(
          p.id,
          (p.full_name as string)?.trim() ||
            (p.moodle_username as string) ||
            (p.email as string) ||
            p.id,
        )
      }
    }

    // Index lookups.
    const recKey = (sid: string, iid: string) => `${sid}|${iid}`
    const recordSet = new Map(records.map((r) => [recKey(r.session_id, r.intern_id), r]))
    // latest amendment per (session,intern)
    const latestAmend = new Map<string, (typeof amendments)[number]>()
    for (const a of amendments) latestAmend.set(recKey(a.session_id, a.intern_id), a)

    const assignsByProject = new Map<string, { intern_id: string; assigned_at: string }[]>()
    for (const a of assigns ?? []) {
      const list = assignsByProject.get(a.project_id) ?? []
      list.push({ intern_id: a.intern_id, assigned_at: a.assigned_at })
      assignsByProject.set(a.project_id, list)
    }

    // 5) Build rows: one per (session × intern assigned to that project).
    const header = [
      'project_name',
      'session_date',
      'session_time',
      'session_type',
      'intern_name',
      'intern_role',
      'status',
      'marked_at',
      'corrected',
      'corrected_by',
      'correction_reason',
    ]
    const lines = [header.join(',')]

    const sortedSessions = [...(sessions ?? [])].sort((a, b) => {
      const pn = (projectName.get(a.project_id) ?? '').localeCompare(
        projectName.get(b.project_id) ?? '',
      )
      if (pn !== 0) return pn
      return a.session_date < b.session_date ? -1 : a.session_date > b.session_date ? 1 : 0
    })

    for (const s of sortedSessions) {
      const startMs = new Date(s.starts_at).getTime()
      const assigned = assignsByProject.get(s.project_id) ?? []
      for (const a of assigned) {
        const intern = internById.get(a.intern_id)
        if (!intern) continue
        const rec = recordSet.get(recKey(s.id, a.intern_id))
        const assignedMs = new Date(a.assigned_at).getTime()

        let status: 'present' | 'absent' | 'na'
        if (rec) status = 'present'
        else if (assignedMs <= startMs) status = 'absent'
        else status = 'na'

        const amd = latestAmend.get(recKey(s.id, a.intern_id))
        lines.push(
          [
            cell(projectName.get(s.project_id)),
            cell(fmtDate.format(new Date(s.starts_at))),
            cell(fmtTime.format(new Date(s.starts_at))),
            cell(s.is_initial_meet ? 'Project Initial Meet' : 'Weekly Standup'),
            cell(intern.name),
            cell(intern.role),
            cell(status),
            cell(rec ? fmtStamp.format(new Date(rec.marked_at)) : ''),
            cell(amd ? 'yes' : 'no'),
            cell(amd ? nameByUid.get(amd.changed_by ?? '') ?? '' : ''),
            cell(amd?.reason ?? ''),
          ].join(','),
        )
      }
    }

    const stamp = fmtDate.format(new Date()).replace(/-/g, '')
    return json({ filename: `attendance-${stamp}.csv`, csv: lines.join('\r\n') })
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Unexpected server error' },
      500,
    )
  }
})
