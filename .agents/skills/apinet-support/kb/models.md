---
name: Models & Routing
description: Available AI models, model naming, group-based access, pricing ratios, reasoning models, and model routing behavior.
---

# Models & Routing

**View available models:** https://apinet.cloud/models
**Test models in Playground:** https://apinet.cloud/playground

## How Models Work

Models in APINET.CLOUD come from **channels**. When a user requests `gpt-4o`, the system:
1. Looks up which channels support `gpt-4o` for the user's group
2. Picks the best channel based on priority and weight
3. Forwards the request and converts the format if needed (e.g., to Anthropic format)

## Checking Available Models

- **Users:** Playground dropdown at https://apinet.cloud/playground
- **Via API:** `GET https://apinet.cloud/v1/models` with your token — returns all accessible models
- **Admins:** https://apinet.cloud/models — all registered models with their channels

## Model Categories

### Text / Chat
- OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, `o1`, `o1-mini`, `o3`, `gpt-5.5`
- Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307`, `claude-3-7-sonnet-20250219`
- Google: `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`
- DeepSeek: `deepseek-chat`, `deepseek-reasoner`
- Mistral: `mistral-large-latest`, `mistral-small-latest`

### Image Generation
- `dall-e-3`, `dall-e-2`
- Midjourney: via the `/mj/` endpoints

### Audio
- TTS: `tts-1`, `tts-1-hd`
- Transcription: `whisper-1`

### Embeddings
- `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`

### Reasoning Models (Special behavior)
- `o1`, `o1-mini`, `o3`, `o3-mini` — OpenAI reasoning models
- `claude-3-7-sonnet` with thinking mode — extended thinking tokens billed separately
- `gemini-2.0-flash-thinking-exp` — thinking tokens

> Reasoning models may have higher latency. Thinking tokens are billed at a different ratio.

## Groups & Model Access

Users are assigned to **groups** (e.g., Default, VIP, Free). Groups control:
- Which models a user can access
- Pricing multipliers (VIP users might pay less)
- Rate limits

**"No available channel for model X in group Y"**
→ Admin can fix at https://apinet.cloud/channel:
1. Add the user to a different group
2. Configure the model to be available in that group

## Model Pricing Ratios

Each model has an **input ratio** and **completion ratio** (output). These multiply the base quota cost.

Example: if base = 1 USD = 500,000 units, and `gpt-4o` has ratio 5:
- 1M input tokens = 5 USD equivalent in quota

Admins can customize ratios at **https://apinet.cloud/setting** → Model Prices.

## Custom Model Names / Aliases

Admins can add custom model names that map to real models at https://apinet.cloud/channel → channel settings → **Custom Models**.

Example: user requests `my-gpt4` → system routes to `gpt-4o` on a specific channel.

## Format Conversion

APINET.CLOUD automatically converts between API formats:
- Users always send OpenAI-format requests
- The system converts to Claude/Gemini/etc. format as needed
- Responses are always returned in OpenAI format

So users can use any OpenAI-compatible client with any model.
