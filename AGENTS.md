# Project Guidelines

## Project Shape

- This is a React 18 + Vite POS application using plain JavaScript/JSX.
- `src/App.jsx` owns global state, authentication, permissions, storage synchronization, and route declarations; feature pages live under `src/pages/`.
- Supabase is the current backend boundary. Keep product persistence, customer flows, queue operations, and staff management in their existing service/schema boundaries.
- Treat Supabase as the cloud source of truth and `localStorage` as an intentional offline or missing-table fallback. Do not change storage keys or fallback semantics casually.

## Foundry Toolkit For VS Code

- Foundry Toolkit is not currently configured in this repository. Before adding Foundry, Azure OpenAI, an agent, or an AI workflow, state the integration boundary and verify that it is required; do not replace Supabase or invent Azure resources implicitly.
- For Foundry Toolkit work, keep credentials and service keys server-side. `VITE_*` values are browser-visible; never put service-role keys, Foundry secrets, or other privileged credentials in `.env.local` or client code.
- Prefer a small, isolated integration under a clear service boundary. Preserve the existing React/Vite entry points and public/customer data protections unless the request explicitly changes them.
- Validate any new Toolkit or Azure configuration with the narrowest available local check, then run the normal production build. Confirm the target deployment provider before adding deployment configuration because Netlify and Cloudflare Pages metadata both exist.

## Security And Data Rules

- Public queue pages must use sanitized Supabase RPCs, not direct reads from personal `customer_orders` data.
- Treat authentication mode, RLS policies, schema migrations, and the `manage-staff` Edge Function as security-sensitive. Review the relevant SQL and deployment docs before changing them.
- Keep service keys in Supabase server-side secrets. The staff-management function is deployed separately with `supabase functions deploy manage-staff`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run deploy:check
npm run preview
```

There is no configured test or lint script. Use the verification scripts when relevant: `npm run verify:products`, `npm run verify:schools`, and `npm run verify:supabase`.

## References

- Setup, Supabase configuration, authentication, and deployment: [README.md](README.md)
- Supabase automation status: [AUTOMATION_STATUS.md](AUTOMATION_STATUS.md)
- Troubleshooting: [QUICK_FIX_GUIDE.md](QUICK_FIX_GUIDE.md)
- Test evidence and known gaps: [TEST_REPORT_2026-08-31.md](TEST_REPORT_2026-08-31.md) and [PRODUCTION_TEST_REPORT_2026-08-31.md](PRODUCTION_TEST_REPORT_2026-08-31.md)
- Database schema and migrations: [supabase/](supabase/)