---
name: Stratus native dialogs
description: Native modal positioning under the application's shared CSS reset
---

Do not rely on browser-default margins to center native dialogs in Stratus.

**Why:** The shared CSS reset removes the native centering margins. A functioning modal with correct focus trapping still appeared at the upper-left corner during visual verification.

**How to apply:** Give native modal surfaces explicit centering and viewport-constrained scrolling. Keep their native modal focus and background-inert behavior; changing the positioning does not require replacing the dialog mechanism.
