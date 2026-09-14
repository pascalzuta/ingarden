import { describe, expect, it } from 'vitest';
import { parseMoneyToCents } from './money';

describe('parseMoneyToCents', () => {
  it('parses plain numbers', () => {
    expect(parseMoneyToCents('150')).toBe(15000);
    expect(parseMoneyToCents('150.50')).toBe(15050);
  });
  it('parses German format', () => {
    expect(parseMoneyToCents('1.234,56')).toBe(123456);
    expect(parseMoneyToCents('99,90')).toBe(9990);
  });
  it('strips currency symbols', () => {
    expect(parseMoneyToCents('€ 150')).toBe(15000);
  });
  it('rejects garbage', () => {
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('')).toBeNull();
  });
});
