import { describe, expect, it } from 'vitest';
import { pixelsToAscii } from './ascii-renderer';

describe('ASCII image conversion', () => {
  const options = { characters: '@. ', contrast: 1, inverted: false };

  it('maps dark, midtone, and light pixels and preserves row dimensions', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 128, 128, 128, 255, 0, 0, 0, 255
    ]);
    expect(pixelsToAscii(pixels, 3, 2, options)).toBe('@. \n .@');
    expect(pixelsToAscii(pixels, 3, 2, { ...options, inverted: true })).toBe(' .@\n@. ');
  });

  it('composites transparent black on white and blends partial transparency', () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 255]);
    expect(pixelsToAscii(pixels, 3, 1, options)).toBe(' .@');
  });

  it('applies contrast without exceeding the custom character ramp', () => {
    const pixels = new Uint8ClampedArray([100, 100, 100, 255, 160, 160, 160, 255]);
    expect(pixelsToAscii(pixels, 2, 1, options)).toBe('..');
    expect(pixelsToAscii(pixels, 2, 1, { ...options, contrast: 3 })).toBe('@ ');
    expect(() => pixelsToAscii(pixels, 2, 1, { ...options, characters: '@' })).toThrow('at least two');
  });
});
