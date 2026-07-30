# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React 19 single-page application built with Vite. Application code lives in `src/`:

- `src/main.jsx` initializes React and global styles.
- `src/App.jsx` defines shared layout and routes.
- `src/components/` contains page-level and reusable UI components.
- `src/utils/` contains OCR, detection, YOLO, and ZIP helpers.
- `src/Logo/` stores branding assets; `src/test/` currently holds sample image and label fixtures.

Keep feature-specific behavior near its component and move reusable, non-visual logic into `src/utils/`. Supporting design notes are documented in `COORDINATE_SYSTEM.md` and `OCR_FEATURE_README.md`.

## Build, Test, and Development Commands

Run commands from `nom-web-app/`:

- `npm ci` installs the exact dependency versions in `package-lock.json`.
- `npm run dev` starts the Vite development server with hot reload.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally for verification.
- `npm run lint` checks all JavaScript and JSX with ESLint.

Before opening a pull request, run `npm run lint && npm run build`.

## Coding Style & Naming Conventions

Use modern ES modules and functional React components. Follow the existing two-space indentation and semicolon style. Name components in PascalCase (`AnnotationEditor.jsx`), utilities in lowercase (`ocr.js`), and variables/functions in camelCase. Keep route paths lowercase and descriptive.

ESLint is configured in `eslint.config.js` with the recommended JavaScript, React Hooks, and Vite Fast Refresh rules. Avoid unused variables; intentionally retained constants should follow the configured uppercase naming allowance.

## Testing Guidelines

No automated test framework or coverage threshold is configured yet. For every change, lint and build the app, then manually exercise affected upload, annotation, OCR, zoom, and export flows in the browser. Keep sample fixtures small and place them in `src/test/`. If adding a test runner, use `*.test.jsx` or `*.test.js` beside the code under test and add the command to `package.json`.

## Commit & Pull Request Guidelines

History mixes concise subjects with Conventional Commit prefixes. Prefer clear imperative messages such as `feat: add OCR retry feedback` or `fix: preserve bounding boxes while zooming`. Keep commits focused.

Pull requests should explain the user-visible change, verification performed, and any coordinate or API-contract impact. Link related issues and include screenshots or a short recording for UI changes. Do not commit generated `dist/`, secrets, or local environment files.
