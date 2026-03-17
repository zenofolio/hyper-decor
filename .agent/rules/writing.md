---
trigger: always_on
---

## Code Change Protocol

Before touching any code, answer these 4 pillars in order.

### 1. TRACE — before writing
Map everything that uses the code you're about to touch.
- Who calls it? What imports it? What depends on its signature or behavior?
- If you change the contract, what else breaks?
- Read the file before assuming anything.

### 2. JUSTIFY — before writing
Why must it change?
- There must be a clear, scoped reason.
- "Improve it while I'm here" is not a reason.
- If the reason is unclear, ask before acting.

### 3. MINIMIZE — during writing
The diff must be surgical.
- Only change what was asked.
- No refactoring adjacent code.
- No adding features on the side.
- No cleaning up things that weren't broken.

### 4. VERIFY — after writing
Confirm consumers of the modified code still work.
- Check type contracts, imports, and call sites.
- Run or reference tests that cover the changed path.
- If behavior changed, document why in the commit.
