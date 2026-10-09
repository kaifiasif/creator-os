# Web app conventions

The web app is React 19 + TypeScript + Tailwind v4 + shadcn/ui (new-york-v4, neutral theme), in the shadcn "dashboard" layout.

## Structure

```
src/
  app/            shell: router, providers, theme, global overlays (command menu, shortcuts), auth gate
  api/            typed client (Hono RPC from the server's own routes), errors, query client, inferred types
  components/
    ui/           shadcn/ui components, vendored unmodified from the shadcn repo
    layout/       sidebar, site header, Screen wrapper
    shared/       small app-wide pieces: StatusBadge, Page/PageHeader, QueryView, EmptyState, StatCard
  features/<name>/
    api.ts        the feature's TanStack Query hooks; the only place it talks to the server
    *-page.tsx    one screen, rendered by app/app.tsx
    components/   pieces used only by this feature
  hooks/          app-wide hooks (useHotkey, useIsMobile)
  lib/            pure helpers: format, labels, utils, storage
```

## Rules

- **Types come from the server.** Use the types in `@/api/types` (inferred from the routes). Never redeclare a response shape and never use `any`.
- **Data access only through a feature's `api.ts` hooks.** Components never call `fetch` or the client directly. Mutations invalidate through `queryKeys`.
- **Server errors are `ApiError`** with a stable `code`. Branch on `code`, show `message`. Use `toast.error(errorMessage(e))` for action failures and `QueryView` / `ErrorAlert` for load failures.
- **shadcn first.** Build from `@/components/ui/*`. Add a missing primitive by vendoring it from the shadcn repo, not by writing a lookalike.
- **Small components.** One component per concern; a file over ~200 lines is a sign to split it.
- **Labels in one place.** Every user-facing name for a server enum lives in `@/lib/labels`.
- **Copy:** sentence case, plain verbs, a button says what it does ("Accept draft", not "Submit"). No all-caps labels, no "A · B" meta strings, no arrows in button text. Plurals are always correct (`plural()` in `@/lib/format`).
- **Accessibility:** every icon-only button has an `aria-label`; keyboard focus is always visible; layouts work at 375px wide.
- **Colour**: the editor's blue pencil (`primary`) is the one brand colour: actions, focus, selection and where you are. The four proof colours only mark check results, and blue never does.
- **Motion** lives in `index.css` (`motion-*`, `proof-*`, `title-mark`, `ruled`, `lift`, `pencil-select`, `ink-sweep`) plus `CountUp` for headline numbers, never as one-off styles in a component. It answers an action (opening, selecting, a check arriving), plus one short entrance per screen and the log-in demo, which plays once. Only loading indicators loop, and `prefers-reduced-motion` skips every animation to its last frame.
