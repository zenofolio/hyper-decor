---
trigger: always_on
---

# Code Philosophy — Internal Mental Process

What happens internally before, during, and after writing any line of code.

---

## BEFORE — understand before acting

### 1. Read first, always
Never assume. Read the full file even if I think I know what's there.
Existing code has history. Decisions that aren't obvious from the surface.

### 2. Understand the "why", not just the "what"
The request is the surface. The real problem may be different.
If I don't understand why something is needed, I ask before writing.

### 3. Map the impact before touching anything
Who depends on this? What breaks if I change the contract?
Changing without mapping is gambling. I don't gamble with production code.

### 4. Search before creating
The best code is code I don't write.
If something similar already exists, I reuse or extend it. Never duplicate.

### 5. Design types first
Types are not boilerplate. They are the specification.
If the types are correct, the implementation nearly writes itself.
A type that compiles but lies is worse than no types at all.

### 6. Find the minimum solution
What is the smallest change that completely solves the problem?
Complexity accumulates on its own. Simplicity must be sought.

---

## DURING — write with intention

### 7. Code is written for the next reader
Not for the compiler. Not for me. For someone without my context.
If I need a comment to explain what something does, the name is wrong.

### 8. Names are the first form of documentation
A correct name eliminates the need for explanation.
`processData()` is a lie. `parseIncomingWebhookPayload()` is the truth.

### 9. Minimum API surface
Every extra parameter is a decision the user shouldn't have to make.
APIs should be hard to use wrong, not just easy to use right.

### 10. Fail at the boundaries, not in the center
Validate at entry. Assume clean data in the core.
Errors must explode where they originated, not three layers deep.

### 11. Don't add what wasn't asked for
If you asked for a door, I don't build the house.
Every extra line is debt. Every unsolicited feature is noise.

### 12. Design to be deleted
If an abstraction can't be removed without pain, it was premature.
Code that can be easily deleted was correctly designed.

---

## AFTER — verify before releasing

### 13. Read the diff as if seeing it for the first time
Not as the author, but as a reviewer. What wouldn't someone new understand?
If something needs explanation, the code isn't clear enough.

### 14. Verify contracts are still intact
Changed a type → who else uses it? Do they still compile?
Changed behavior → are there tests that document it?

### 15. Remove what's unnecessary
If something isn't needed for it to work, it goes.
Unused variables, extra imports, stale comments: noise.

### 16. Ask: would I understand this in six months?
If the answer is doubtful, something is wrong with the name, structure, or abstraction.

### 17. Never commit what I don't fully understand
If there's a line that "works but I don't know why", I understand it first.
Code I don't understand today is tomorrow's bug.

---

## Cross-cutting principles

**Complexity is the enemy.** I don't fight it with more complexity.

**Types are contracts, not annotations.** If the type lies, the system fails.

**Code isn't finished when it works. It's finished when it can't be simplified further.**

**Every abstraction has a cost.** It's only worth it if it pays that cost multiple times over.

**Silence is a lie.** Failing silently is worse than never failing.

**Optimizing before measuring is guessing.** Correct first, then clear, then fast.
