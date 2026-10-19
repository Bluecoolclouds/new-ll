---
name: Channels (Upstream Providers)
description: Adding and managing upstream AI provider channels, channel types, API key configuration, model mapping, priority/weight, auto-disable behavior, and channel testing.
---

# Channels (Upstream Providers)

**Manage channels:** https://apinet.cloud/channel

Channels are the upstream AI providers (OpenAI, Anthropic, Google, etc.) that APINET.CLOUD routes requests to.

## Adding a Channel

1. Go to **https://apinet.cloud/channel**
2. Click **Add Channel**
3. Fill in:
   - **Type** — select the provider (OpenAI, Anthropic, Google, Azure, etc.)
   - **Name** — label for this channel
   - **API Key** — the upstream provider's API key
   - **Base URL** — override if using a proxy or custom endpoint
   - **Models** — which models this channel supports
   - **Groups** — which user groups can use this channel
   - **Priority** — higher = preferred (default 0)
   - **Weight** — for load balancing between same-priority channels
4. Click **Submit**
5. Test the channel: click **Test** button

## Channel Types

| Type | Notes |
|---|---|
| OpenAI | Standard OpenAI API |
| Azure OpenAI | Requires endpoint URL + deployment names |
| Anthropic | Claude models |
| Google Gemini | Gemini models |
| DeepSeek | DeepSeek models |
| Mistral | Mistral models |
| Midjourney | Image generation via proxy |
| Custom / OpenAI-compatible | Any API that follows OpenAI format |

## Channel Priority & Load Balancing

- **Priority:** channels with higher priority are tried first
- **Weight:** among same-priority channels, traffic is distributed by weight ratio
- Example: two channels with weight 1 and 2 → first gets 33%, second gets 67% of traffic

## Auto-Disable Behavior

Channels are automatically disabled when:
- They return consecutive errors (configurable threshold)
- API key is invalid (401 response)
- Timeout threshold is exceeded repeatedly

**Re-enabling a disabled channel:**
1. https://apinet.cloud/channel → find the channel
2. Check the last error message
3. Fix the issue (update key, check provider status)
4. Click the status toggle to re-enable

## Testing Channels

- **Single channel:** https://apinet.cloud/channel → click **Test** on a channel
- **All channels:** select all → **Batch Test**
- Test results show response time and success/failure

## Common Channel Issues

**Channel keeps getting disabled**
1. https://apinet.cloud/channel → check last error
2. `401` → update the API key
3. Timeout → increase timeout setting or add a faster channel
4. Check upstream provider status page

**"No available channel for model X"**
1. https://apinet.cloud/channel → verify a channel supports that model
2. Check the channel's **Groups** setting — must include the user's group
3. Check the channel is **Enabled**

**Azure OpenAI setup**
- Type: Azure OpenAI
- Base URL: `https://<resource>.openai.azure.com/`
- API Key: Azure API key
- Models: map deployment names (e.g., `gpt-4o` → deployment `my-gpt4o`)

## Monitoring Channel Health

- https://apinet.cloud/channel — shows last test time and status for each channel
- Enable failure notifications at https://apinet.cloud/setting → Monitoring
