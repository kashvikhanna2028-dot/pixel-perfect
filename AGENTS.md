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
- Keep subscription calculations, validation, presets, and CSV serialization in `src/lib/subscriptions.ts` so billing rules can be tested independently.
- Load subscription data through authenticated server functions and shared TanStack Query options so the list, overview, and notifications agree after mutations.
- Advance billing dates through owner-scoped database RPCs with row locks or expected-date checks to prevent duplicate renewal updates.
- Prepare future email reminders in authenticated TanStack server functions; external schedulers must use signature-verified public server routes rather than Edge Functions.
