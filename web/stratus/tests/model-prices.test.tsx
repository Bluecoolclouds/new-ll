import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModelPrices } from '../src/components/ModelPrices';
import type { PricingModel, PricingResponse } from '../src/lib/api';

const model = (overrides: Partial<PricingModel> = {}): PricingModel => ({
  model_name: 'future-model', owner_by: 'test', quota_type: 0, model_ratio: 0.5,
  model_price: 0, completion_ratio: 1, enable_groups: ['default'], ...overrides,
});

function render(models: PricingModel[], currentGroup = 'default', quotaPerUnit = 500_000) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const pricing: PricingResponse = {
    success: true, data: models, vendors: [],
    group_ratio: { default: 1, vip: 2 }, usable_group: { default: 'Default', vip: 'VIP' },
  };
  client.setQueryData(['stratus', 'pricing'], pricing);
  client.setQueryData(['stratus', 'status'], { quota_per_unit: quotaPerUnit });
  try {
    return renderToStaticMarkup(<QueryClientProvider client={client}><ModelPrices currentGroup={currentGroup}/></QueryClientProvider>);
  } finally {
    client.clear();
  }
}

describe('Model tariff presentation', () => {
  test('new models display calculated coefficients, not input/output dollar prices', () => {
    const html = render([model()]);
    expect(html).toContain('future-model');
    expect(html).toContain('×7,6923077');
    expect(html).toContain('Кэш-вход');
    expect(html).toContain('Обновить тарифы');
    expect(html).not.toContain('Ввод / вызов');
    expect(html).not.toContain('Вывод</th>');
    expect(html).not.toContain('$');
  });

  test('changed tariffs and newly added models need no per-model Stratus settings', () => {
    const html = render([model({ model_ratio: 1 }), model({ model_name: 'newly-added-model', model_ratio: 0 })]);
    expect(html).toContain('×15,384615');
    expect(html).toContain('newly-added-model');
    expect(html).toContain('×0</span>');
  });

  test('uses the current user group without showing a group selector', () => {
    const html = render([model({ enable_groups: ['vip'] })], 'vip');
    expect(html).toContain('×15,384615');
    expect(html).not.toContain('Группа расчёта');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('default');
    expect(html).not.toContain('VIP');
  });

  test('unequal input/output tariffs retain their calculated range without an extra condition label', () => {
    const html = render([model({ completion_ratio: 4 })]);
    expect(html).toContain('×7,6923077–×30,769231');
    expect(html).not.toContain('По токенам');
    expect(html).not.toContain('Условия');
  });

  test('dynamic tariffs keep a compact label without exposing raw conditions', () => {
    const html = render([model({ billing_mode: 'tiered_expr', billing_expr: '<unsafe-expression>' })]);
    expect(html).toContain('Динамический тариф');
    expect(html).not.toContain('Условия');
    expect(html).not.toContain('<unsafe-expression>');
    expect(html).not.toContain('&lt;unsafe-expression&gt;');
  });

  test('fixed calls use wallet tokens rather than a fabricated multiplier', () => {
    const html = render([model({ quota_type: 1, model_price: 0.01 })]);
    expect(html).toContain('токенов / вызов');
    expect(html).not.toContain('По токенам');
    expect(html).not.toContain('Условия');
  });

  test('missing or invalid conversion data never generates a plausible price', () => {
    expect(render([model()], 'default', 0)).toContain('Не рассчитан');
    expect(render([model({ model_ratio: NaN })])).toContain('Не рассчитан');
  });

  test('unavailable groups do not show a payable coefficient', () => {
    const html = render([model({ enable_groups: ['vip'] })]);
    expect(html).toContain('Недоступна');
    expect(html).not.toContain('×7,6923077');
    expect(html).toContain('Не подключена к вашей группе доступа');
  });

  test('models are grouped by server provider, with unknown providers left unnamed', () => {
    const html = render([
      model({ model_name: 'open-model', owner_by: 'OpenAI' }),
      model({ model_name: 'unknown-model', owner_by: '' }),
      model({ model_name: 'anthropic-model', owner_by: 'Anthropic' }),
    ]);
    expect(html).toContain('aria-label="Провайдер OpenAI"');
    expect(html).toContain('aria-label="Провайдер Anthropic"');
    expect(html).toContain('aria-label="Провайдер —"');
    expect(html).toContain('open-model');
    expect(html).toContain('unknown-model');
    expect(html).toContain('anthropic-model');
  });

  test('shows a single compact cache-input footer and omits the removed explanations', () => {
    const html = render([
      model({ model_name: 'cached-model-a', cache_ratio: 0.1 }),
      model({ model_name: 'cached-model-b', cache_ratio: 1 }),
    ]);
    expect(html.match(/Кэш-вход/g)).toHaveLength(1);
    expect(html.match(/40%/g)).toHaveLength(1);
    expect(html).not.toContain('повторно используемые входные токены');
    expect(html).not.toContain('Коэффициенты рассчитаны из опубликованных тарифов');
    expect(html).not.toContain('1 млн токенов баланса');
    expect(html).not.toContain('(вход + выход) × коэффициент');
    expect(html).not.toContain('Priority');
    expect(html).not.toContain('фактическое списание кэшированных токенов рассчитывает сервер');
  });

  test('an empty published catalogue gives an actionable message', () => {
    expect(render([])).toContain('Добавьте модель в канал и настройте её тариф');
  });
});
