## 2026-09-06 — Added .nojekyll so Pages stops running Jekyll over a static site

**Who:** Geordi (Claude Code, attended with Elizabeth)
**Trigger:** A GitHub Pages deploy on `card-catalog-generator` failed twice and reported
nothing. Investigating it turned up a fault shared by ten of the estate's repos, and
Elizabeth asked for the whole set checked and fixed.

**What we did:**
- Added an empty `.nojekyll` at the repo root and pushed to `main`.
- Confirmed the Pages build completed and the live site still serves correctly.

**Why / decisions:**

This site is published through GitHub Pages' legacy builder, which runs Jekyll over the
repo unless told otherwise. It has no Jekyll structure at all — no `_config.yml`, no
`_layouts`, no `_includes`, no Gemfile — and not one of its files carries YAML front
matter. That was verified before the change, not assumed: `.nojekyll` on a genuine Jekyll
site would break it.

So the Jekyll stage was doing nothing here except adding a step that can fail. On
`card-catalog-generator` on 2026-09-06 it did exactly that: two consecutive builds wedged
at `duration: 0` with `updated_at` frozen at creation, one eventually reporting only a
generic "Page build failed", while GitHub's status page showed Pages fully operational
throughout. Adding `.nojekyll` there fixed it immediately and halved build time.

Build time on this repo: **41.2s before, 23.2s after.**


**What I deliberately did NOT do:** nothing else was touched. The commit staged
`.nojekyll` and only `.nojekyll` — the script that applied this across nine repos aborted
on any repo where a second path appeared in the staged set. No repo was pushed unless it
was already clean and in sync with origin beforehand.

**Files touched:** `.nojekyll` (new)

**Follow-ups / watch:**
- A hung legacy Pages build is indistinguishable from a slow one without API access: the
  build list keeps reporting `building` indefinitely and the status page shows all-clear.
  `POST /repos/{owner}/{repo}/pages/builds` forces the issue and surfaces the real error.
- Migrating this repo from the legacy builder to GitHub Actions Pages is the longer-term
  fix; the legacy builder is deprecated. Not done, and not urgent.

# Session Log

A running, human-readable history of work sessions on this repo — the
*conversation* behind the changes: what we set out to do, what we discovered,
why we made the calls we made, and what to watch next.

**This is not the git log.** Commits record *what* changed, line by line. This
file records *why* — the reasoning, the dead ends, the decisions, the follow-ups.
If you're new to this repo (human or AI agent), read this top-to-bottom to
understand how it got to where it is.

## How to use it

- **Append a new entry at the TOP** (newest first) at the end of every session.
- Keep it narrative and honest — include what you tried that *did not* work and
  why you chose what you chose. Future-you will thank you.
- One entry per working session. Use the template below.
- When this file gets long (years from now), move old entries into
  `_session logs/<year>.md` and keep this file as the current running doc.

```markdown
## YYYY-MM-DD — <short title>

**Who:** <agent / person>
**Trigger:** <the request or brief that started the session>

**What we did:**
- <bullet>

**Why / decisions:**
- <the reasoning, trade-offs, and anything we deliberately did NOT do>

**Files touched:** <files / commit hashes>

**Follow-ups / watch:**
- <open threads, metrics to check, things the next session should know>
```

---

