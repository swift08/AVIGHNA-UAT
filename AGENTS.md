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

## Workspace architecture
- Use a shared workspace provider and root shell for company context and appearance so every content route retains the same identity.
- Keep company branding in global semantic CSS tokens; company selection changes accents while appearance controls neutral surfaces.
- Keep demo business records in the shared browser-safe data module and filter by company; these are presentation examples, not persisted production records.
- Persist only company and appearance preferences in browser storage, never permissions, roles, or business records.
