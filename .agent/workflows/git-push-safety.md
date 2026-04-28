---
description: 
---

# Workflow: Git Push Safety

This workflow defines the mandatory steps to ensure that all code pushed to the repository is stable and follows the project standards.

## 1. Pre-Commit Validation
- [ ] **Tests**: Run `pnpm test`. It is forbidden to push code that breaks existing tests.
- [ ] **Lint & Types**: Ensure the code passes basic static analysis (if configured) and `npx tsc --noEmit`.
- [ ] **No Debug Code**: Verify that no `console.log` (unless intended for production), `debugger`, or `.only` tests are left in the code.

## 2. Git Cleanliness
- [ ] **Untracked Files**: Check for new files that should be added or ignored (`git status`).
- [ ] **Surgical Diffs**: Review the diff (`git diff --cached`) to ensure only the intended changes are being committed. Avoid "ghost" changes in unrelated files.

## 3. Commitment Standards
- [ ] **Conventional Commits**: Use clear, descriptive commit messages:
  - `feat(...)`: for new features.
  - `fix(...)`: for bug fixes.
  - `docs(...)`: for documentation changes.
  - `refactor(...)`: for code changes that neither fix a bug nor add a feature.

## 4. Final Sync
- [ ] **Pull First**: Run `git pull origin main` to ensure you are working on the latest version and to resolve conflicts locally.
- [ ] **Final Build**: If the project has a build step, run it once to ensure the final bundle is correct.
