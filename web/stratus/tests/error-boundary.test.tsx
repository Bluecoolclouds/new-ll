import { describe, expect, test } from 'bun:test';
import { ErrorBoundary } from '../src/components/error-boundary';

describe('Error boundary diagnostics', () => {
  test('serializes diagnostic fields, not arbitrary error properties or payment data', () => {
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { calls.push(args); };
    const error = Object.assign(new TypeError("Cannot read properties of null (reading 'find')"), {
      payload: { api_key: 'never-log-this' },
    });
    try {
      const boundary = new ErrorBoundary({ children: null });
      boundary.componentDidCatch(error, { componentStack: '\n at Wallet' });
      const diagnostic = JSON.parse(calls[0][1] as string);
      expect(diagnostic.name).toBe('TypeError');
      expect(diagnostic.message).toBe(error.message);
      expect(diagnostic.stack).toContain('error-boundary.test.tsx');
      expect(diagnostic.componentStack).toContain('Wallet');
      expect(JSON.stringify(calls)).not.toContain('never-log-this');
    } finally {
      console.error = original;
    }
  });
});
