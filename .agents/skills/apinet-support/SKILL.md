---
name: apinet-support
description: Tech support knowledge base for APINET.CLOUD — an LLM gateway platform. Use when answering user questions about account setup, API tokens, channels, billing, errors, models, authentication, or admin functions. Covers all user-facing features and common issues.
---

# APINET.CLOUD — Tech Support Skill

APINET.CLOUD is an LLM gateway platform that lets users access many AI models (OpenAI, Claude, Gemini, DeepSeek, etc.) through a single unified API. Users top up a quota balance, create API tokens, and make requests via the OpenAI-compatible API.

**Base URL:** https://apinet.cloud/

## How to Use This Skill

Read the relevant sub-file from `kb/` based on the user's issue:

| Topic | File | When to use |
|---|---|---|
| First-time setup & account | `kb/onboarding.md` | New users, initial setup wizard, root account |
| API tokens (keys) | `kb/tokens.md` | Creating/managing tokens, access errors, model restrictions |
| Channels (upstream providers) | `kb/channels.md` | Adding providers, channel errors, routing |
| Billing & wallet | `kb/billing.md` | Top-up, redemption codes, quota, payment methods |
| Errors & troubleshooting | `kb/errors.md` | HTTP errors, error messages, rate limits, bans |
| Models & routing | `kb/models.md` | Available models, model access, group pricing |
| Login & authentication | `kb/auth.md` | OAuth, 2FA, Passkeys, session issues |
| Admin & user management | `kb/admin.md` | User roles, rate limits, system settings |

## Response Style

- Be concise and friendly
- Give step-by-step instructions when explaining UI actions
- Always include a direct link to the relevant page (e.g. https://apinet.cloud/keys)
- For errors, always provide the cause AND the fix
- If the issue involves the admin panel, clarify whether the user has admin/root access first
- Speak the user's language (Russian or English, match what they write)

## Quick Reference — Quota System

- **1 USD = 500,000 quota units** (default ratio)
- Quota is consumed per request based on model pricing ratios
- Users can check balance at: https://apinet.cloud/wallet
- Admins set top-up amounts in: **System Settings → Operations**

## Key Pages (always link when relevant)

| Page | URL |
|---|---|
| Login | https://apinet.cloud/login |
| Register | https://apinet.cloud/register |
| API Tokens | https://apinet.cloud/keys |
| Wallet / Top-up | https://apinet.cloud/wallet |
| Playground | https://apinet.cloud/playground |
| Usage Logs | https://apinet.cloud/log |
| Models | https://apinet.cloud/models |
| Channels (admin) | https://apinet.cloud/channel |
| Users (admin) | https://apinet.cloud/user |
| System Settings (admin) | https://apinet.cloud/setting |
| Redemption Codes (admin) | https://apinet.cloud/redemption |
