---
name: Stratus design integration
description: User's scope and backend boundary for the imported Stratus design
---

The user initially requested the supplied Stratus Hub design as a **third** New API frontend, including the homepage, documentation and a working personal cabinet. Preserve the existing two frontend variants unless asked to remove them.

**Why:** The user explicitly chose “Главная, документация и рабочий личный кабинет” after asking for “3 вариант”.

**How to apply:** Treat the archive as visual source material, not a replacement backend. Keep New API as the authority for accounts, API keys, billing and logs; do not introduce the archive's Clerk/Express/PostgreSQL stack or present its demonstration values as live account data. Existing administrative and payment functionality must remain accessible.

The production target is a complete Stratus frontend, including registration and the rest of the interface, with New API retained only as the backend for keys and other mechanics.

**Why:** The user specified: “регистрация и всё всё ... без new api кроме бекенда (ключи механики) чисто фронтенд стратус”.

**How to apply:** Treat the shared legacy authentication, wallet and administrative screens as incomplete frontend migration, not the final production architecture. Do not replace the backend, existing accounts or payment mechanics.

User-facing Stratus pages, copy, metadata, and documentation use Stratus branding; New API remains an internal backend implementation detail.

**Why:** The user explicitly asked that the Stratus project show Stratus rather than New API.

**How to apply:** Remove legacy product labels from the Stratus UI, but preserve backend contract identifiers such as required request headers and API routes.

Competitor websites are reference material only; Stratus footer and legal links must resolve to Stratus-owned routes. The support contact supplied for these pages is @wpnetwork_sup.

**Why:** The user clarified that codex.sale was a reference, not the destination for Stratus visitors.

**How to apply:** Keep competitor domains out of Stratus navigation and page links. Use the reference to guide the local page structure, and use the supplied Stratus support contact.

The current landing page is the canonical Stratus color template for other pages.

**Why:** The user stated “лендинг это основа шаблон цветов” after rejecting the sky-blue experiment and pointing out that account-creation colors did not match the landing.

**How to apply:** Match new and migrated Stratus screens to the restored landing palette rather than inventing independent auth, wallet or settings palettes. Keep shared color tokens aligned with that visual reference; changing the landing palette requires an explicit new direction.

AI Gateway is a primary landing-page feature, not a separate promotion hidden at the bottom.

**Why:** The user requested that visitors “точно видели” AI Gateway in Features and wanted an “умный маршрутизатор” mention at the top linking to its explanation.

**How to apply:** Keep the router discoverable from the hero and visibly included in Features when rearranging landing content.

Usage analytics should copy New API's quota-distribution graph presentation, not just offer similar capabilities; no pie chart.

**Why:** After comparing the available graph features, the user stated: “круговая не нужна. а так надо как там”. They later supplied a screenshot and corrected: “а надо с new api такой график скопировать было”.

**How to apply:** Use the upstream graph as the visual reference: light pastel model-colored columns, bar/area toggle, total and compact model legend. The user explicitly rejected dark model-series colors. Preserve wallet-token units, request trends/ranking, date ranges and time grouping within Stratus's surroundings. Test data alone does not satisfy a request to copy the graph. Do not add a pie/donut chart.

The cabinet dashboard should be compact: a personal summary above analytics and model coefficients presented side by side on desktop.

**Why:** After the first cabinet redesign, the user supplied a denser reference and approved this structure with “да делай”, asking only to remove API keys from the header.

**How to apply:** Avoid large redundant welcome/account panels that push the useful data below the fold. Keep API-key setup available as an action within the dashboard, not a header navigation item.

API keys, profile and security belong to three tabs of one account-settings block, not independent page layouts with different headers.

**Why:** The user pointed out inconsistent header buttons and requested “апи ключи профиль и безопасность ... 3 вкладками одного блока а не отдельными страницами”.

**How to apply:** Reuse the settings shell and shared authenticated header for these sections. Keep direct links compatible without reintroducing separate navigation layouts.

Cross-frontend navigation, including returning from authentication, must perform a full same-origin page load.

**Why:** These themes use separate client routers. A client-only redirect can leave the old bundle mounted even when the destination belongs to the other theme, causing a 404 or showing the wrong interface.

**How to apply:** Keep in-theme navigation local, but let the server select the correct bundle when moving between Stratus, shared authentication, wallet and administrative screens.

Changing the site theme must make the result visible outside the shared administrative screen.

**Why:** The admin screen intentionally retains the standard frontend. The user saved Stratus successfully but believed nothing had changed because they remained in that screen.

**How to apply:** During the partial rollout, open the public entry point with a full page load after a successful theme change. Migrating the administrative interface belongs to the broader full-Stratus production target, not to this navigation fix.
