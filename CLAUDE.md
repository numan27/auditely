# CLAUDE.md

This is the entry point for AI agents working in this repository. Read this file first, then load only the skill file relevant to your current task.

---

## Quick Commands

```bash
npm run dev       # Dev server at localhost:3000
npm run build     # Production build
npm run start     # Start production server (run build first)
npm run lint      # ESLint check
```

---

## Tech Stack (at a glance)

- **Next.js 16** App Router · React 19 · TypeScript 5
- **Tailwind CSS v4** + SCSS modules (hybrid styling)
- **Redux Toolkit** + redux-persist
- **next-themes** · Formik + Yup · Axios

All shared code lives under `app/_shared/`. Use `@/app/_shared/` for all imports from shared folders.

---

## Skill Files

Load the appropriate skill file for your task. Each file is self-contained and focused.

| Task                                                          | Skill file                                              |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Understand project structure, add pages, configure Next.js    | `.claude/skills/architecture/SKILL.md`                  |
| Use or create UI components (Button, Modal, Input, etc.)      | `.claude/skills/components/SKILL.md`                    |
| Apply styles, work with CSS variables, Tailwind, SCSS         | `.claude/skills/styling/SKILL.md`                       |
| Implement auth, protect routes, work with tokens/API          | `.claude/skills/auth/SKILL.md`                          |
| Add Redux state, create slices, use hooks                     | `.claude/skills/state/SKILL.md`                         |
| Navigate between pages, add new routes, update access control | `.claude/skills/routes/SKILL.md`                        |
| Follow naming conventions and component size rules            | `.claude/rules/code-standards/SKILL.md`                 |
| Add images/icons/fonts, use Next.js Image component           | `.claude/rules/assets/SKILL.md`                         |
| Generate a multi-stage Dockerfile for this Next.js app        | `.claude/skills/write-dockerfile/SKILL.md`              |
| Create a GitHub Actions workflow to build + deploy via SSH    | `.claude/skills/github-workflow-docker-deploy/SKILL.md` |

---

## Critical Rules (always apply, regardless of task)

1. **Routes** — Never hardcode route strings. Always use `ROUTES.*` from `app/_shared/lib/config/routes.ts`.
2. **Assets** — Never reference asset paths directly as strings. All assets (images, icons, fonts) live in `app/_shared/assets/` and must be exported from their `index.ts` before use. The `public/` folder is only for static files served at the root (e.g. `favicon.ico`).
3. **Images** — Always use `<Image />` from `next/image`. Never use `<img>`.
4. **Component size** — Files must not exceed 300–350 lines. Split into sub-components or hooks.
5. **Naming** — All component folders and files use **camelCase** (e.g. `fileUpload/fileUpload.tsx`).
6. **Imports** — Always use `@/app/_shared/` prefix for shared code. Never use relative `../../` paths.
7. **Modals & Dialogs** — Always create a dedicated, separate component file for every modal or dialog (e.g. `confirmDeleteModal/confirmDeleteModal.tsx`). Never inline modal or dialog content inside a parent component.
