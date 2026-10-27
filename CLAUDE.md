@AGENTS.md

# SHRAVAN — notes for Claude Code

- Product: SHRAVAN ("Listen. Reflect. Apply." is only the tagline), shown "by AAYAMIK". Owner: Saptarshi (Karukrit Designs / AAYAMIK).
- Read README.md first. Next.js 16: `proxy.ts` replaces middleware, `params` are async, Turbopack is default.
- All data access goes through API routes with the Supabase service-role client (RLS on, no public policies). Check access with `getCaller` / `chapterAccess` in `src/lib/server.ts`.
- Never commit copyrighted book text. Sample lessons in `data/samples` hold only short verified snippets.
- Two looks: Basic (cream/navy/saffron, default) and Peacock (teal/emerald/gold), via `[data-view]` CSS variables in `src/app/globals.css`. No purple or maroon themes.
- Before building anything new, confirm with Saptarshi; keep explanations in plain language.
- Run `npx tsc --noEmit`, `npx eslint src tests`, `npm test` and `npm run build` before committing.
