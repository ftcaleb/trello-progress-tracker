# FI Project Tracker — Project State & Handoff

**Last updated:** 2026-07-24
**Purpose:** Full context to resume work after compacting the conversation.

---

## 1. What this is

A **live, multi-user project/progress tracker** for the Founder Institute technical
programme at **Melsoft Academy**. Trello-style Kanban boards, one per startup
project, with weekly phases, a phase-gate rule, phase-stamped comments, AI status
reports, and — the current focus — **Moodle-backed login** plus an **admin console**
so an admin can onboard interns and assign them to projects with limited powers.

Owner/admin: **Caleb** (Moodle username `boikanyomokoka`, an intern with Moodle
site-admin rights). Building this out incrementally; **it is a shipping product**, not
a throwaway.

---

## 2. Stack & where things live

- **Frontend:** Vite + React 18 + TypeScript, Tailwind v3, react-router-dom v6,
  @dnd-kit, @supabase/supabase-js. Light theme (navy `#0a1733` / maroon `#5e0743`
  / sunburst `#ff7300`).
- **Backend:** Supabase (Postgres + Auth + Edge Functions). Project ref
  **`gqcghymcjkmhepinxnvj`**, URL `https://gqcghymcjkmhepinxnvj.supabase.co`.
- **Hosting:** Vercel (GitHub `main` auto-deploys). SPA rewrites in `vercel.json`.
- **Repo:** `https://github.com/ftcaleb/trello-progress-tracker` (branch `main`).
- **Local dev:** `npm run dev` (usually lands on `localhost:5174/5175` — 5173 is
  often in use). `.env` holds `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  (gitignored). **Tailwind config changes require restarting `npm run dev`.**
- **Moodle:** `https://exams.melsoftacademy.com` (Melsoft Academy Examination).

---

## 3. Evolution (what shipped, in order)

1. **v1** — single-board Kanban (deprecated/replaced).
2. **v2** — full rebuild: auth (email/pw), portfolio homepage, per-project phase
   boards, phase gate, phase-stamped comments, project settings, intern manager.
3. **v3** — AI phase reports via a Supabase Edge Function calling Anthropic
   `claude-haiku-4-5` (server-side key), with a report modal + "Copy all reports".
4. **Branding/auth tweaks** — logo on navbar + login, favicon, login-only (signup
   removed) — *then superseded by Moodle auth below*.
5. **Phase 1 (DONE): Moodle-backed login** — interns log in with Moodle
   credentials; a session bridge issues a real Supabase session.
6. **Phase 2 (BUILT, testing): Admin console** — `/admin` for managing people,
   roles, roster links, and project assignments.
7. **Phase 3 (PENDING): RLS lockdown** — replace blanket policies with
   admin/member enforcement. **Not started. Do this LAST.**

---

## 4. Database schema (live)

Original tables (v2/v3): `projects`, `phases`, `tasks` (status
approved/in_progress/blocked), `comments` (phase-stamped via `phase_id`,
`ON DELETE SET NULL`), `interns`, `project_interns` (composite PK), `phase_reports`
(unique on project_id+phase_id).

**Migration `supabase/migrations/0001_moodle_identity.sql` (applied, additive):**
- **`profiles`** (1:1 with `auth.users`): `moodle_user_id` (unique), `moodle_username`,
  `email`, `full_name`, `app_role` ('admin'|'member'), `is_active`, `last_login_at`.
  Trigger `on_auth_user_created` auto-creates a profile on signup.
- **`interns.moodle_user_id`** (nullable, unique) — links a roster record to a real
  Moodle user. Membership = profile → intern (by moodle_user_id) → project_interns.
- **`tasks.created_by`, `comments.created_by`** (nullable FK to auth.users) —
  attribution for future monitoring (existing rows are unattributed).
- Helper functions (SECURITY DEFINER): **`is_admin()`**, **`is_member_of(project)`** —
  ready for RLS Phase 3.
- RLS on `profiles` only: `profiles_select` (self or admin), `profiles_admin_write`
  (admin). **All original tables still have the blanket `auth_all` policy for
  `authenticated`** — this is what Phase 3 will replace.

