import { describe, expect, test } from 'bun:test';
import type { PricingModel, PricingVendor } from '../src/lib/api';
import { filterPricingModels, getModelCapabilities, getPricingProvider, LIVE_CATALOG_PAGE_SIZE, paginatePricingModels } from '../src/lib/live-catalog';

const vendors: PricingVendor[] = [
  { id: 1, name: 'Anthropic' },
  { id: 2, name: 'Google' },
];

const models: PricingModel[] = [
  { model_name: 'claude-sonnet', owner_by: '', vendor_id: 1, quota_type: 0, model_ratio: 1, model_price: 0, completion_ratio: 1, enable_groups: ['default'], supported_endpoint_types: ['openai'] },
  { model_name: 'gemini-flash', owner_by: '', vendor_id: 2, quota_type: 0, model_ratio: 1, model_price: 0, completion_ratio: 1, enable_groups: ['default'], supported_endpoint_types: ['openai-response'] },
  { model_name: 'legacy-model', owner_by: 'Legacy', quota_type: 1, model_ratio: 0, model_price: 1, completion_ratio: 1, enable_groups: ['default'], supported_endpoint_types: ['image-generation'] },
];

describe('live model catalog filters and paging', () => {
  test('classifies models from their API tags and explicit modality names', () => {
    expect(getModelCapabilities(models[0]!)).toEqual(['chat']);
    expect(getModelCapabilities(models[2]!)).toEqual(['images']);
    expect(getModelCapabilities({
      ...models[0]!,
      model_name: 'gpt-4o-realtime-preview',
      supported_endpoint_types: ['openai'],
    })).toEqual(['audio']);
    expect(getModelCapabilities({
      ...models[0]!,
      model_name: 'sora-2',
      supported_endpoint_types: ['video-generation'],
    })).toEqual(['video']);
  });

  test('uses the published vendor category and falls back to owner_by', () => {
    expect(getPricingProvider(models[0]!, vendors)).toBe('Anthropic');
    expect(getPricingProvider(models[2]!, vendors)).toBe('Legacy');
  });

  test('filters by provider, capability, and search text together', () => {
    expect(filterPricingModels(models, vendors, 'CLAUDE', 'Anthropic', 'en', 'chat'))
      .toEqual([models[0]!]);
    expect(filterPricingModels(models, vendors, '', 'Google', 'en', 'images')).toEqual([]);
  });

  test('search includes the resolved provider but no longer exposes API tags as a filter', () => {
    expect(filterPricingModels(models, vendors, 'anthropic', 'all', 'en')).toEqual([models[0]!]);
    expect(filterPricingModels(models, vendors, 'legacy', 'all', 'en')).toEqual([models[2]!]);
    expect(filterPricingModels(models, vendors, 'image-generation', 'all', 'en')).toEqual([]);
  });

  test('shows no more than ten models per page', () => {
    const items = Array.from({ length: 27 }, (_, index) => index);
    expect(LIVE_CATALOG_PAGE_SIZE).toBe(10);
    expect(paginatePricingModels(items, 0)).toHaveLength(10);
    expect(paginatePricingModels(items, 2)).toEqual([20, 21, 22, 23, 24, 25, 26]);
    expect(paginatePricingModels(items, -1)).toHaveLength(10);
  });
});
