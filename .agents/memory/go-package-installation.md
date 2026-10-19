---
name: Go package installation
description: Environment-specific fallback when Replit's package installer rejects Go
---

**Rule:** Try the package-management callback first for new Go dependencies. If it returns `no such language: go`, use standard Go module tooling for the dependency.

**Why:** The installer documented Go as a valid language but rejected it in this workspace. The Go toolchain remained available and succeeded.

**How to apply:** Only use the fallback after observing that installer error; keep module changes limited to the dependency actually needed.