Row counts at last check: 13 projects, 52 phases, 25 tasks, 30 interns (now 31 —
admin created a self roster record), 31 assignments, 2 profiles.

---

## 5. Edge Functions (deployed)

Deploy with: `export SUPABASE_ACCESS_TOKEN=<token>; npx supabase functions deploy <name> --project-ref gqcghymcjkmhepinxnvj --no-verify-jwt`

1. **`generate-phase-report`** — AI reports. Validates user JWT, calls Anthropic
   `claude-haiku-4-5`. Secret: `ANTHROPIC_API_KEY`.
2. **`moodle-login`** — the auth bridge (Phase 1). Flow:
   `login/token.php` (verify creds) → `core_webservice_get_site_info` (identity) →
   find/adopt/create shadow Supabase user → `auth.admin.generateLink('magiclink')`
   → client `verifyOtp` → real Supabase session.
   Secrets: `MOODLE_BASE_URL`, `MOODLE_LOGIN_SERVICE`, **`SB_SECRET_KEY`** (see §7).

Function secrets are set via `npx supabase secrets set NAME=value --project-ref ...`.
**No secret values live in the repo or .env.**

---

## 6. Moodle integration — critical facts (hard-won)

- **Service = `moodle_mobile_app`** (NOT a custom service). A custom service fails
  with `cannotcreatetoken` because the site strips `moodle/webservice:createtoken`
  from the Authenticated User role; the mobile service bypasses that. **Do not ask
  the user to grant Moodle capabilities.** (There IS an unused custom service
  `project_tracker_login` still sitting in Moodle — inert, can be deleted.)
- **Password convention `Aa-<iPass>`**: the function tries the password as typed,
  then retries with `Aa-` prepended (users often type just the iPass number).
- **Chrome User-Agent spoof** on every Moodle call — a WAF fronts the host and
  filters non-browser agents.
- **Moodle withholds `useremail`** → email-based account adoption doesn't work →
  accounts are keyed/bootstrapped by **`moodle_user_id`**, and each account gets a
  **synthetic email** `moodle-<id>@users.noreply.tracker` (invisible plumbing; the
  UI shows full_name/username instead). This email never changes and Moodle is never
  written to.
- All calls are **read-only**; Moodle config is untouched.
- Reference: the pattern was reverse-engineered from Caleb's existing Melsoft LMS
  frontends (they use `moodle_mobile_app`, an admin token `MOODLE_ADMIN_TOKEN`, the
  `Aa-` convention, and store the raw token in localStorage — we do a *safer* session
  bridge instead).

---

## 7. Supabase JWT gotcha (important)

The project uses **asymmetric JWT signing keys (ES256)** as the in-use key. The legacy
`service_role` key (HS256, no `kid`) auto-injected into Edge Functions is rejected by
**GoTrue** for `auth.admin.*` calls: `unrecognized JWT kid <nil> for algorithm ES256`
— *but PostgREST still accepts it*, so only session-minting broke (misleading).

**Fix:** `moodle-login` uses the new-format secret key **`sb_secret_...`**, stored as
function secret **`SB_SECRET_KEY`** (the `SUPABASE_` prefix is reserved and can't be
set). Code reads `SB_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`. Fetch the value from
Management API `GET /v1/projects/<ref>/api-keys?reveal=true` (type=`secret`).

---

## 8. Auth flow & accounts

- **Login page** (`/login`): "Sign in with Moodle" (primary; username + Moodle
  password) + "Administrator sign-in" (break-glass email/password). Signup removed.
- **Admins (both):**
  - `boikanyomokoka` — Moodle userid **134**, bootstrapped to `app_role='admin'`.
  - `caleb19scott@gmail.com` — original email account, **break-glass admin** (keep it).
- Frontend role-awareness: `useAuth` loads the profile → exposes `isAdmin`;
  `RequireAdmin` guards `/admin`; header shows Admin/Interns only to admins.

---

## 9. Admin console (Phase 2 — built, awaiting user test)

