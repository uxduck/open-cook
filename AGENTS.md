# AGENTS.md

Guidance for AI agents working in this repository.

## Styling

Use Tailwind CSS utility classes only. Tailwind v4 is wired up via `@tailwindcss/vite` in [apps/web/vite.config.ts](apps/web/vite.config.ts) and imported at the top of [apps/web/src/styles.css](apps/web/src/styles.css).

- Style new and changed UI with Tailwind utilities in JSX. Do not add new rules to `styles.css`.
- Theme colors are plain CSS variables (`--primary`, `--border`, `--card`, …) defined in `styles.css`, not Tailwind theme tokens. Reference them with the variable shorthand, e.g. `border-(--primary)`, `text-(--muted-foreground)`.
- The existing rules in `styles.css` are unlayered, so they take precedence over Tailwind's `utilities` layer. When a utility must override a legacy rule that targets the same element, add the `!` modifier, e.g. `border-(--primary)!`.
- Legacy semantic classes (`.hero-generate-box`, `.primary-action`, …) stay as-is until the code they style is rewritten; migrate them to Tailwind utilities opportunistically when touching that UI.
