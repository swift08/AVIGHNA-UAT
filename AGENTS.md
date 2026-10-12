## Workspace architecture

- Use a shared workspace provider and root shell for company context and appearance so every content route retains the same identity.
- Keep company branding in global semantic CSS tokens; company selection changes accents while appearance controls neutral surfaces.
- Keep demo business records in the shared browser-safe data module and filter by company; these are presentation examples, not persisted production records.
- Persist only company and appearance preferences in browser storage, never permissions, roles, or business records.
