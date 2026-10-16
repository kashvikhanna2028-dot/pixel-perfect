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

## Expiry Radar

- Keep dashboard, authentication, history, settings, and tracker forms within one shared app shell so account state and navigation stay consistent.
- Keep expiry calculations pure in `src/lib/expiry-radar.ts` so reset timing can be tested independently of the interface.
