import { describe, it, expect } from 'vitest';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../password.js';

describe('validatePassword utility', () => {
  it('identifies an empty password as invalid with score 0', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.error).toBe('Password is required');
    expect(result.rules.every((r) => !r.passed)).toBe(true);
  });

  it('fails when length is less than 8 characters', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.rules.find((r) => r.id === 'min-length')?.passed).toBe(false);
    expect(result.error).toBe('Password must be at least 8 characters long');
  });

  it('fails when missing uppercase letter', () => {
    const result = validatePassword('securepass123!');
    expect(result.isValid).toBe(false);
    expect(result.rules.find((r) => r.id === 'uppercase')?.passed).toBe(false);
    expect(result.error).toBe('Password must contain at least one uppercase letter');
  });

  it('fails when missing lowercase letter', () => {
    const result = validatePassword('SECUREPASS123!');
    expect(result.isValid).toBe(false);
    expect(result.rules.find((r) => r.id === 'lowercase')?.passed).toBe(false);
    expect(result.error).toBe('Password must contain at least one lowercase letter');
  });

  it('fails when missing number', () => {
    const result = validatePassword('SecurePassword!');
    expect(result.isValid).toBe(false);
    expect(result.rules.find((r) => r.id === 'number')?.passed).toBe(false);
    expect(result.error).toBe('Password must contain at least one number');
  });

  it('fails when missing special symbol', () => {
    const result = validatePassword('SecurePassword123');
    expect(result.isValid).toBe(false);
    expect(result.rules.find((r) => r.id === 'special')?.passed).toBe(false);
    expect(result.error).toBe('Password must contain at least one special symbol');
  });

  it('passes completely for strong compliant passwords', () => {
    const result = validatePassword('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.score).toBe(5);
    expect(result.error).toBeUndefined();
    expect(result.strength.label).toBe('Strong & secure');
    expect(result.rules.every((r) => r.passed)).toBe(true);
  });

  it('contains 5 standard requirements', () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
  });
});
