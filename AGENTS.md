<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Cursor Cloud specific instructions

- Dependencies: `bun install --frozen-lockfile`. Dev server: `bun run dev`, which listens on port 8080 (set by `@lovable.dev/vite-tanstack-config`, host `::`).
- Auth and data use the hosted Supabase project in the committed `.env`. Do not start a local database.
- `bun x tsc --noEmit` and `bun run build` are the passing checks. `bun run lint` fails on existing Prettier findings in the app source.
- Quote email and admin invites need `RESEND_API_KEY` or `LOVABLE_API_KEY`, plus `SUPABASE_SERVICE_ROLE_KEY`. Those are not in the repo. Sign-in against the hosted project works with the committed publishable key.
