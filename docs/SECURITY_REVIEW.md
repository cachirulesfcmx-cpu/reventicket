# Security review checklist

- [ ] No credentials in Git, logs, client bundles or screenshots.
- [ ] Supabase service-role key is server-only.
- [ ] RLS enabled and tested for all exposed tables.
- [ ] No client write policy for canonical games, odds, model versions or predictions.
- [ ] API input schemas, rate limits and safe error responses.
- [ ] Provider data is treated as untrusted input.
- [ ] Authentication and authorization tested, including anonymous requests.
- [ ] Dependency and secret scanning in CI.
- [ ] Privacy policy, data retention and account deletion documented.
- [ ] Production data access and backup/restore reviewed.
