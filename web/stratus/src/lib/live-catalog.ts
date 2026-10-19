import type { PricingModel, PricingResponse, PricingVendor } from './api';
import { formatTariffNumber, getModelTokenTariff, TOKEN_ECONOMY, usdToWalletTokens } from './token-economy';

export const LIVE_CATALOG_PAGE_SIZE = 10;
export const STRATUS_PUBLIC_DISCOUNT = 0.5;

export type ModelCapability = 'chat' | 'images' | 'video' | 'audio';
export type CatalogPrice =
  | { kind: 'tokens'; multiplier: number; usd: number }
  | { kind: 'request'; walletTokens: number; usd: number }
  | { kind: 'unavailable' };

const imageSignals = /(?:^|[-_/])(?:image|images|vision|dall[-_]?e|imagen|flux|ideogram|stable[-_]?diffusion|seedream)(?:$|[-_/])/i;
const videoSignals = /(?:^|[-_/])(?:video|videos|sora|kling|veo|runway|wan|seedance|pika|vidu|luma)(?:$|[-_/])/i;
const audioSignals = /(?:audio|speech|tts|stt|whisper|transcri|voice|sonic|realtime|elevenlabs?|cosyvoice|fish[-_]?speech|parler|bark)/i;
const dynamicTerm = /\b([a-z_][a-z\d_]*)\s*\*\s*((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/gi;
const dynamicTokenVariables = new Set(['p', 'c', 'cr', 'cc', 'cc1h', 'img_o', 'img', 'ai', 'ao']);

function dynamicRates(expression: string) {
  const terms = [...expression.matchAll(dynamicTerm)];
  if ((expression.match(/\*/g) ?? []).length !== terms.length) return null;
  if (terms.some((match) => !dynamicTokenVariables.has(match[1]!.toLocaleLowerCase('en')))) return null;
  const rates = terms.map((match) => Number(match[2]));
  if (!rates.length || rates.some((rate) => !Number.isFinite(rate) || rate < 0)) return null;
  return rates;
}

function discountedUsd(multiplier: number) {
  return multiplier * TOKEN_ECONOMY.rubPerMillionTokens / TOKEN_ECONOMY.usdToRub *
    (1 - STRATUS_PUBLIC_DISCOUNT);
}

export function getCatalogPrice(
  model: PricingModel,
  pricing: Pick<PricingResponse, 'group_ratio' | 'usable_group'>,
  quotaPerUsd: number,
): CatalogPrice {
  if (!Number.isFinite(quotaPerUsd) || quotaPerUsd <= 0) return { kind: 'unavailable' };

  const enabledGroups = model.enable_groups ?? [];
  if (!enabledGroups.length) return { kind: 'unavailable' };
  const allowedGroups = enabledGroups.includes('all')
    ? Object.keys(pricing.usable_group)
    : enabledGroups.filter((group) => group in pricing.usable_group);
  const ratios = allowedGroups
    .map((group) => pricing.group_ratio[group])
    .filter((ratio): ratio is number => typeof ratio === 'number' && Number.isFinite(ratio) && ratio >= 0);
  if (!ratios.length) return { kind: 'unavailable' };

  if (model.billing_mode === 'tiered_expr') {
    if (!model.billing_expr) return { kind: 'unavailable' };
    // Dynamic expressions contain token-unit prices in USD per million tokens.
    // Read numeric token coefficients only; never evaluate server expressions in the browser.
    const parsedRates = dynamicRates(model.billing_expr);
    if (!parsedRates) return { kind: 'unavailable' };
    const rates = parsedRates.flatMap((rate) =>
      ratios.map((groupRatio) =>
        usdToWalletTokens(rate * groupRatio) / TOKEN_ECONOMY.tokensPerPack,
      ),
    );
    if (rates.some((rate) => !Number.isFinite(rate) || rate < 0)) {
      return { kind: 'unavailable' };
    }
    const multiplier = Math.min(...rates);
    return { kind: 'tokens', multiplier, usd: discountedUsd(multiplier) };
  }

  const multipliers: number[] = [];
  const requestCosts: number[] = [];
  for (const groupRatio of ratios) {
    const tariff = getModelTokenTariff(model, groupRatio, quotaPerUsd);
    if (tariff.kind === 'uniform') multipliers.push(tariff.multiplier);
    else if (tariff.kind === 'mixed') multipliers.push(tariff.minimum);
    else if (tariff.kind === 'request') requestCosts.push(tariff.tokens);
  }

  if (multipliers.length) {
    const multiplier = Math.min(...multipliers);
    return { kind: 'tokens', multiplier, usd: discountedUsd(multiplier) };
  }
  if (requestCosts.length) {
    const walletTokens = Math.min(...requestCosts);
    return { kind: 'request', walletTokens, usd: discountedUsd(walletTokens / TOKEN_ECONOMY.tokensPerPack) };
  }
  return { kind: 'unavailable' };
}

export function formatCatalogMultiplier(value: number) {
  return `×${formatTariffNumber(value)}`;
}

export function getPricingProvider(model: PricingModel, vendors: PricingVendor[]) {
  return vendors.find((vendor) => vendor.id === model.vendor_id)?.name || model.owner_by?.trim() || '—';
}

export function getModelCapabilities(model: PricingModel): ModelCapability[] {
  const endpoints = (model.supported_endpoint_types ?? []).join(' ').toLocaleLowerCase('en');
  const name = model.model_name.toLocaleLowerCase('en');
  const searchable = `${name} ${endpoints}`;
  const capabilities: ModelCapability[] = [];

  if (endpoints.includes('image-generation') || imageSignals.test(searchable)) capabilities.push('images');
  if (endpoints.includes('video') || videoSignals.test(searchable)) capabilities.push('video');
  if (endpoints.includes('audio') || audioSignals.test(searchable)) capabilities.push('audio');

  if (capabilities.length === 0 && /(?:^|[-_/])(?:openai|openai-response|chat|completions?)(?:$|[-_/])/.test(endpoints)) {
    capabilities.push('chat');
  }

  return capabilities;
}

export function filterPricingModels(
  models: PricingModel[],
  vendors: PricingVendor[],
  query: string,
  provider: string,
  locale: string,
  capability: ModelCapability | 'all' = 'all',
) {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  return models.filter((model) => {
    const providerName = getPricingProvider(model, vendors);
    const matchesProvider = provider === 'all' || providerName === provider;
    const matchesCapability = capability === 'all' || getModelCapabilities(model).includes(capability);
    const searchContent = `${model.model_name} ${providerName}`
      .toLocaleLowerCase(locale);
    return matchesProvider && matchesCapability &&
      (!normalizedQuery || searchContent.includes(normalizedQuery));
  });
}

export function paginatePricingModels<T>(models: T[], page: number, pageSize = LIVE_CATALOG_PAGE_SIZE) {
  const safePage = Math.max(0, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const start = safePage * safePageSize;
  return models.slice(start, start + safePageSize);
}
