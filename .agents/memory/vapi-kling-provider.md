---
name: V-API / Kling AI Provider Reference
description: API-документация провайдера V-API (api.gpt.ge) — видео, изображения, аудио, 3D. Нужна при интеграции Kling AI и других китайских моделей в шлюз APINET.
---

# V-API (api.gpt.ge) — Справочник провайдера

**Base URL:** `https://api.gpt.ge`  
**Auth:** `Authorization: Bearer <token>` в заголовке  
**Модель взаимодействия:** асинхронная — запрос возвращает `task_id`, результат получаем через polling или callback.

---

## Структура разделов V-API

| Раздел (оригинал) | Перевод |
|---|---|
| 图片审查 | Модерация изображений (POST) |
| 向量嵌入 | Векторные эмбеддинги |
| 文本排序 | Ранжирование текста (Rerank) |
| 图片生成 (image) | Генерация изображений |
| 视频模型 (Video) | Видеомодели |
| → 快手可灵AI | Kuaishou Kling AI |
| → vidu视频 | Vidu Video |
| → 豆包视频 | Doubao Video (ByteDance) |
| → 即梦AI | Jimeng AI |
| → 海螺视频 | Hailo Video |
| → pika视频 | Pika Video |
| → luma视频 | Luma Video |
| → runway 官方API | Runway (официальный API) |
| → runway 旧版API-暂时失效 | Runway (старый API — временно недоступен) |
| → 数字人 | Цифровой человек / Digital Avatar |
| → sora视频 | Sora Video |
| → 阿里百炼 | Alibaba Bailian |
| 音频模型 (Audio) | Аудиомодели |
| 音乐创作 (suno) | Создание музыки (Suno) |
| 图片处理 (pic) | Обработка изображений |
| 文档处理 (pdf、ocr) | Обработка документов (PDF, OCR) |
| 3D模型 | 3D-модели |

---

## Общий Callback-протокол (для всех асинхронных задач)

При создании задачи можно передать `callback_url` — сервер пришлёт уведомление при смене статуса:

```json
{
  "task_id": "string",
  "task_status": "submitted|processing|succeed|failed",
  "task_status_msg": "string",
  "created_at": 1722769557708,
  "updated_at": 1722769557708,
  "task_result": {
    "images": [{ "index": 0, "url": "string" }],
    "videos": [{ "id": "string", "url": "string", "duration": "string" }]
  }
}
```

> **Важно:** изображения и видео удаляются через 30 дней — нужно переносить в хранилище.

---

## Универсальный запрос статуса задачи

```
GET /task/{task_id}
Authorization: Bearer <token>
```

Ответ содержит: `status`, `video_url`, `image_urls`, `binary_data_base64`.

---

## Kling AI — Генерация изображений

```
POST /kling/v1/images/generations
```

