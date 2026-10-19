---
name: i18n translation namespace
description: Locale JSON files in web/default use an i18next "translation" namespace — new keys must be nested inside it, not at root.
---

The locale files at `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json` are
structured as `{ "translation": { ...all keys... } }`. i18next is configured with
`translation` as the default namespace, so lookups resolve against `data.translation`.

**Rule:** When adding new i18n keys via a script, insert them into `data.translation[key]`,
NOT `data[key]`. Keys added at the root level will NOT resolve — the UI shows the raw
English key string instead of the translated value (and even English breaks if the key
isn't also present under `translation`).

**Why:** A script that did `data[key] = value` + sorted root keys silently placed ~12
keys at the JSON root. Build succeeded, English happened to render (key == value), but
non-English locales showed raw English, and the symptom only surfaced visually on the page.

**How to apply:** After editing locale files programmatically, verify root keys are exactly
`['translation']`:
`python3 -c "import json; print(list(json.load(open('web/default/src/i18n/locales/en.json')).keys()))"`
