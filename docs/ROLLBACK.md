# Rollback plan

- Stop promotion of new builds and disable prediction publication via server-side configuration if data or model integrity is in doubt.
- Roll back Vercel to the last known good deployment.
- Revert code through a reviewed commit; never force-push protected branches.
- For database changes, use reviewed compensating migrations and restore from a verified backup only after impact analysis and explicit approval.
- Preserve published prediction audit history. Do not rewrite outcomes or snapshots to conceal a failed release.
- Record incident start/end, affected versions, root cause, data integrity status and corrective actions.
