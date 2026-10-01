# Weekly Planner

A single-page weekly calendar (Mon–Sun) with categories, a "To schedule" tray,
repeating events, time zones, weekly review, and JSON import/export.
Plain HTML/CSS/JS, no build step.

## Run locally

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push this repository to GitHub.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/docs`, then Save.
3. The site appears at `https://<your-account>.github.io/<repository>/` after a minute or two.
4. Every `git push` to `main` redeploys automatically.

## Data

Events are stored in the browser's `localStorage`, separately for each URL.
When the address changes (file://, localhost, github.io), use **Export** on the old
one and **Import** on the new one to move your data.

## Connecting your own backend

All persistence goes through the `Store` object at the top of the script in
`docs/index.html`. Replace `Store.load()` and `Store.save()` with calls to your API
(PostgreSQL / Supabase / Spring Boot). Never put secret keys in this file;
it is public once deployed.