| Параметр | Тип | Обяз. | Описание |
|---|---|---|---|
| model_name | enum | нет | `kling-v1`, `kling-v1-5`, `kling-v2` |
| prompt | string | **да** | Позитивный промпт, до 500 символов |
| negative_prompt | string | нет | Негативный промпт, до 200 символов |
| image | string | нет | Base64 или URL (.jpg/.jpeg/.png, до 10MB, мин. 300×300px) |
| image_reference | enum | нет | `subject` или `face`. Только `kling-v1-5` |
| image_fidelity | number | нет | Сила следования референсу [0,1] |
| human_fidelity | number | нет | Сходство с персонажем [0,1] |
| n | integer | нет | Количество изображений [1,9] |
| aspect_ratio | enum | нет | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3` |
| callback_url | string | нет | URL для webhook |

---

## Kling AI — Виртуальная примерка одежды

```
POST /kling/v1/images/kolors-virtual-try-on
```

| Параметр | Тип | Обяз. | Описание |
|---|---|---|---|
| model_name | enum | нет | `kolors-virtual-try-on-v1` (по умолч.), `kolors-virtual-try-on-v1-5` |
| human_image | string | **да** | Фото человека (Base64/URL, до 10MB, мин. 300×300px) |
| cloth_image | string | **да** | Фото одежды. v1-5 поддерживает верх+низ в одной картинке |
| callback_url | string | нет | URL для webhook |

---

## Kling AI — Текст → Видео

```
POST /kling/v1/videos/text2video
```

| Параметр | Тип | Обяз. | Описание |
|---|---|---|---|
| model_name | enum | нет | `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1-master`, `kling-v2-5-turbo`. v2.0 стоит в 10× дороже v1 |
| prompt | string | **да** | До 2500 символов |
| negative_prompt | string | нет | До 2500 символов |
| cfg_scale | number | нет | Сила следования промпту [0,1] |
| mode | enum | нет | `std` или `pro` (×3.5). v1-5 и v2-5-turbo: только `pro` |
| camera_control | object | нет | Тип: `simple`, `down_back`, `forward_up`, `right_turn_forward`, `left_turn_forward` |
| aspect_ratio | enum | нет | `16:9`, `9:16`, `1:1` |
| duration | enum | нет | `"5"` или `"10"` (строка!). 10 сек = цена ×2 |
| callback_url | string | нет | URL для webhook |

---

## Kling AI — Изображение → Видео

```
POST /kling/v1/videos/image2video
```

| Параметр | Тип | Обяз. | Описание |
|---|---|---|---|
| model_name | enum | нет | `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1`, `kling-v2-1-master`, `kling-v2-5-turbo` |
| image | string | **да** | Base64/URL, до 10MB, мин. 300×300px, соотношение 1:2.5~2.5:1 |
| image_tail | string | нет | Изображение для последнего кадра (только с `mode=pro`) |
| prompt | string | нет | До 2500 символов |
| cfg_scale | number | нет | [0,1] |
| mode | enum | нет | `std` или `pro` (×3.5) |
| static_mask | string | нет | Маска статичной области |
| dynamic_masks | array | нет | До 6 масок с траекториями (до 77 точек для 5с) |
| duration | enum | нет | `"5"` или `"10"` (10с = ×2) |
| camera_control | object | нет | Аналогично text2video |
| callback_url | string | нет | URL для webhook |

---

## Kling AI — Продление видео

```
POST /kling/v1/videos/video-extend
```

| Параметр | Тип | Обяз. | Описание |
|---|---|---|---|
| video_id | string | **да** | ID видео (не task_id!). Только модели v1.0, макс. цепочка 3 мин |
| prompt | string | нет | До 2500 символов |
| callback_url | string | нет | URL для webhook |

> Если оригинал в режиме `pro` — цена ×3.5.

---

## Kling AI — Lip Sync (синхронизация губ)

```
POST /kling/v1/videos/lip-sync
```

Поле `input`: `video_id` или `video_url`, `mode` (`text2video`/`audio2video`), `text`, `voice_id`, `voice_language` (`zh`/`en`), `voice_speed` [0.8,2.0], `audio_type`/`audio_file`/`audio_url`.

> 10-секундное видео = цена ×2.

---

## Kling AI — Видеоэффекты

```
POST /kling/v1/videos/effects
```

**Одиночные** (только `kling-v1-6`):
- `fuzzyfuzzy` — пушистый эффект
- `squish` — мягкое сжатие  
- `expansion` — раздувание

**Двойные** (два фото → совместное):
- `hug` — объятие, `kiss` — поцелуй, `heart_gesture` — знак сердца

`images` — массив ровно из 2 изображений (первое слева, второе справа).

---

## Подключение V-API через существующий Kling-канал

Канал **Kling** в APINET уже поддерживает V-API "из коробки":
- Если ключ начинается с `sk-` → используется как Bearer, к пути добавляется `/kling`
- **Base URL:** `https://api.gpt.ge`
- **API Key:** `sk-...` от V-API

Запросы уйдут на `https://api.gpt.ge/kling/v1/videos/...` — именно то, что нужно.

---

## Общий формат ответа

```json
{ "code": 0, "message": "SUCCEED", "request_id": "...",
  "data": { "task_id": "...", "task_status": "submitted", "created_at": 0, "updated_at": 0 } }
```

Статусы: `submitted` → `processing` → `succeed` / `failed`

---

## Важные нюансы

- `duration` — **строка** (`"5"`, `"10"`), не число
- Base64 без префикса `data:image/...`
- Ценовые множители: `pro` ×3.5, 10с ×2, v2.x ×10–20 vs v1
- Файлы удаляются через 30 дней — нужно переносить в хранилище
