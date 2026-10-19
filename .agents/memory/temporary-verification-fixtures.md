---
name: Temporary verification fixtures
description: Prevent stale assumptions about disposable synthetic browser-test databases
---

Treat `/tmp` verification databases as disposable across sessions. An existing SQLite file does not prove that its synthetic users and statistics are still initialized.

**Why:** The environment lost a previously prepared fixture; starting the application recreated the database schema, so the file existed but the browser reached the installation wizard instead of the cabinet.

**How to apply:** Check initialization and the intended synthetic identity before assigning authenticated browser checks. Recreate only isolated fake data when needed; never copy the real account database merely to obtain a test session.

Isolate session signing as well as the database, and close the synthetic browser context before restoring the normal server on the same origin.

**Why:** Switching a workflow back from a fixture database does not remove cookies or stop background browser requests. Reusing the normal session signing secret can make a fixture identity valid against the normal database.

**How to apply:** Run disposable fixtures without inheriting the normal session secret or loading the project's environment file; allow the server to generate an ephemeral signing key. Reauthenticate after fixture restarts, and clear cookies/storage or close the test context before restoring the normal workflow.

Do not treat a successful login response as proof that session authentication works; verify a protected request using the returned cookie before continuing a session-dependent flow.

**Why:** In a disposable instance, registration and login returned success but the next protected request returned 401 despite the session cookie being sent, so session continuity remained unverified.

**How to apply:** If this happens, stop before API-key or billing checks and confirm the flow in a browser or another production-like test context; report the isolated smoke test as incomplete until the cause is identified.
