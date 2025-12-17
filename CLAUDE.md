# memo-again CLAUDE.md

## Objective

Make memo-again compatible with Node 24.x to support OIDC npm publishing in dependent projects.

## Context

- Current: mocha 10.7.3, no explicit Node version constraints
- Goal: Ensure memo-again works with Node 24.x (npm 11.6.2+)
- Reason: Dependent projects need Node 24 for OIDC token generation with npmjs.org
- memo-again is a dependency of scv-bilara and other modules
- Dependencies (log-instance, merkle-json) already tested and compatible with Node 24

## Backlog

1. ✓ Test memo-again against Node 24.x locally (DONE - all 36 tests pass)
2. ✓ Update devDependencies if needed (DONE - found not needed)
3. ✓ Add Node version constraint to package.json (DONE - found not needed)
4. ✓ Run full test suite on Node 24.x (DONE)
