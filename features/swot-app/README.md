# FTC SWOT Analyzer

SWOT (Strengths, Weaknesses, Opportunities, Threats) planning feature for Everything That's Scrum, built standalone for local testing. React 18 + Vite + Tailwind 3 + lucide-react, styled to match the main app.

## Working on the `swot` branch

This feature is staged on the `swot` branch with a **draft pull request** into `main`. Pushing to `main` deploys to production (GitHub Pages), so all SWOT work stays on `swot` until it's ready.

Coming back to it:

```bash
cd ~/Project-Tracker
git switch swot          # move onto the SWOT branch (run `git branch` to check; * marks the current one)
git pull                 # get anything pushed since last time
git merge origin/main    # optional: bring in newer changes from main
cd features/swot-app
npm install
npm run dev
```

Save progress with `git add .`, `git commit -m "..."` and `git push`. Each push updates the draft PR and never deploys.

When it's ready: integrate it into the main app (see "Merging into the main app" below), then click **Ready for review** on the PR and merge. Merging is what deploys it.

## Local development

Requires Node 20.19+.

```bash
npm install
npm run dev          # http://localhost:5173 (add `-- --host` to test from phones on the same Wi-Fi)
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload and the local database |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` with the local database |
| `npm run lint` | ESLint |
| `npm run db:reset` | Wipe local data (stop the server first; it keeps state in memory) |

Sign in with any name and pick Lead, Teammate or Guest. Lead asks for a password (`scrumlead` by default; set `VITE_LEAD_PASSWORD` in `.env.local` to change it). It's a browser-side check for testing only, not real security. Open two windows to test the lead and member views side by side (use a private window, or click **Switch** in the DEV pill, since sign-in is stored per browser).

## Local database (temporary)

`local-db/plugin.js` adds a small API to the Vite dev/preview server. Data is saved to `.local-db/db.json` (gitignored) and pushed live to every open browser tab, so you can test leader and member views side by side. Run only one server (dev or preview) at a time, since each keeps its own in-memory copy.

The feature only touches data through `src/utils/swotStore.js`. At merge time, reimplement that file against Supabase.

## Merging into the main app

Files mirror the main app's layout so they drop straight in:

| File | Merge? |
| --- | --- |
| `src/components/SwotView.jsx` | **Yes**, the feature. Render it from the main `App.jsx` like `DesignMatrix` and add it to `Sidebar.jsx`; add `<NotificationBell />` in the header's right slot. |
| `src/utils/swotStore.js` | **Yes**, after rewriting it for Supabase (same exports). |
| `src/contexts/UserContext.jsx`, `src/hooks/usePermissions.js` | No: local stand-ins; the real ones already exist. |
| `src/components/ToastProvider.jsx`, `tailwind.config.js`, `src/index.css` | No: copied from the main app unchanged. |
| `src/App.jsx`, `src/main.jsx`, `local-db/` | No: local test harness only. |

Lead vs member comes from `usePermissions().hasLeadTag`; guests can view but not suggest.

The lead focuses the team by clicking a section's header (or the Team focus buttons). Teammates and guests are then locked to that one section until the lead picks another or clicks **Unlock all sections** (`activeSection: null`).
