# Frontend

Next.js app for v1 dataset upload, annotation editing, history review, and YOLO export.

```bash
cd frontend
pnpm install
pnpm dev
```

By default the app calls `/api`, and Next.js rewrites that to
`http://127.0.0.1:8000`. Set `NEXT_PUBLIC_API_BASE` only if you want direct
browser calls to a different API origin.

Use `pnpm build`, `pnpm lint`, and `pnpm typecheck` before submitting changes.
Commit `pnpm-lock.yaml` whenever dependencies change.
