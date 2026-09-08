# Deployment approval

The user reviews UI changes locally with `pnpm dev` and may request rework.
Keep changes local until the user explicitly approves deployment of that version.
Before uploading production files, deploying either website or backend, or restarting PM2 for a release, obtain that approval. Earlier releases do not authorize publishing later revisions.
