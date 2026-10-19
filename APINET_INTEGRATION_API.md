# Подключение второго прокси-сервиса к APINET

Это руководство для **серверной** интеграции с установленным здесь экземпляром APINET/new-api. Второй сервис ведёт собственную регистрацию, а APINET хранит отдельного пользователя, баланс и LLM-ключ для каждого клиента. Это **общая инсталляция, не отдельный tenant**: администратор APINET видит пользователей и расходы; правила доступа, маршрутизация моделей и тарифы общие. Не используйте один общий LLM-ключ, если нужна изоляция балансов: поле `user` в LLM-теле не создаёт отдельный счёт.

Примеры ниже сверены с локальными `router/api-router.go`, `router/relay-router.go`, `middleware/auth.go`, `controller/{user,token,log,topup}.go`, `model/{user,token}.go` и `docs/openapi/{api,relay}.json`. При расхождении схемы и обработчика приоритет у обработчика **этого форка**, а не у upstream. Для дополнительных полей запросов см. [локальную management OpenAPI-схему](docs/openapi/api.json) и [relay OpenAPI-схему](docs/openapi/relay.json); [справка upstream new-api](https://docs.newapi.pro/) — только дополнительный ориентир, не гарантия поведения этой инсталляции.

## 1. Доступ и типы ключей

Базовый адрес в примерах: `https://apinet.cloud`; замените его, если развёртывание использует другой домен. В shell установите `BASE=https://apinet.cloud` и передавайте секреты через переменные окружения на сервере, не вставляя их в исходники или логи.

| Для чего | Авторизация | Дополнительные заголовки |
|---|---|---|
| Создать/найти/управлять пользователем, читать чужой баланс | `Authorization: Bearer $ADMIN_ACCESS_TOKEN` (роль admin `10` или root `100`) | **`New-Api-User: $ADMIN_ID`** — ID владельца *этого* access token, не целевого пользователя |
| Управлять своими LLM-ключами, читать свой профиль и журналы | `Authorization: Bearer $USER_ACCESS_TOKEN` (роль user `1`) | **`New-Api-User: $APINET_USER_ID`** |
| `/v1/*`, `/api/usage/token/`, `/api/log/token` | `Authorization: Bearer $LLM_KEY` | `New-Api-User` **не требуется**; это токен другого типа |
| Логин | Cookie-сессия, полученная ответом на `POST /api/user/login` | Вход без Bearer и без `New-Api-User`; для дальнейших запросов по сессии `New-Api-User` всё равно нужен |

`access_token` пользователя — для management API, **не** для `/v1/*`. Значение LLM-ключа в базе хранится без префикса; заголовок relay принимает и исходное значение, и вариант с `sk-` (ниже используется исходное значение, возвращаемое `/api/token/{id}/key`). Не считайте `sk-` частью ответа раскрытия. Не передавайте ни один из ключей браузеру или конечному клиенту второго сервиса.

Получите отдельную учётную запись admin для интеграции (root выдаёт её через интерфейс); не используйте личный root-токен без необходимости. Администратору достаточно роли `10` для работы с обычными пользователями. Войдите в UI APINET под этой учётной записью и получите свой системный access token в профиле, либо выполните вход сервером:

```sh
curl -sS -c admin.cookies -H 'Content-Type: application/json' \
  -d '{"username":"integration_admin","password":"<пароль администратора>"}' \
  "$BASE/api/user/login"
# data.id из успешного ответа -> ADMIN_ID; data.require_2fa=true означает НЕ завершённый вход
curl -sS -b admin.cookies -H "New-Api-User: $ADMIN_ID" "$BASE/api/user/token"
# data — строка нового access token -> ADMIN_ACCESS_TOKEN
```

`POST /api/user/login` при обычном успехе возвращает `{"success":true,"data":{"id":10,"username":"integration_admin","role":10,...}}` и cookie. `GET /api/user/token` **генерирует и сохраняет новый** токен, например `{"success":true,"message":"","data":"<access token>"}`; повторный вызов ротирует значение и делает старое недействительным. Храните cookie-файл вне публичного каталога, не допускайте смешивания admin- и user-сессий; после выдачи токена удалите временные cookie. Для входа с 2FA ответ имеет `data.require_2fa=true` и требует завершения через `/api/user/login/2fa` — не пытайтесь вызывать `/api/user/token` на pending-сессии. CAPTCHA (Turnstile) на login/register, отключённый парольный вход или 2FA могут сделать unattended-автоматизацию невозможной; согласуйте выделенные учётные записи и способ входа с оператором, не обходите защиту. Все приведённые дальше management-вызовы используют Bearer **и** соответствующий `New-Api-User`, включая чтение.

## 2. Provisioning пользователя

Второй сервис должен создать собственные случайные учётные данные APINET для каждого клиента: не копируйте пароль клиента второго сервиса. `username` уникален и не длиннее 20 символов, пароль — 8–20 символов, `display_name` — не длиннее 20. Продумайте устойчивое сопоставление локального ID с коротким username и префиксом, чтобы не допускать коллизий. Не создавайте клиента с ролью администратора.

**Создать:** `POST /api/user/`, admin Bearer + `New-Api-User: $ADMIN_ID`, JSON. Ответ при успехе — `{"success":true,"message":""}` **без ID**.

```sh
curl -sS -X POST "$BASE/api/user/" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "New-Api-User: $ADMIN_ID" \
  -H 'Content-Type: application/json' \
  -d '{"username":"ext_abc123","password":"<случайный пароль 8–20 символов>","display_name":"Клиент 123","role":1}'
```

Анонимный `POST /api/user/register` — отдельный путь с настройками регистрации/проверки email/CAPTCHA, не заменяет административное создание.

**Найти ID:** `GET /api/user/search?keyword=ext_abc123&p=1&page_size=50`, admin Bearer + `New-Api-User: $ADMIN_ID`, без тела. Поиск частичный (`username`, email, display_name, иногда ID), ответ постраничный:

```sh
curl -sS -G "$BASE/api/user/search" --data-urlencode 'keyword=ext_abc123' \
  --data-urlencode 'p=1' --data-urlencode 'page_size=50' \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "New-Api-User: $ADMIN_ID"
```

```json
{"success":true,"message":"","data":{"page":1,"page_size":50,"total":1,"items":[{"id":42,"username":"ext_abc123","role":1,"status":1,"quota":0,"used_quota":0}]}}
```

**Обязательно** сравните `data.items[].username` с исходным username на точное совпадение, просматривая следующие страницы `p`, если нужно. Не берите `items[0]` без проверки; при нуле или нескольких точных совпадениях остановите provisioning. Поле `page_size` ограничено 100; параметр страницы — `p`, не `page`.

**Прочитать/сверить:** `GET /api/user/42`, admin Bearer + `New-Api-User: $ADMIN_ID`, без тела:

```sh
curl -sS "$BASE/api/user/$APINET_USER_ID" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "New-Api-User: $ADMIN_ID"
```

Ответ: `{"success":true,"message":"","data":{"id":42,"username":"ext_abc123","status":1,"quota":500000,"used_quota":0,"group":"default",...}}`. `quota` — текущий остаток, `used_quota` — накопленный расход. Admin может читать только пользователей с ролью ниже своей (root — также других). Список для сверки: `GET /api/user/?p=1&page_size=50` с теми же заголовками; ответ `data.items`, `data.total`.

**Получить пользовательскую сессию:** войдите под *созданным* пользователем (без admin Bearer):

```sh
curl -sS -c user.cookies -H 'Content-Type: application/json' \
  -d '{"username":"ext_abc123","password":"<пароль APINET этого пользователя>"}' \
  "$BASE/api/user/login"
# только после обычного success:true и data.id == APINET_USER_ID:
curl -sS -b user.cookies -H "New-Api-User: $APINET_USER_ID" "$BASE/api/user/token"
# data — строка -> USER_ACCESS_TOKEN; доступна также через профиль владельца
```

После получения access token пользовательский пароль и cookie не нужны для повседневных запросов; решите, как безопасно хранить/восстанавливать их для будущей ротации. `GET /api/user/token` при **каждом** вызове ротирует только access token этого пользователя; при ротации одновременно обновите секрет второго сервиса. Смена access token не равна отзыву LLM-ключа.

## 3. Ключи и запросы к моделям

Все вызовы `/api/token/*` выполняются от **владельца ключа**, user Bearer + `New-Api-User: $APINET_USER_ID`; для POST/PUT добавьте `Content-Type: application/json`. Администратор не может создать ключ от имени клиента простым указанием его ID в теле.

**Создать:** `POST /api/token/`. `unlimited_quota:true` убирает лимит *ключа*, но не лимит баланса владельца; `expired_time:-1` — без срока, `model_limits_enabled:false` — без ограничения списка моделей ключом.

```sh
curl -sS -X POST "$BASE/api/token/" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"external-proxy-main","expired_time":-1,"remain_quota":0,"unlimited_quota":true,"model_limits_enabled":false}'
```

Ответ: `{"success":true,"message":""}` — **нет** ни `id`, ни полного `key`. После успеха найдите созданный ключ по уникальному для пользователя имени (лучше заранее записать имя в состоянии операции). `GET /api/token/search?keyword=external-proxy-main&p=1&page_size=50` использует точное совпадение имени без `%` (сверяйте `name` в `data.items`); либо используйте `GET /api/token/?p=1&page_size=50`. Обе операции возвращают `{"success":true,"message":"","data":{"page":1,"page_size":50,"total":1,"items":[{"id":101,"name":"external-proxy-main","key":"xxxx**********yyyy","status":1,...}]}}`. `key` здесь **маскирован**.

```sh
curl -sS -G "$BASE/api/token/search" --data-urlencode 'keyword=external-proxy-main' \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID"
curl -sS "$BASE/api/token/$TOKEN_ID" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID"
# GET /api/token/{id} тоже показывает только маску
curl -sS -X POST "$BASE/api/token/$TOKEN_ID/key" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID"
```

Раскрытие — `POST /api/token/{id}/key` **без тела**, ответ `{"success":true,"message":"","data":{"key":"<полное значение>"}}`. Сохраните `TOKEN_ID` и полный `data.key` как секреты на сервере, не выводите ответ раскрытия в логи/браузер. Если нужен формат `sk-...` для OpenAI-клиента, добавляйте префикс при передаче, не сохраняйте/добавляйте его дважды.

**Изменить:** `PUT /api/token/` c теми же user-заголовками и JSON, включая `id` и *все* изменяемые значения (это не частичный PATCH; пропущенные поля сбрасываются). Ответ `data` с **маскированным** `key`.

```sh
curl -sS -X PUT "$BASE/api/token/" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"id":101,"name":"external-proxy-main","expired_time":-1,"remain_quota":0,"unlimited_quota":true,"model_limits_enabled":false,"model_limits":"","group":""}'
```

**Отключить без удаления:** `PUT /api/token/?status_only=1` с телом `{"id":101,"status":2}` и теми же заголовками; `status:1` вновь включает пригодный ключ, если он не истёк/не исчерпан. **Отозвать окончательно:** `DELETE /api/token/{id}` от владельца, без тела; ответ `{"success":true,"message":""}`. Для ротации создайте новый ключ, переключите второй сервис, затем отзовите старый. Не путайте это с ротацией management access token.

**Доступные модели:** `GET /v1/models`, LLM Bearer, без тела и без `New-Api-User`:

```sh
curl -sS "$BASE/v1/models" -H "Authorization: Bearer $LLM_KEY"
```

Ответ `{"success":true,"data":[{"id":"<доступная модель>","object":"model",...}],"object":"list"}`; доступность зависит от группы, ограничений ключа, каналов и настроек тарифа. Для UI пользователя `GET /api/user/models` возвращает `data` как список имён, но требует user access token + `New-Api-User`. `GET /api/models` — список dashboard-каналов, **не** список моделей relay; для каталога цен/групп есть `GET /api/pricing` (публичен только при включённом модуле pricing), ответ содержит `data` (тарифы), `group_ratio`, `usable_group`. Не рассчитывайте стоимость только по количеству токенов: цены и коэффициенты меняются.

**LLM-вызов:** `POST /v1/chat/completions`, LLM Bearer + JSON, без `New-Api-User`.

```sh
curl -sS "$BASE/v1/chat/completions" \
  -H "Authorization: Bearer $LLM_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"<id из /v1/models>","messages":[{"role":"user","content":"Привет!"}],"stream":false}'
```

Ответ в обычном режиме содержит `id`, `choices` и `usage` (формат OpenAI); для `stream:true` — SSE-поток, не один JSON. Также доступны `POST /v1/responses` (`{"model":"<id>","input":"Привет!"}` → `id`, `output`, `usage`), `POST /v1/embeddings` (`{"model":"<id embeddings>","input":"текст"}` → `data[].embedding`, `usage`), `POST /v1/completions`, `/v1/images/generations` (JSON), `/v1/audio/transcriptions` (multipart). Маршруты есть в relay-router; поддержка конкретного формата/модели зависит от подключённых каналов. Для справки о телах разных режимов смотрите [локальную relay-схему](docs/openapi/relay.json). Не утверждайте, что все модели поддерживают все маршруты.

## 4. Баланс, расход и журналы

В этом форке `QuotaPerUnit = 500000` credits на единицу USD в квоте; например 500000 credits соответствует базовым $1 **в пересчёте квоты**, не гарантированной цене вызова или цене пополнения. Тарифы групп, тип отображения (USD/CNY/tokens), скидки и провайдер оплаты могут менять цену платежа. При одном LLM-ключе на пользователя расход списывается с `user.quota`; при нескольких ключах того же пользователя баланс общий. `unlimited_quota` ключа не даёт бесконечного пользовательского баланса.

**Читать остаток:** `GET /api/user/{id}`, admin Bearer + `New-Api-User: $ADMIN_ID` (см. выше), или `GET /api/user/self`, user Bearer + `New-Api-User: $APINET_USER_ID`, без тела:

```sh
curl -sS "$BASE/api/user/self" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID"
```

Ответ self: `{"success":true,"data":{"id":42,"quota":500000,"used_quota":0,"request_count":0,...}}`. Следите за `quota` как за остатком; `used_quota` — накопленный расход, не отдельный кошелёк.

**Начислить/списать:** `POST /api/user/manage`, admin Bearer + `New-Api-User: $ADMIN_ID`, JSON. `value` — положительное **целое число credits**; `mode` — `add`, `subtract` либо `override` (установка абсолютного остатка).

```sh
curl -sS -X POST "$BASE/api/user/manage" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "New-Api-User: $ADMIN_ID" \
  -H 'Content-Type: application/json' \
  -d '{"id":42,"action":"add_quota","mode":"add","value":500000}'
# Чтобы списать: то же тело, но "mode":"subtract"; чтобы задать остаток: "mode":"override"
```

Ответ при успехе: `{"success":true,"message":""}`. Затем заново прочитайте пользователя и сверяйте остаток. `subtract` не следует считать атомарным «списанием не больше остатка» для вашего платёжного учёта; не используйте `override` при одновременных LLM-запросах без согласования. Внешние начисления/списания **не имеют idempotency key** в этом маршруте: запишите уникальный ID операции платежа и её состояние в собственной БД, сериализуйте операции для одного пользователя, при таймауте/неясном результате сверяйте APINET и свою книгу операций, не повторяйте `add` вслепую. Отрицательный `quota` возможен при неконтролируемом `subtract`; проверяйте остаток и бизнес-правила у себя.

**Проверить расход:** `GET /api/log/self/stat?type=2&start_timestamp=...&end_timestamp=...`, user Bearer + `New-Api-User: $APINET_USER_ID`, без тела; `type=2` — расход LLM, timestamps в секундах Unix. Ответ `{"success":true,"message":"","data":{"quota":1234,"rpm":0,"tpm":0}}`. Для администратора `GET /api/log/stat?type=2&username=ext_abc123&start_timestamp=...&end_timestamp=...` с admin Bearer + `New-Api-User: $ADMIN_ID` возвращает такую же форму; проверяйте фильтр `username`.

**Журнал:** `GET /api/log/self?p=1&page_size=50&type=2&start_timestamp=...&end_timestamp=...` с user-заголовками или `GET /api/log/?p=1&page_size=50&username=ext_abc123&type=2` с admin-заголовками, без тела. Ответ `{"success":true,"message":"","data":{"page":1,"page_size":50,"total":1,"items":[{"user_id":42,"created_at":0,"type":2,"model_name":"<модель>","quota":1234,"token_id":101,"request_id":"<id>",...}]}}`. `created_at` в реальном ответе — Unix-время, `request_id` может отсутствовать. Для ключа без management token: `GET /api/log/token` с LLM Bearer возвращает `data` как массив логов (не страницу), а `GET /api/usage/token/` с LLM Bearer возвращает **другой** формат: `{"code":true,"message":"ok","data":{"total_granted":1234,"total_used":1234,"total_available":0,"unlimited_quota":true,"expires_at":0,...}}`; эти данные относятся к ключу, не ко всему пользователю.

```sh
# Укажите START и END как секунды Unix (например, границы расчётного периода).
curl -sS -G "$BASE/api/log/self/stat" \
  --data-urlencode 'type=2' --data-urlencode "start_timestamp=$START" --data-urlencode "end_timestamp=$END" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID"
curl -sS -G "$BASE/api/log/self" \
  --data-urlencode 'p=1' --data-urlencode 'page_size=50' --data-urlencode 'type=2' \
  --data-urlencode "start_timestamp=$START" --data-urlencode "end_timestamp=$END" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "New-Api-User: $APINET_USER_ID"
curl -sS -G "$BASE/api/log/" --data-urlencode 'p=1' --data-urlencode 'type=2' \
  --data-urlencode 'username=ext_abc123' \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "New-Api-User: $ADMIN_ID"
curl -sS "$BASE/api/log/token" -H "Authorization: Bearer $LLM_KEY"
curl -sS "$BASE/api/usage/token/" -H "Authorization: Bearer $LLM_KEY"
```

**Блокировка:** `POST /api/user/manage`, admin Bearer + `New-Api-User: $ADMIN_ID`, JSON `{"id":42,"action":"disable"}`; для возврата — `{"id":42,"action":"enable"}`. Ответ содержит `success:true`, `data.status` (`2` — отключён, `1` — включён). Перед отключением/удалением проверьте своё право управлять ролью пользователя. Удаление через `action:"delete"` или `DELETE /api/user/{id}` — разрушительное действие, для штатной паузы используйте `disable`.

```sh
curl -sS -X POST "$BASE/api/user/manage" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "New-Api-User: $ADMIN_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$APINET_USER_ID,\"action\":\"disable\"}"
```

## 5. Границы надёжности и оплаты

1. **Регистрируйте состояние provisioning у себя:** локальный ID ↔ точный APINET username ↔ `apinet_user_id` ↔ `token_id` ↔ секрет ключа. Если создание ответило успехом, но поиск/логин/раскрытие не завершились, повторно ищите *точный* username и ключ по уникальному имени; не создавайте второго пользователя или ключ вслепую. Создание аккаунта, ключа и начисление не образуют единой транзакции.
2. **Разделяйте секреты и права:** admin token имеет доступ к чужим балансам; user access token — только к своим ключам, LLM-ключ — только к relay и ограниченным read-only маршрутам. Храните секреты зашифрованными на сервере, ограничьте доступ сервисной роли, не помещайте в URL, клиентский JS, аналитику или логи; при компрометации ротируйте соответствующий тип ключа.
3. **Оплата:** инициирующие маршруты (`/api/user/pay`, `/api/user/stripe/pay` и другие) создают платежи, не удостоверяют успешное зачисление. Платёжные callback-маршруты обрабатывает APINET; второй сервис не должен подделывать callback или считать редирект браузера подтверждением. При собственном эквайринге вызывайте admin `add_quota` **только после достоверного подтверждения оплаты** и защиты от дубликатов, ведите reconciliation заказов и остатков. Встроенные пополнения можно читать через `GET /api/user/topup/self?p=1` с user-заголовками (`data.items`, `data.total`), но они не заменяют ваш реестр внешних заказов. Оператор настраивает шлюзы и compliance отдельно.
4. **Ошибки и повторы:** management API часто отвечает HTTP 200 с `{"success":false,"message":"..."}`; проверяйте и HTTP-код, и `success`, и форму `data`. Нет сессии/`New-Api-User`/несовпадение ID → обычно 401; невалидный access token/недостаточная роль → возможен 200 с `success:false`; relay использует OpenAI-форму `{"error":{...}}` и HTTP 401/403/429/5xx. Rate limit может вернуть 429. Повторяйте лишь безопасные чтения с backoff; после неопределённого исхода мутации сначала сверяйте состояние. Relay POST может выполнить запрос и списать квоту до потери ответа: повтор может вызвать **второе** списание.
5. **UI:** оператору доступны [профиль](/profile), [ключи](/keys), [баланс](/wallet), [журнал](/usage-logs) и [цены](/pricing). Эти разделы предназначены для проверки настройки и ручной диагностики, не для хранения секретов интеграции.