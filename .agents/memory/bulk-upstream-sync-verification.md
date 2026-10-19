---
name: Bulk upstream sync verification
description: How to verify a bulk-downloaded upstream sync is actually complete, and what kinds of gaps to expect
---

When applying many upstream commits at once by bulk-downloading files (instead of git cherry-pick), the "compare 96 commits" file list from the GitHub compare API is not sufficient — it only lists files whose git history changed, not every file whose *symbols* are referenced.

**Why:** A router/controller file downloaded from upstream can reference new functions from files that live in a *different* directory (e.g. `service/`, `model/`) which weren't part of the same commit's file list if they were split across multiple historical commits, or were skipped because they looked "already similar" by size. This produces: code that compiles fine per-file but fails at build time with `undefined: package.Function`. A downstream agent (e.g. running against a deployed/prod clone) can catch this even when the dev sandbox's last build looked green, if new code changed the exact same way — so treat "go build succeeded" as valid only at the moment it ran, not as a permanent guarantee after further file edits.

**How to apply:**
1. After a bulk sync, always run a full local `go build` (or equivalent) to completion — don't trust file-count diffs alone.
2. When build errors show `undefined: package.X`, search the upstream repo tree (via GitHub trees API) for which file defines `X`, diff it against the local file, and replace wholesale if it's not a protected/custom file.
3. Before overwriting any "stale-looking" local file, check `git log --oneline -- <file>` first — a local file with *more* functions than upstream's current version may be intentionally custom (not stale), and blindly overwriting it can delete required functionality. Restore via `git show HEAD:<path>` (read-only) if this happens.
4. Re-run the full-repo diff against upstream (comparing file hashes, not just the original commit-range file list) as a final check — new diffs can surface in files that weren't part of the original compare (e.g. component files with feature additions like column-resizing).
