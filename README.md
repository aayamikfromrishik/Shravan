# SHRAVAN — Listen. Reflect. Apply.

*by AAYAMIK*

A phone and iPad web app (installable as a PWA) that teaches books one chapter at a time:
**Listen** to a spoken lesson, **Reflect** with a few questions kept in a private journal, and **Apply** with small measurable actions and an end-of-book plan.

The full product spec lives in the SHRAVAN Product Spec doc. This README covers running and deploying the app.

## How it is built

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Sign-in, database, file storage | Supabase (Google sign-in + 6-digit email code) |
| Lessons, actions, plans, Ask, Read-along | Claude API (`claude-sonnet-5-5`), written once per version and saved |
| Voice | The phone's own voice (Web Speech API), free |
| Hosting | Vercel (daily cron for timed-free books and reminders) |
| Payments | Razorpay subscriptions, switched off (`PAYMENTS_ENABLED=false`) |

Key rules the code enforces:

- Every lesson version (3 modes × 3 English levels × 3 languages) is generated once, saved in `chapter_versions` and reused for every learner.
- Every "from the book" quote or example is checked word for word against the chapter text; anything that does not match is removed (`verifyLesson` in `src/lib/ai.ts`).
- Free learners get chapter 1 (max 7 pages) of up to 5 books in their lifetime. A subscription unlocks everything. The admin can make any book free for N days.
- Journals, actions and plans are private to each learner.

## Setting it up (one time)

### 1. Supabase
1. Create a free project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql` and run it. This creates the tables and the private `uploads` storage bucket.
3. **Authentication → Providers**: turn on **Google** (needs a Google Cloud OAuth client; add `https://<your-project>.supabase.co/auth/v1/callback` as the redirect URL) and keep **Email** on.
4. **Authentication → Email templates → Magic link**: make the email show the code with `{{ .Token }}`, e.g. *"Your SHRAVAN code is {{ .Token }}"*.
5. **Authentication → URL configuration**: set the Site URL to your Vercel address and add it to Redirect URLs.

### 2. Vercel
1. Import this GitHub repository at vercel.com → **Add New → Project**.
2. Add the environment variables from `.env.example` (Settings → Environment Variables).
3. Deploy. The daily cron in `vercel.json` runs `/api/cron/daily`.

### 3. First admin steps
1. Sign in with an email listed in `ADMIN_EMAILS`, then open `/admin`.
2. **Starter library** tab → *Import the 5 sample books*.
3. **Add a book** tab → upload *The 100 Decisions Before the First Brick* PDF, copyright status *My own work*, subject *Business & Creative Practice*.
4. **Starter library** tab → *Attach sample lessons*. Chapter 1 of one book per subject now has all 3 modes ready (English, Normal level).
5. Check the books in the **Library** tab and publish or unpublish as needed. *Import everything else* adds the rest of the catalogue.

## Working on the code

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test                     # unit tests (chapter detection, quote checking, library data)
npm run build                # production build
```

| Folder | What is in it |
|---|---|
| `src/app` | Screens (`page.tsx`) and API routes (`api/**/route.ts`) |
| `src/lib` | Text extraction, chapter detection, AI prompts, access rules, saved versions |
| `src/components` | Shared UI, the voice player, mic button |
| `supabase/schema.sql` | Database tables and storage |
| `data/library.json` | The starter catalogue (6 subjects) |
| `data/samples/*.json` | Ready-made sample lessons (built by `scripts/build_samples.py`) |

Copyrighted book text (including the author's own PDF) is never committed; it lives only in Supabase.

## Licence

- **Code:** [GNU AGPL v3.0](LICENSE). You may use, study and change it. If you run a modified version for other people (for example as a website or app), you must share your source code under the same licence.
- **Names and logos:** SHRAVAN, AAYAMIK, their logos and the tagline are not covered by the code licence. See [TRADEMARKS.md](TRADEMARKS.md).
- **Book content:** see [data/CONTENT-LICENCE.md](data/CONTENT-LICENCE.md). The sample lessons of *The 100 Decisions Before the First Brick* are all rights reserved.

Copyright (C) 2026 AAYAMIK.
