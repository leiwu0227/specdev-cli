# API security guide

- Identify trust boundaries and validate untrusted input at the boundary.
- Verify authentication and authorization separately.
- Avoid leaking secrets or sensitive values through logs and errors.
- Check default-deny behavior, replay/idempotency concerns, and rate-sensitive paths.
- For added or upgraded direct dependencies, check the selected version with the
  package manager or registry during execution. Inspect available audit evidence.
  Unresolved direct high/critical advisories block progress unless the approved
  contract explicitly accepts them.
- Do not treat a lockfile-only update as proof that a dependency installs or its
  entry point starts.
- Require evidence proportional to the exposed risk. Do not invent requirements
  outside the approved contract.
