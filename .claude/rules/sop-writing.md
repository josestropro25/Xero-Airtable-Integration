# SOP & Instruction Writing Rules

Rules for writing agent instructions, workflow docs, and SOPs in this project.
The goal is to be specific where specificity matters, without turning everything into a jail.

---

## Always pair prohibitions with the correct behaviour

When writing a rule that tells the agent NOT to do something, always include what to do instead — and why.

**Why:** "Never do X" leaves the agent without direction. It knows what to avoid but not what to replace it with. It will either guess (and may guess wrong) or ask (and slow down the workflow).

**Pattern:**
```
Never [prohibited action] — [why it fails].
Instead: [correct action] — [why it works].
```

**Example (bad):**
> Never dump a large API response into context.

**Example (good):**
> API responses always enter context automatically — you cannot prevent this. A 55-record Airtable response or a 700-line PO list will consume most of the context window if left alone.
> Instead: immediately after receiving each response, use the Write tool to save it to a file on disk. The reconcile.js script reads from files, not context. Once saved, the in-context copy is irrelevant.

---

## Be specific where the stakes are high

Not every instruction needs this level of detail. Apply it where:
- A wrong action is hard to reverse (creating Xero documents, deleting records)
- A wrong assumption has burned us before (context exhaustion, false-match bugs)
- The correct behaviour is non-obvious to a cold agent

For low-stakes steps, a short instruction is fine. Over-specifying simple things buries the important rules.

---

## Show, don't just tell

Where the correct behaviour has a concrete form (a code pattern, a file path, a tool call), write it out explicitly.

**Bad:** "Use the correct match pattern."
**Good:** `ref === code || ref.startsWith(code + ' ')` — never `ref.startsWith(code)` without the trailing space.

---

## State what is already guaranteed by the system

Some things agents tend to over-engineer because they don't know the system handles it. Make those explicit.

**Example:** "The list-purchase-orders handler fetches all pages automatically — do not loop or paginate manually."

---

## Avoid double negatives

"Do not fail to write the file" → "Write the file."
Negating a negation makes rules hard to parse quickly under a long context load.
