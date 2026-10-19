import { expect, test } from 'bun:test';
import { formatCabinetTokens } from '../src/lib/workspace-summary';

test('cabinet abbreviates large token balances without changing their underlying value', () => {
  expect(formatCabinetTokens(15_384_615.38)).toMatch(/15,38\sмлн токенов/);
  expect(formatCabinetTokens(741_784_615.38)).toMatch(/741,78\sмлн токенов/);
  expect(formatCabinetTokens(0)).toBe('0 токенов');
  expect(formatCabinetTokens(-1_500)).toContain('-1,5');
});

test('unavailable balances are not represented as zero', () => {
  expect(formatCabinetTokens(null)).toBe('Недоступно');
  expect(formatCabinetTokens(NaN)).toBe('Недоступно');
  expect(formatCabinetTokens(Infinity)).toBe('Недоступно');
});