Route `/admin` (admin-only). `src/pages/AdminPage.tsx` + `src/hooks/useAdmin.ts`.
- **People tab:** every profile (auto-appears on login) — name, @username, role
  (promote/demote), Active toggle (disable = block in-app login, no Moodle change),
  last login, and **roster link** (link to an existing intern, or "+ new" to create
  one). Self-row can't demote/disable itself.
- **Teams tab:** per project, tick interns on/off to assign (writes project_interns).
- Portfolio "+ Assign" and the header "Interns" manager are now **admin-only**.

**Note:** all Phase-2 gating is UI-only. Real enforcement is Phase 3 (RLS).

---

## 10. Status: committed vs not

**Committed & pushed to `main`** (through commit `0217a25` "Add Icon-40.png as
favicon"): everything up to and including v3 + branding + favicon.

**UNCOMMITTED (local only, user asked to hold commits):**
- `supabase/migrations/0001_moodle_identity.sql` (already APPLIED to live DB)
- `supabase/functions/moodle-login/index.ts` (already DEPLOYED)
- Frontend: `useAuth.tsx` (role-awareness + Moodle sign-in), `AuthPage.tsx`
  (Moodle/email modes), `Layout.tsx` (admin link, identity display), `useAdmin.ts`,
  `AdminPage.tsx`, `App.tsx` (/admin route), `ProjectCardTile.tsx` (admin-gated
  assign), `types.ts` (Profile, Intern.moodle_user_id), `useProjectBoard.ts`
  unchanged this phase.
- `docs/PROJECT_STATE.md` (this file).

Build is clean (`npm run build` passes). **No secrets in any tracked file.**
When the user says "commit": `git add -A && git commit && git push` (auto-deploys
frontend to Vercel; the deployed site's Moodle login already works since the Edge
Functions are live).

---

## 11. Pending / next steps

1. **User is testing the admin console** in the browser. Awaiting feedback.
2. **Open question:** the admin created a self roster record (interns now 31) —
   offered to remove it (back to 30) or keep it. Awaiting decision.
3. **Commit** the two checkpoints when the user approves.
4. **Phase 3 — RLS lockdown (LAST, riskiest):** replace `auth_all` on
   projects/phases/tasks/comments/interns/project_interns/phase_reports with:
   - admin → full access (`is_admin()`),
   - member → read/act only on projects they're `is_member_of()`; structural actions
     (create/delete project, add/delete phase, assign, settings, roster) admin-only.
   **Verify with a REAL member login first** (create a test member, link+assign,
   confirm they see only their project) BEFORE flipping. Keep it reversible.
5. **Before public launch:** add **rate-limiting** to `moodle-login` (it's publicly
   callable → password-guessing surface, throttled only by Moodle lockout).
6. Later: richer monitoring dashboard (uses `created_by` attribution), real email
   capture (would need the admin token + `core_user_get_users_by_field`).

---

## 12. Safety rules being followed (per user)

- **Never break Moodle** — read-only calls only, no config changes, no admin token
  needed for login.
- **Never break the live app** — additive migrations, existing email login kept as
  break-glass, RLS lockdown done last and verified before flipping.
- **Commit only when the user explicitly says so.**
- Test with fake usernames when probing Moodle (avoid real-account lockout).

---

## 13. Key files

- Auth: `src/hooks/useAuth.tsx`, `src/pages/AuthPage.tsx`
- Admin: `src/hooks/useAdmin.ts`, `src/pages/AdminPage.tsx`
- Data hooks: `src/hooks/useProjectBoard.ts`, `src/hooks/usePortfolio.ts`,
  `src/hooks/useInterns.tsx`
- Board: `src/pages/BoardPage.tsx`, `src/components/PhaseColumn.tsx`,
  `src/components/TaskCard.tsx`, `src/components/ReportModal.tsx`
- Edge functions: `supabase/functions/moodle-login/index.ts`,
  `supabase/functions/generate-phase-report/index.ts`
- Migration: `supabase/migrations/0001_moodle_identity.sql`
- Types: `src/types.ts`

Persistent memory also saved at
`~/.claude/projects/.../memory/` (moodle-auth-integration, supabase-edge-admin-es256-fix,
tracker-identity-model).
