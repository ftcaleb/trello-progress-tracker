# FI Project Tracker — v2

A multi-project Kanban tracker for the Founder Institute cohort. Auth-gated,
project portfolio → per-project phase board with a hard **phase gate**,
phase-stamped comments, per-project standups, and a global intern pool.

Built with Vite + React 18 + TypeScript, Tailwind CSS v3 (PostCSS, not CDN),
react-router-dom, @dnd-kit, and Supabase (Auth + Postgres).

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file and fill in your Supabase credentials:

   ```bash
   cp .env.example .env
   ```

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

   > The Supabase database (v2 schema, seed data, authenticated-only RLS)
   > already exists — this app only connects to it.

3. Start the dev server and open the printed URL (default http://localhost:5173):

   ```bash
   npm run dev
   ```

## Using the app

- **Sign up / log in** at `/signup` or `/login` (email confirmation is disabled,
  so signup logs you straight in). All other routes require a session.
- **Portfolio (`/`)** — all 13 projects. Each tile shows its current phase +
  progress rail, assigned interns, and standup chip. Use **+ Assign** on a tile
  to toggle interns; use **Interns** in the header to manage the pool.
- **Board (`/project/:id`)** — that project's phase columns. Add tasks, set
  status (Approved / In Progress / Blocked), drag to reorder or move phases,
  comment on tasks, and edit project settings.

### The phase gate

- Reorder within a phase: always allowed.
- Move a card **backward**: always allowed.
- Move a card **forward**: only when **every task in its current phase is
  Approved**. Otherwise the drop is rejected — the column shakes and a toast
  explains why. Forward columns show as locked (dimmed + 🔒) during such a drag.
- When a phase is fully Approved it shows **Phase cleared ✓** and an
  **Advance phase →** button that moves all its tasks to the next phase and
  resets their status to In Progress.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check + production build
- `npm run preview` — preview the production build

## Architecture

- `src/lib/supabase.ts` — Supabase client singleton (Auth + DB)
- `src/hooks/useAuth.tsx` — session provider + `RequireAuth` route guard
- `src/hooks/useInterns.tsx` — global intern pool (context, shared across pages)
- `src/hooks/usePortfolio.ts` — homepage data + assignment mutations
- `src/hooks/useProjectBoard.ts` — one project's phases/tasks/comments + every
  mutation (single source of truth; optimistic with snapshot revert + toast)
- `src/pages/` — `AuthPage`, `PortfolioPage`, `BoardPage`
- `src/components/` — `Layout`, `ProjectCardTile`, `AssignPopover`,
  `InternManager`, `PhaseColumn`, `TaskCard`, `StatusSelect`, `CommentsPopover`,
  `SettingsModal`, `Avatar`, `Modal`, `Toast`

## Design

Light product UI: white surfaces on a soft navy-tinted background, solid navy
top nav, with **maroon `#5e0743`** and **sunburst orange `#ff7300`** as
deliberate accents (defined as `navy` / `maroon` / `sunburst` scales in
`tailwind.config.js`). Hover lift on cards, tilted drag overlay, skeleton
loaders, designed empty states, and toast notifications throughout.
