---
name: Playground media storage
description: Storage tradeoff for Stratus playground chats and generated media.
---

The playground stores conversation metadata and message history in the configured SQL database, while media bytes live on the server filesystem. The configured workspace had no App Storage bucket or bucket environment variable.

**Why:** local storage enabled persistent chat/library behavior in the current single-instance Replit workspace without putting image bytes or base64 in SQL.

**How to apply:** keep the local-file backend for a single persistent instance. Before adding replicas or deploying on ephemeral filesystem storage, move media to Replit App Storage and store object paths in the metadata table.
