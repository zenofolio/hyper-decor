# Skill: Publish Safety Checklist

This skill ensures that every update and publication of `@zenofolio/hyper-decor` is safe, stable, and correctly documented.

## 1. Quality Assurance
- [ ] **Run All Tests**: Execute `pnpm test`. All 100+ tests must pass.
- [ ] **Type Check**: Run `npx tsc --noEmit` to ensure no regression in type safety.
- [ ] **Benchmarks**: If changes affect NatsMQ or Core logic, run `pnpm bench:concurrency` and `pnpm bench:cron`.

## 2. Versioning & Package
- [ ] **SemVer Check**: Ensure the version bump in `package.json` follows Semantic Versioning (Major/Minor/Patch).
- [ ] **NPM Sync**: Verify if the version already exists on NPM to avoid 403 errors.
- [ ] **Build Fresh**: Run the build script (if applicable) to ensure `dist/` matches the latest `src/`.

## 3. Distributed Safety (NatsMQ)
- [ ] **Locking Logic**: If Cron logic changed, verify that the lock bucket format is still consistent across versions to avoid race conditions during rolling updates.
- [ ] **Contracts**: Ensure `NatsMessageContract` changes are backward compatible or correctly versioned.

## 4. Documentation
- [ ] **README Update**: Ensure new features are documented with examples.
- [ ] **Architecture Docs**: Update `docs/architecture.md` if the component tree or core logic changed.

## 5. Final Verification
- [ ] **Git Clean**: Ensure no uncommitted changes remain.
- [ ] **PeerDependencies**: Check if `hyper-express`, `nats`, or `ioredis` versions need to be updated.
