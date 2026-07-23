# ISSUES

Open sub-issues with the `ready-for-agent` label have been fetched from GitHub and are provided at the start of context. Issues still blocked by unfinished issues have already been filtered out — everything you see is ready to start. Parse them to understand the work to be done.

You will work on `ready-for-agent` issues only.

You've also been passed the last few commits. Review these to understand what work has already been done.

If all tasks are complete, say "NO MORE TASKS" and stop.

# TASK SELECTION

Pick ONE task. Prioritize in this order:

1. Critical bugfixes
2. Development infrastructure (types, tests, dev scripts — precursors to features)
3. Tracer bullets (thin end-to-end slice through every layer, validates architecture early)
4. Polish and quick wins
5. Refactors

# EXPLORATION

Before making any changes, explore the repo to understand the current state. Read CONTEXT.md and AGENTS.md if they exist. Understand the codebase structure, existing patterns, and conventions.

# IMPLEMENTATION

Use the `implement` skill to drive the implementation workflow. Implement using TDD (red → green) where the spec/ticket defines a test seam:

1. Write a failing test that captures the requirement. Test only at the seams the spec defines — do not invent new test seams.
2. Expected values in assertions must come from an independent source of truth (the spec, a hand-computed value, a known-good fixture) — never recomputed with the same logic as the implementation.
3. Write the minimum code to make the test pass.
4. Run tests to confirm everything passes.

Do not do a separate refactor pass — refactoring is handled by the human-driven /code-review stage after the loop.

Follow any project-specific conventions in AGENTS.md.

# COMPLETION

After implementing:

1. Stage and commit all changes with a clear commit message that includes:
   - What was done
   - Key decisions made
   - Any blockers or notes for the next iteration

2. Comment on the issue with a progress summary (use `--body-file` to avoid shell escaping issues):

```bash
COMMENT=$(cat <<'COMMENT_EOF'
## Progress

**Status:** Completed

**Changes:**
- [describe what was implemented]

**Key decisions:**
- [any architectural or implementation decisions]

**Tests:**
- [test results summary]
COMMENT_EOF
)
echo "$COMMENT" > /tmp/gh-comment.md
gh issue comment <number> --body-file /tmp/gh-comment.md
```

3. Close the issue:

```bash
gh issue close <number>
```

# RULES

- Work on exactly ONE issue per session
- Always commit before exiting
- Never force push
- Never push to main — work stays on the feature branch created by ensure_branch.sh
- If you encounter a blocker you cannot resolve, comment on the issue describing the blocker and move on — do NOT close the issue
- Use the project's existing code style and patterns
- Do not modify files unrelated to the current issue
- Never touch `data.json` anywhere — it is per-device user data
