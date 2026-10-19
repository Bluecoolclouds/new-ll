---
name: Authentication
description: Login methods, OAuth providers (GitHub, Discord, Telegram, LinuxDO, WeChat, OIDC), two-factor authentication (2FA/TOTP), Passkeys (WebAuthn), and session issues.
---

# Authentication

**Login:** https://apinet.cloud/login
**Register:** https://apinet.cloud/register
**Profile settings:** https://apinet.cloud/profile

## Login Methods

### Username & Password
- Standard login at https://apinet.cloud/login
- Default root account: `root` / `123456` (change immediately after setup)

### OAuth (Social Login)
Supported providers (admin must enable each at https://apinet.cloud/setting → OAuth):

| Provider | Setup Required |
|---|---|
| GitHub | GitHub OAuth App (Client ID + Secret) |
| Discord | Discord Application (Client ID + Secret) |
| Telegram | Telegram Bot Token |
| LinuxDO | LinuxDO OAuth credentials |
| WeChat | WeChat Official Account (China) |
| OIDC | Any OpenID Connect provider (Client ID + Secret + Issuer URL) |

**"OAuth login not working"**
1. Admin must enable the provider at https://apinet.cloud/setting → OAuth
2. Callback URL must be set in the OAuth app to `https://apinet.cloud/oauth/callback`
3. Check that Client ID and Secret are correct

### Two-Factor Authentication (2FA / TOTP)
1. Go to https://apinet.cloud/profile → Security
2. Click **Enable 2FA**
3. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
4. Enter the 6-digit code to confirm

**Lost 2FA access?**
- Contact admin — they can reset 2FA at https://apinet.cloud/user → Edit user → Reset 2FA

### Passkeys (WebAuthn)
1. Go to https://apinet.cloud/profile → Security → Passkeys
2. Click **Add Passkey**
3. Follow browser prompts (Face ID, Touch ID, hardware key, etc.)

## Session Issues

**"Session expired" / keeps logging out**
- Sessions expire after inactivity
- If using multiple nodes: ensure `SESSION_SECRET` is the same on all nodes
- Fix: log in again at https://apinet.cloud/login

**"Invalid credentials"**
- Double-check username and password
- Passwords are case-sensitive
- If forgotten: ask admin to reset at https://apinet.cloud/user → Edit user

**Account disabled**
- Admin has disabled the account
- Contact admin to re-enable at https://apinet.cloud/user → toggle status

## Changing Password

1. Go to https://apinet.cloud/profile
2. Click **Change Password**
3. Enter current password + new password
4. Save
