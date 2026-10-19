---
name: Workflow port conflicts
description: Diagnose failed launches when an earlier New API instance is still listening.
---

Do not assume a failed workflow means the application process has exited. Check the launch error and the process owning port 5000 before rebuilding or repeatedly restarting.

**Why:** A repeated launch failed with `bind: address already in use` while the earlier New API instance remained alive. Successful HTTP responses alone therefore did not prove that the newly launched workflow was running.

**How to apply:** Stop the managed workflow, verify and terminate any remaining instance of this project's executable if necessary, then start the workflow once. Use an `exec` launch so the workflow directly controls the server process. Verify both workflow state and HTTP responses.
