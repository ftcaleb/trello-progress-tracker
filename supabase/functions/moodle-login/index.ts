// Supabase Edge Function: moodle-login
//
// Bridges Moodle authentication into a Supabase session.
//
//   1. Verify the user's credentials against Moodle (login/token.php).
//   2. Read their identity (core_webservice_get_site_info).
//   3. Find-or-adopt-or-create the matching Supabase user (service role).
//   4. Mint a Supabase session and hand it back to the browser.
//
// MOODLE SAFETY: this function only ever performs the two READ-ONLY calls
// above. It never writes to Moodle and never uses an admin token.
//
// The user's Moodle password is forwarded once over HTTPS to Moodle and is
// never stored, logged, or persisted anywhere.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// The Moodle host sits behind a filter that rejects non-browser user agents,
// so every call to Moodle spoofs desktop Chrome (matches the existing Melsoft
// LMS integrations).
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

interface TokenResult {
  httpOk: boolean
  data: { token?: string; error?: string; errorcode?: string } | null
}

/** Request a Moodle web-service token for these credentials. */
async function requestMoodleToken(
  moodleUrl: string,
  username: string,
  password: string,
  service: string,
): Promise<TokenResult> {
  const form = new URLSearchParams({ username, password, service })
  const res = await fetch(`${moodleUrl}/login/token.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': CHROME_UA,
    },
    body: form.toString(),
  })
  const data = await res.json().catch(() => null)
  return { httpOk: res.ok, data }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Map Moodle's error codes to messages that are safe + useful to show. */
function friendlyMoodleError(errorcode: string, fallback: string): string {
  switch (errorcode) {
    case 'invalidlogin':
      return 'Incorrect Moodle username or password.'
    case 'enablewsdescription':
      return 'Web services are disabled on the Moodle site.'
    case 'servicenotavailable':
    case 'accessexception':
      return 'This app is not authorised on Moodle. Check the Project Tracker Login service is enabled.'
    case 'usernotconfirmed':
      return 'Your Moodle account is not confirmed yet.'
    case 'usersuspended':
      return 'Your Moodle account is suspended.'
    case 'sitepolicynotagreed':
      return 'Please log into Moodle directly first and accept the site policy.'
    default:
      return fallback || 'Moodle rejected the login.'
  }
}

interface SiteInfo {
  userid: number
  username: string
  fullname: string
  useremail?: string
  errorcode?: string
  error?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const moodleUrl = (Deno.env.get('MOODLE_BASE_URL') ?? '').replace(/\/+$/, '')
    const service =
      Deno.env.get('MOODLE_LOGIN_SERVICE') ?? 'project_tracker_login'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // Prefer the new-format secret key (sb_secret_...). It works with the
    // project's asymmetric (ES256) JWT signing keys; the legacy service_role
    // JWT is rejected by GoTrue once the signing key is ES256.
    const serviceKey =
      Deno.env.get('SB_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!moodleUrl || !supabaseUrl || !serviceKey) {
      return json({ error: 'Server is not configured for Moodle login.' }, 500)
    }

    const body = (await req.json().catch(() => null)) as {
      username?: string
      password?: string
    } | null
    const username = body?.username?.trim()
    const password = body?.password
    if (!username || !password) {
      return json({ error: 'Username and password are required.' }, 400)
    }

    // ---- 1. Authenticate against Moodle --------------------------------
    // Try the password as typed. If Moodle rejects it, retry with the site's
    // "Aa-<iPass>" convention prepended (users often enter just the number).
    let attempt = await requestMoodleToken(moodleUrl, username, password, service)
    const failed = (r: TokenResult) =>
      !r.data || r.data.error || !r.data.token
    if (failed(attempt) && !password.startsWith('Aa-')) {
      attempt = await requestMoodleToken(
        moodleUrl,
        username,
        `Aa-${password}`,
        service,
      )
    }

    const tokenJson = attempt.data
    if (!tokenJson || tokenJson.error || !tokenJson.token) {
      return json(
        {
          error: friendlyMoodleError(
            tokenJson?.errorcode ?? '',
            tokenJson?.error ?? '',
          ),
        },
        401,
      )
    }
    const moodleToken: string = tokenJson.token

    // ---- 2. Read the verified identity ---------------------------------
    const infoRes = await fetch(
      `${moodleUrl}/webservice/rest/server.php?` +
        new URLSearchParams({
          wstoken: moodleToken,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json',
        }).toString(),
      { headers: { 'User-Agent': CHROME_UA } },
    )
    const info = (await infoRes.json().catch(() => null)) as SiteInfo | null
    if (!info || info.errorcode || !info.userid) {
      return json(
        {
          error: friendlyMoodleError(
            info?.errorcode ?? '',
            info?.error ?? 'Could not read your Moodle profile.',
          ),
        },
        401,
      )
    }

    const moodleUserId = Number(info.userid)
    const moodleUsername = info.username ?? username
    const fullName = info.fullname ?? ''
    // Moodle may withhold the email depending on site settings; fall back to a
    // stable synthetic address so Supabase always has one.
    const email =
      info.useremail && info.useremail.includes('@')
        ? info.useremail.toLowerCase()
        : `moodle-${moodleUserId}@users.noreply.tracker`

    // ---- 3. Find / adopt / create the Supabase user --------------------
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // (a) Already linked by Moodle id?
    const { data: byMoodle } = await admin
      .from('profiles')
      .select('id, is_active, email')
      .eq('moodle_user_id', moodleUserId)
      .maybeSingle()

    let userId: string | null = byMoodle?.id ?? null
    let loginEmail: string = byMoodle?.email ?? email

    // (b) Not linked — adopt an existing account with the same email.
    if (!userId) {
      const { data: byEmail } = await admin
        .from('profiles')
        .select('id, email')
        .ilike('email', email)
        .maybeSingle()
      if (byEmail?.id) {
        userId = byEmail.id
        loginEmail = byEmail.email ?? email
      }
    }

    // (c) Brand new person — create the shadow user.
    if (!userId) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, moodle_user_id: moodleUserId },
        })
      if (createErr || !created?.user) {
        return json(
          { error: `Could not create your account: ${createErr?.message ?? 'unknown error'}` },
          500,
        )
      }
      userId = created.user.id
      loginEmail = email
    }

    // Link + refresh profile metadata (service role bypasses RLS).
    const { error: upErr } = await admin
      .from('profiles')
      .update({
        moodle_user_id: moodleUserId,
        moodle_username: moodleUsername,
        full_name: fullName,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', userId)
    if (upErr) {
      return json({ error: `Could not update your profile: ${upErr.message}` }, 500)
    }

    // ---- 4. Access gate (admin can disable someone in-app) -------------
    const { data: profile } = await admin
      .from('profiles')
      .select('is_active, app_role')
      .eq('id', userId)
      .single()
    if (profile && profile.is_active === false) {
      return json(
        { error: 'Your access to the tracker has been disabled by an administrator.' },
        403,
      )
    }

    // ---- 5. Mint a Supabase session ------------------------------------
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    })
    if (linkErr || !link?.properties?.hashed_token) {
      return json(
        { error: `Could not start your session: ${linkErr?.message ?? 'unknown error'}` },
        500,
      )
    }

    return json({
      token_hash: link.properties.hashed_token,
      email: loginEmail,
      full_name: fullName,
      app_role: profile?.app_role ?? 'member',
    })
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Unexpected server error' },
      500,
    )
  }
})
