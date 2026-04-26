import { describe, it, expect } from 'vitest';
import { mapError, isAuthError } from '@/lib/errorMapping';

describe('mapError', () => {
  it('returns unknown fallback for null/undefined', () => {
    expect(mapError(null).kind).toBe('unknown');
    expect(mapError(undefined).kind).toBe('unknown');
    expect(mapError(null).userMessage).toMatch(/algo não saiu/i);
  });

  describe('auth errors', () => {
    it('detects JWT expired', () => {
      const ue = mapError(new Error('JWT expired'));
      expect(ue.kind).toBe('auth');
      expect(ue.suggestedAction).toEqual({ type: 'redirect_to_auth' });
    });

    it('detects status 401', () => {
      const ue = mapError({ message: 'oops', status: 401 });
      expect(ue.kind).toBe('auth');
    });

    it('detects invalid_token', () => {
      expect(mapError(new Error('invalid_token')).kind).toBe('auth');
    });

    it('detects session expired phrasing', () => {
      expect(mapError(new Error('session expired')).kind).toBe('auth');
    });

    it('isAuthError helper works', () => {
      expect(isAuthError(mapError(new Error('JWT')))).toBe(true);
      expect(isAuthError(mapError(new Error('Failed to fetch')))).toBe(false);
    });
  });

  describe('forbidden / RLS', () => {
    it('detects row-level security message', () => {
      const ue = mapError(new Error('new row violates row-level security policy for table "x"'));
      expect(ue.kind).toBe('forbidden');
      expect(ue.userMessage).not.toMatch(/RLS|policy|postgres|jwt/i);
    });

    it('detects status 403', () => {
      expect(mapError({ status: 403, message: 'nope' }).kind).toBe('forbidden');
    });

    it('detects "permission denied"', () => {
      expect(mapError(new Error('permission denied for relation')).kind).toBe('forbidden');
    });
  });

  describe('not found', () => {
    it('detects status 404', () => {
      expect(mapError({ status: 404, message: '' }).kind).toBe('notFound');
    });

    it('detects "not found" message', () => {
      expect(mapError(new Error('record not found')).kind).toBe('notFound');
    });
  });

  describe('conflict', () => {
    it('detects pg unique violation code 23505', () => {
      expect(mapError({ code: '23505', message: 'duplicate' }).kind).toBe('conflict');
    });

    it('detects "duplicate key"', () => {
      expect(mapError(new Error('duplicate key value violates unique constraint')).kind).toBe('conflict');
    });

    it('detects already exists', () => {
      expect(mapError(new Error('already exists')).kind).toBe('conflict');
    });
  });

  describe('validation', () => {
    it('detects status 422', () => {
      expect(mapError({ status: 422, message: '' }).kind).toBe('validation');
    });

    it('detects status 400', () => {
      expect(mapError({ status: 400, message: '' }).kind).toBe('validation');
    });

    it('detects pg null violation 23502', () => {
      expect(mapError({ code: '23502', message: 'null in column' }).kind).toBe('validation');
    });
  });

  describe('network', () => {
    it('detects "Failed to fetch"', () => {
      const ue = mapError(new Error('Failed to fetch'));
      expect(ue.kind).toBe('network');
      expect(ue.suggestedAction).toEqual({ type: 'retry' });
    });

    it('detects timeout', () => {
      expect(mapError(new Error('Request timed out')).kind).toBe('network');
    });

    it('detects offline', () => {
      expect(mapError(new Error('You are offline')).kind).toBe('network');
    });
  });

  describe('server / 5xx', () => {
    it('detects status 500', () => {
      const ue = mapError({ status: 500, message: 'Internal Server Error' });
      expect(ue.kind).toBe('server');
    });

    it('detects status 503', () => {
      expect(mapError({ status: 503, message: '' }).kind).toBe('server');
    });

    it('detects "internal server error" message without status', () => {
      expect(mapError(new Error('internal server error')).kind).toBe('server');
    });

    it('does not leak "postgres" to userMessage', () => {
      const ue = mapError(new Error('postgres connection refused'));
      expect(ue.userMessage).not.toMatch(/postgres/i);
    });
  });

  describe('unknown fallback', () => {
    it('falls back for unrecognized errors', () => {
      const ue = mapError(new Error('something completely odd happened'));
      expect(ue.kind).toBe('unknown');
      expect(ue.technicalDetails).toContain('something completely odd happened');
    });

    it('handles plain string', () => {
      expect(mapError('hello').kind).toBe('unknown');
    });

    it('handles plain object', () => {
      const ue = mapError({ foo: 'bar' });
      expect(ue.kind).toBe('unknown');
    });
  });

  describe('safety', () => {
    const technicalTerms = /\b(rls|policy|postgres|jwt|sql|stack|trace)\b/i;

    it.each([
      [new Error('row-level security policy violated')],
      [new Error('JWT expired')],
      [new Error('postgres timeout')],
      [{ status: 500, message: 'PostgreSQL internal error: duplicate' }],
      [{ status: 403, message: 'RLS policy denied' }],
    ])('does not leak technical jargon to userMessage (%#)', (input) => {
      const ue = mapError(input);
      expect(ue.userMessage).not.toMatch(technicalTerms);
    });
  });

  describe('preserves technicalDetails', () => {
    it('keeps original message for logging', () => {
      const original = 'JWT expired at 2024-01-01';
      const ue = mapError(new Error(original));
      expect(ue.technicalDetails).toContain(original);
    });

    it('extracts details from postgrest-shaped error', () => {
      const pg = { message: 'failed', details: 'extra info', hint: 'try X', status: 500 };
      const ue = mapError(pg);
      expect(ue.technicalDetails).toContain('failed');
    });

    it('captures code when present', () => {
      const ue = mapError({ code: '23505', message: 'duplicate' });
      expect(ue.code).toBe('23505');
    });
  });
});
