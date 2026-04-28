# Frontend

Next.js app for v1 dataset upload, annotation editing, history review, and YOLO export.

```bash
npm install
npm run dev
```

By default the app calls `/api`, and Next.js rewrites that to
`http://127.0.0.1:8000`. Set `NEXT_PUBLIC_API_BASE` only if you want direct
browser calls to a different API origin.
