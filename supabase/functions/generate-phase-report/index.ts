// Supabase Edge Function: generate-phase-report
//
// Generates one section of a weekly Founder Institute progress status report
// for a given project + phase, using the Anthropic API (claude-haiku-4-5).
//
// Security: the Anthropic key lives only in this function's environment
// (set via `supabase secrets set ANTHROPIC_API_KEY=...`). The browser never
// sees it. Every request must carry a valid Supabase user JWT, which we
// validate with auth.getUser() before doing any work.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface TaskInput {
  title: string
  status: string
}
interface CommentInput {
  content: string
  createdAt: string
}
interface ReportPayload {
  projectName: string
  projectDescription?: string | null
  phaseName: string
  weekNumber: number
  tasks: TaskInput[]
  comments: CommentInput[]
  nextPhaseName: string | null
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved',
  in_progress: 'In Progress',
  blocked: 'Blocked',
}

const SYSTEM_PROMPT = `You are writing ONE section of a weekly progress status report for a startup portfolio run by a Founder Institute technical program.

Voice and formatting rules:
- Professional, concise, third-person reporting voice.
- Never mention any individual person's name. Refer to "the team", "developers", or "designers" instead.
- Output PLAIN TEXT only. Do NOT use markdown symbols such as #, *, backticks, or - bullet dashes. Use plain line breaks and simple "Label:" lines so the text pastes cleanly into a document.
- Do not invent facts that are not present in the provided data. If the phase has little activity, say so briefly rather than padding.

Status derivation — choose EXACTLY ONE of: In Progress, Blocked, Completed, Kicking Off.
- Blocked: if one or more tasks are blocked and blockers dominate the phase.
- Completed: if every task is approved.
- Kicking Off: if the phase has almost no activity yet (no or very few tasks/comments).
- In Progress: otherwise.

Follow this EXACT output structure (no extra preamble, no closing remarks):

{Project Name}

{Status}

{one concise line describing the Key Development of the phase}

{2 to 4 short labelled subsections describing what happened this phase, each on its own block, for example:
Development: ...
Design: ...
Blockers: ...}

Next Steps
{2 to 4 plain lines — no leading symbols — derived from the incomplete or blocked tasks and framed toward the next phase's heading}`

function buildUserMessage(p: ReportPayload): string {
  const lines: string[] = []
  lines.push(`Project name: ${p.projectName}`)
  if (p.projectDescription && p.projectDescription.trim()) {
    lines.push(`Project description: ${p.projectDescription.trim()}`)
  }
  lines.push(`Phase: ${p.phaseName} (Week ${p.weekNumber})`)
  lines.push(
    p.nextPhaseName
      ? `Next phase (frame Next Steps toward this heading): ${p.nextPhaseName}`
      : `This is the final phase. Frame Next Steps as wrap-up / handover.`,
  )
  lines.push('')

  if (p.tasks.length === 0) {
    lines.push('Tasks: none recorded for this phase.')
  } else {
    lines.push(`Tasks (${p.tasks.length}):`)
    for (const t of p.tasks) {
      const label = STATUS_LABEL[t.status] ?? t.status
      lines.push(`  ${t.title} [${label}]`)
    }
  }
  lines.push('')

  if (p.comments.length === 0) {
    lines.push('Phase comments: none.')
  } else {
    lines.push(`Phase comments (chronological, ${p.comments.length}):`)
    for (const c of p.comments) {
      const when = (c.createdAt ?? '').slice(0, 10)
      lines.push(`  (${when}) ${c.content}`)
    }
  }

  lines.push('')
  lines.push(
    'Write the report section for this phase now, following the required structure exactly.',
  )
  return lines.join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    // 1) Require and validate the Supabase user JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) {
      return json({ error: 'Server auth is not configured' }, 500)
    }
    const supabase = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userData?.user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // 1b) Admin-only gate (D8): report generation writes with the service key
    //     which bypasses RLS, so we must enforce the admin check here explicitly.
    const secretKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!secretKey) {
      return json({ error: 'Server service key is not configured' }, 500)
    }
    const adminClient = createClient(supabaseUrl, secretKey)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('app_role')
      .eq('id', userData.user.id)
      .single()
    if (!profile || profile.app_role !== 'admin') {
      return json({ error: 'Admins only' }, 403)
    }

    // 2) Anthropic key must be present (server-side secret).
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, 500)
    }

    // 3) Validate payload.
    const body = (await req.json().catch(() => null)) as ReportPayload | null
    if (!body || !body.projectName || !body.phaseName) {
      return json({ error: 'Invalid payload: projectName and phaseName required' }, 400)
    }
    const payload: ReportPayload = {
      projectName: body.projectName,
      projectDescription: body.projectDescription ?? null,
      phaseName: body.phaseName,
      weekNumber: Number(body.weekNumber) || 0,
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      comments: Array.isArray(body.comments) ? body.comments : [],
      nextPhaseName: body.nextPhaseName ?? null,
    }

    // 4) Call Anthropic.
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(payload) }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return json(
        { error: `Anthropic API error (${anthropicRes.status}): ${errText}` },
        502,
      )
    }

    const data = await anthropicRes.json()
    const content: string = (data?.content ?? [])
      .map((block: { text?: string }) => block?.text ?? '')
      .join('')
      .trim()

    if (!content) {
      return json({ error: 'The model returned an empty response' }, 502)
    }

    return json({ content }, 200)
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Unexpected server error' },
      500,
    )
  }
})
