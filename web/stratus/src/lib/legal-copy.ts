export type LegalPageKind = 'privacy' | 'offer' | 'refund' | 'contacts';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalPageCopy = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export const legalCopy = {
  ru: {
    eyebrow: 'ИНФОРМАЦИЯ STRATUS',
    back: 'На главную',
    support: 'Поддержка Stratus',
    telegram: 'Написать в Telegram',
    loading: 'Загружаем опубликованный документ…',
    officialTextHeading: 'Документ сервера',
    pages: {
      privacy: {
        title: 'Политика конфиденциальности',
        intro: 'Как Stratus использует данные аккаунта, запросов, кошелька и платежей для работы сервиса.',
        sections: [
          {
            title: 'Какие данные обрабатываются',
            paragraphs: [
              'При регистрации и использовании кабинета обрабатываются идентификатор аккаунта, имя пользователя, адрес электронной почты и другие сведения, которые пользователь указывает сам.',
              'Для работы AI Gateway и учёта использования сервис обрабатывает технические данные запросов: выбранную модель, дату и время, статус, количество входных и выходных токенов и внутренний расход кошелька. Содержание запроса может передаваться выбранному поставщику модели для генерации ответа.',
              'Для расчётов и поддержки обрабатываются сведения о пополнениях и платежах: сумма, валюта, статус операции, идентификатор заказа, начисленные балансовые токены и связанные бонусы или реферальные начисления.',
              'Сервис также может обрабатывать технические журналы, необходимые для входа, защиты аккаунта, диагностики ошибок и предотвращения злоупотреблений.',
            ],
          },
          {
            title: 'Для чего используются данные',
            paragraphs: [
              'Данные нужны для создания и защиты аккаунта, предоставления доступа к моделям, маршрутизации запросов, расчёта расходов, ведения баланса, обработки платежей, поддержки пользователей и выполнения требований применимого законодательства.',
              'Информация об использовании может применяться для диагностики, обеспечения стабильности и предотвращения мошенничества или обхода ограничений.',
            ],
          },
          {
            title: 'Поставщики моделей и платёжные сервисы',
            paragraphs: [
              'Запросы, отправленные через AI Gateway, передаются выбранному поставщику модели. Обработка таких запросов этим поставщиком регулируется его собственными условиями и политикой конфиденциальности.',
              'При оплате необходимые сведения о заказе передаются выбранному платёжному провайдеру. Платёжные данные, которые вводятся непосредственно на странице провайдера, обрабатываются по его правилам.',
              'Данные могут обрабатываться инфраструктурными поставщиками, которые обеспечивают работу Stratus, в объёме, необходимом для оказания сервиса.',
            ],
          },
          {
            title: 'Хранение и обращения',
            paragraphs: [
              'Данные хранятся столько, сколько необходимо для работы аккаунта, учёта платежей, безопасности и разрешения обращений, либо дольше, если этого требует закон.',
              'По вопросам доступа, исправления или удаления данных напишите в поддержку Stratus. Запрос может быть ограничен обязанностью сохранить сведения для расчётов, безопасности или выполнения закона.',
              'Не отправляйте в запросах пароли, API-ключи и полные данные банковской карты.',
            ],
          },
          {
            title: 'Защита данных',
            paragraphs: [
              'Stratus применяет разумные технические и организационные меры для защиты информации. Ни один способ передачи или хранения данных не может гарантировать абсолютную безопасность.',
              'Пользователь отвечает за сохранность пароля и API-ключей и должен незамедлительно сообщить поддержке о подозрении на несанкционированный доступ.',
            ],
          },
        ],
      },
      offer: {
        title: 'Публичная оферта',
        intro: 'Условия доступа к Stratus, использования AI Gateway, балансовых токенов и поддержки.',
        sections: [
          {
            title: 'Предмет и принятие условий',
            paragraphs: [
              'Stratus предоставляет доступ к личному кабинету и инструментам маршрутизации запросов к подключённым поставщикам AI-моделей. Регистрация, вход или использование оплаченных функций означает согласие пользователя с этими условиями.',
              'Если пользователь не согласен с условиями, он должен прекратить использование сервиса.',
            ],
          },
          {
            title: 'Аккаунт и API-ключи',
            paragraphs: [
              'Пользователь отвечает за достоверность предоставленных при регистрации сведений и за сохранность учётных данных и API-ключей. Ключи нельзя публиковать, передавать посторонним или включать в открытый код.',
              'О подозрении на компрометацию аккаунта или ключа необходимо сообщить поддержке и отозвать затронутый ключ.',
            ],
          },
          {
            title: 'Баланс, цены и оплата',
            paragraphs: [
              'Балансовые токены — внутренняя единица учёта оплаты услуг Stratus; это не токены языковой модели и не отдельная денежная валюта. Фактический расход зависит от модели, тарифа и параметров запроса и показывается в кабинете.',
              'Перед оплатой пользователь видит сумму, применимые бонусы и расчёт начисления. Пополнение зачисляется после подтверждения платёжного провайдера. Условия конкретного метода оплаты могут дополнительно определяться самим провайдером.',
              'Пользователь может получать реферальное вознаграждение в размере 5% от пополнений непосредственно приглашённых им пользователей. Вознаграждение начисляется в балансовых токенах и доступно для использования в сервисе; оно не является денежной выплатой.',
            ],
          },
          {
            title: 'AI Gateway и сторонние поставщики',
            paragraphs: [
              'Доступность моделей, маршрутов, скорости и результатов зависит от конфигурации Stratus и работы сторонних поставщиков. Stratus может менять доступные маршруты и модели, чтобы поддерживать работу сервиса.',
              'Пользователь сам выбирает, какие данные отправлять в запросе. Не передавайте через AI Gateway сведения, которые вы не вправе раскрывать выбранному поставщику модели.',
            ],
          },
          {
            title: 'Допустимое использование',
            paragraphs: [
              'Сервисом следует пользоваться законно и с соблюдением условий поставщиков моделей. Запрещены попытки обходить защитные механизмы моделей или сервиса, использовать jailbreak и prompt injection для обхода ограничений, а также действия, создающие угрозу сервису или другим пользователям.',
              'При подтверждённом злоупотреблении Stratus вправе ограничить доступ или отозвать API-ключи. Условия возврата при таких случаях и права, предусмотренные законом, описаны в Политике возврата.',
            ],
          },
          {
            title: 'Возвраты и обновления условий',
            paragraphs: [
              'Возвраты рассматриваются по Политике возврата. Добровольная гарантия по причине «передумал» или «сервис не подошёл» действует, если использовано не более 35% токенов, начисленных по соответствующему пополнению, с учётом сроков подачи заявки. Она применяется к пополнениям после публикации этой редакции и не ограничивает обязательные права пользователя по закону.',
              'Stratus может обновлять условия. Новая редакция применяется после публикации; изменения, которые затрагивают уже совершённые платежи, не применяются задним числом, если иное не требуется законом.',
            ],
          },
          {
            title: 'Связь с поддержкой',
            paragraphs: [
              'По вопросам аккаунта, использования, платежей или условий напишите в Telegram поддержки @wpnetwork_sup. Не отправляйте пароль, API-ключ или полные данные карты.',
            ],
          },
        ],
      },
      refund: {
        title: 'Возврат средств',
        intro: 'Порядок подачи и рассмотрения заявок на возврат платежей Stratus.',
        sections: [
          {
            title: 'Добровольный возврат',
            paragraphs: [
              'Если пользователь передумал или сервис ему не подошёл, он может запросить добровольный возврат, когда использовано не более 35% токенов, начисленных по соответствующему пополнению.',
              'Для добровольного возврата обратитесь в поддержку не позднее 24 часов с момента оплаты. После превышения порога 35% добровольная гарантия прекращается.',
              'Правило 35% применяется к новым пополнениям, оплаченным после публикации этой редакции, и не применяется задним числом к более ранним пополнениям.',
            ],
          },
          {
            title: 'Проблема с предоставлением доступа',
            paragraphs: [
              'Кроме добровольной гарантии, заявка может быть рассмотрена, если из-за технической ошибки Stratus оплаченный доступ или начисление не предоставлены в течение 48 часов либо оплаченная функция неисправна по вине сервиса.',
              'Если доступ не предоставлен в установленный 48-часовой срок, обратитесь в поддержку в течение следующих 72 часов. Укажите дату и сумму платежа, способ оплаты и описание проблемы.',
            ],
          },
          {
            title: 'Рассмотрение и перечисление средств',
            paragraphs: [
              'Поддержка проверяет сведения о платеже и использовании баланса. Решение принимается индивидуально; рассмотрение заявки и обработка одобренного возврата выполняются в течение 72 часов после обращения.',
              'Одобренный возврат направляется тем же способом, которым была произведена оплата, если это поддерживается платёжным провайдером. Фактический срок зачисления может зависеть от банка или платёжной системы.',
              'Эти условия не ограничивают права пользователя, которые нельзя ограничить по применимому законодательству, в том числе требования в связи с недостатками услуги.',
            ],
          },
          {
            title: 'Нарушения правил сервиса',
            paragraphs: [
              'При подтверждённом использовании jailbreak, обходе защит или другом злоупотреблении, запрещённом Офертой, Stratus может заблокировать аккаунт и API-ключи и отказать в добровольном возврате оплаты и неиспользованного баланса в той мере, в какой это допускается законом.',
              'Блокировка не отменяет возвраты, обязательные по закону.',
            ],
          },
          {
            title: 'Как обратиться',
            paragraphs: [
              'Напишите @wpnetwork_sup, укажите логин аккаунта, дату и сумму оплаты, способ оплаты и суть проблемы. При необходимости поддержка запросит подтверждение операции.',
              'Не отправляйте пароль, API-ключи, коды входа или полные данные банковской карты.',
            ],
          },
        ],
      },
      contacts: {
        title: 'Контакты',
        intro: 'Единственный указанный публичный канал поддержки Stratus — Telegram.',
        sections: [
          {
            title: 'Поддержка',
            paragraphs: [
              'В Telegram @wpnetwork_sup можно обратиться по вопросам регистрации и входа, API-ключей, маршрутизации, пополнений, начисления баланса, реферальных вознаграждений и возвратов.',
              'Чтобы ускорить проверку, укажите логин аккаунта, дату и сумму платежа, способ оплаты и короткое описание проблемы. Скриншоты прикладывайте только если на них нет секретных данных.',
              'Не отправляйте пароли, API-ключи, коды подтверждения или полные данные банковской карты.',
            ],
          },
        ],
      },
    } satisfies Record<LegalPageKind, LegalPageCopy>,
  },
  en: {
    eyebrow: 'STRATUS INFORMATION',
    back: 'Back to home',
    support: 'Stratus support',
    telegram: 'Message us on Telegram',
    loading: 'Loading the published document…',
    officialTextHeading: 'Server-published document',
    pages: {
      privacy: {
        title: 'Privacy policy',
        intro: 'How Stratus uses account, request, wallet, and payment data to operate the service.',
        sections: [
          {
            title: 'Data we process',
            paragraphs: [
              'When you register and use the workspace, we process your account identifier, username, email address, and other information you provide.',
              'To operate the AI Gateway and record usage, Stratus processes request metadata such as the selected model, timestamp, status, input and output token counts, and wallet spend. Request content may be sent to the selected model provider to generate a response.',
              'For billing and support, we process top-up and payment details such as amount, currency, transaction status, order identifier, credited wallet tokens, and related bonuses or referral rewards.',
              'We may also process technical logs needed for sign-in, account security, troubleshooting, and abuse prevention.',
            ],
          },
          {
            title: 'How we use data',
            paragraphs: [
              'Data is used to create and protect accounts, provide model access, route requests, calculate usage, maintain wallet balances, process payments, support users, and meet applicable legal requirements.',
              'Usage information may also be used to diagnose issues, maintain service reliability, and prevent fraud or attempts to bypass restrictions.',
            ],
          },
          {
            title: 'Model providers and payment services',
            paragraphs: [
              'Requests sent through the AI Gateway are forwarded to the selected model provider. That provider processes the request under its own terms and privacy policy.',
              'When you pay, the required order information is shared with the payment provider you select. Payment details entered directly on the provider’s checkout page are handled under its rules.',
              'Service infrastructure providers may process data to the extent required to operate Stratus.',
            ],
          },
          {
            title: 'Retention and requests',
            paragraphs: [
              'Data is retained as needed to operate accounts, account for payments, protect the service, and resolve support requests, or longer when required by law.',
              'To request access to, correction of, or deletion of data, contact Stratus support. A request may be limited where information must be retained for billing, security, or legal reasons.',
              'Do not include passwords, API keys, or full bank card details in support messages.',
            ],
          },
          {
            title: 'Data security',
            paragraphs: [
              'Stratus uses reasonable technical and organizational measures to protect information. No method of transmission or storage can guarantee absolute security.',
              'You are responsible for protecting your password and API keys. Contact support promptly if you suspect unauthorized access.',
            ],
          },
        ],
      },
      offer: {
        title: 'Public offer',
        intro: 'Terms for accessing Stratus, using the AI Gateway, wallet tokens, and support.',
        sections: [
          {
            title: 'Scope and acceptance',
            paragraphs: [
              'Stratus provides access to a workspace and tools for routing requests to connected AI model providers. Registering, signing in, or using paid features means you accept these terms.',
              'If you do not agree, stop using the service.',
            ],
          },
          {
            title: 'Accounts and API keys',
            paragraphs: [
              'You are responsible for the accuracy of information you provide and for protecting your account credentials and API keys. Do not publish keys, share them with unauthorized people, or include them in public code.',
              'If you suspect an account or key has been compromised, contact support and revoke the affected key.',
            ],
          },
          {
            title: 'Wallet, prices, and payments',
            paragraphs: [
              'Wallet tokens are an internal unit for accounting for Stratus services; they are not model tokens or a separate currency. Actual usage depends on the model, tariff, and request parameters and is shown in the workspace.',
              'Before paying, you can review the amount, applicable bonuses, and expected credit. A top-up is credited after confirmation by the payment provider. The provider may also apply its own terms to the selected payment method.',
              'You may receive a referral reward equal to 5% of top-ups made by users you directly invite. Rewards are credited as wallet tokens for use in the service; they are not cash payments.',
            ],
          },
          {
            title: 'AI Gateway and third-party providers',
            paragraphs: [
              'Model and route availability, response speed, and results depend on Stratus configuration and third-party providers. Stratus may change available routes and models to keep the service operating.',
              'You choose what information to include in a request. Do not send information to a model provider if you are not authorized to share it.',
            ],
          },
          {
            title: 'Acceptable use',
            paragraphs: [
              'Use the service lawfully and follow model-provider terms. Attempts to bypass model or service safeguards, including jailbreak or prompt-injection attempts to evade restrictions, and actions that threaten the service or other users are prohibited.',
              'If abuse is confirmed, Stratus may restrict access or revoke API keys. Refund terms for these cases, and rights that cannot be waived by law, are described in the Refund Policy.',
            ],
          },
          {
            title: 'Refunds and changes',
            paragraphs: [
              'Refund requests are handled under the Refund Policy. A voluntary refund because you changed your mind or found the service unsuitable is available when no more than 35% of tokens credited for the relevant top-up have been used, subject to the request deadlines. It applies to top-ups made after this version is published and does not limit rights granted by law.',
              'Stratus may update these terms. A new version applies after publication; changes affecting completed payments are not applied retroactively unless required by law.',
            ],
          },
          {
            title: 'Contact',
            paragraphs: [
              'For account, service, payment, or terms questions, contact Stratus support at @wpnetwork_sup on Telegram. Do not send passwords, API keys, or full bank card details.',
            ],
          },
        ],
      },
      refund: {
        title: 'Refund policy',
        intro: 'How to request and how Stratus reviews payment refund requests.',
        sections: [
          {
            title: 'Voluntary refunds',
            paragraphs: [
              'If you changed your mind or found the service unsuitable, you may request a voluntary refund if no more than 35% of the tokens credited for the relevant top-up have been used.',
              'For a voluntary refund, contact support within 24 hours of payment. The voluntary guarantee ends once usage exceeds the 35% threshold.',
              'The 35% rule applies to new top-ups paid after this version is published and is not applied retroactively to earlier top-ups.',
            ],
          },
          {
            title: 'Access or service problems',
            paragraphs: [
              'Apart from the voluntary guarantee, a request may be reviewed if a technical issue caused paid access or wallet credit not to be provided within 48 hours, or if a paid feature is defective due to Stratus.',
              'If access has not been provided within the 48-hour period, contact support within the following 72 hours. Include the payment date and amount, payment method, and a description of the issue.',
            ],
          },
          {
            title: 'Review and payment',
            paragraphs: [
              'Support verifies the payment and usage information. Requests are reviewed individually; review and processing of an approved refund take place within 72 hours of the support request.',
              'An approved refund is returned using the original payment method where supported by the payment provider. The time it takes to appear may depend on the bank or payment system.',
              'These terms do not restrict rights that cannot be limited under applicable law, including claims relating to defects in the service.',
            ],
          },
          {
            title: 'Violations of service rules',
            paragraphs: [
              'If jailbreak, safeguard circumvention, or other abuse prohibited by the Public Offer is confirmed, Stratus may block the account and API keys and refuse a voluntary refund of the payment and unused balance to the extent permitted by law.',
              'Blocking does not remove any refund required by law.',
            ],
          },
          {
            title: 'How to contact support',
            paragraphs: [
              'Message @wpnetwork_sup and include your account username, payment date and amount, payment method, and a description of the issue. Support may request proof of the transaction when needed.',
              'Do not send passwords, API keys, sign-in codes, or full bank card details.',
            ],
          },
        ],
      },
      contacts: {
        title: 'Contacts',
        intro: 'The only public Stratus support channel listed here is Telegram.',
        sections: [
          {
            title: 'Support',
            paragraphs: [
              'Contact @wpnetwork_sup on Telegram about registration and sign-in, API keys, routing, top-ups, wallet credits, referral rewards, or refunds.',
              'To help support review an issue, include your account username, payment date and amount, payment method, and a short description. Attach screenshots only if they contain no secret information.',
              'Do not send passwords, API keys, sign-in codes, or full bank card details.',
            ],
          },
        ],
      },
    } satisfies Record<LegalPageKind, LegalPageCopy>,
  },
} as const;
