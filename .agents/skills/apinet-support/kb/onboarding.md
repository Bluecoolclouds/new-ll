---
name: APINET.CLOUD Onboarding
description: First-time setup, the setup wizard, creating the root admin account, and initial system configuration.
---

# Onboarding & First Setup

**Login page:** https://apinet.cloud/login
**Register:** https://apinet.cloud/register

## Initial Setup Wizard

On first launch the system shows a **4-step setup wizard**:

1. **Database check** — confirms the database connection (SQLite by default)
2. **Administrator account** — create the root user (username + password)
3. **Usage mode** — choose how the platform will operate
4. **Review & initialize** — confirm and finish

> The wizard only appears if no root user exists yet. If someone already completed it, the login page is shown instead.

### Common Issues During Setup

**"System already initialized" but I can't log in**
- The setup was completed before. Use https://apinet.cloud/login
- Default credentials if unchanged: `root` / `123456` — change these immediately

**Wizard won't advance past step 1 (Database check)**
- SQLite warning: "Make sure the file is persisted" — this is just a warning, click **Next**
- If using MySQL/PostgreSQL: set the `SQL_DSN` environment variable before starting

**Lost root password**
- If using SQLite: stop the app, delete `new_api.db`, restart — the wizard reappears
- If using an external DB: reset the password hash directly in the `users` table (bcrypt)

---

## After Setup: First Steps for Admins

1. **Change the root password** — https://apinet.cloud/profile → Settings
2. **Add a channel** — https://apinet.cloud/channel → Add Channel (add your OpenAI/Anthropic/etc. key)
3. **Check models** — https://apinet.cloud/models — auto-fetched from channels
4. **Create an API token** — https://apinet.cloud/keys → Add Token
5. **Test in Playground** — https://apinet.cloud/playground

---

## Environment Variables (for self-hosted setup)

| Variable | Purpose |
|---|---|
| `SQL_DSN` | Database connection string (leave empty for SQLite) |
| `REDIS_CONN_STRING` | Redis URL for caching/rate-limiting |
| `SESSION_SECRET` | Secret for session signing (important for multi-node) |
| `PORT` | HTTP port (default 3000) |
