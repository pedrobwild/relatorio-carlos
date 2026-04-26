import { describe, it, expect } from 'vitest';
import { getWeightTone } from '../WeightProgress';

describe('getWeightTone', () => {
  it('returns success exactly at 100%', () => {
    expect(getWeightTone(100)).toBe('success');
  });

  it('returns success within ±0.05 tolerance', () => {
    expect(getWeightTone(100.04)).toBe('success');
    expect(getWeightTone(99.96)).toBe('success');
  });

  it('returns warning for slight under-allocation (95-99.95%)', () => {
    expect(getWeightTone(99)).toBe('warning');
    expect(getWeightTone(95)).toBe('warning');
  });

  it('returns warning for slight over-allocation (100.05-105%)', () => {
    expect(getWeightTone(101)).toBe('warning');
    expect(getWeightTone(105)).toBe('warning');
  });

  it('returns danger when significantly under 95%', () => {
    expect(getWeightTone(94.99)).toBe('danger');
    expect(getWeightTone(50)).toBe('danger');
    expect(getWeightTone(0)).toBe('danger');
  });

  it('returns danger when significantly over 105%', () => {
    expect(getWeightTone(105.01)).toBe('danger');
    expect(getWeightTone(150)).toBe('danger');
  });
});
