import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { convertPunycode } from './punycode.component';

describe('Punycode conversion', () => {
  it('matches known encodings', () => {
    expect(convertPunycode('bücher', 'encode', false)).toBe('bcher-kva');
    expect(convertPunycode('bcher-kva', 'decode', false)).toBe('bücher');
    expect(convertPunycode('mañana', 'encode', false)).toBe('maana-pta');
  });
  it('round trips ASCII, supplementary characters, and multilingual text', () => {
    for (const value of ['hello', '😀', '日本語', 'hello world', 'தமிழ்']) {
      expect(convertPunycode(convertPunycode(value, 'encode', false), 'decode', false)).toBe(value);
    }
    expect(convertPunycode('hello', 'encode', false)).toBe('hello-');
  });
  it('handles domain labels, Unicode dots, and uppercase prefixes', () => {
    expect(convertPunycode('bücher。example.', 'encode', true)).toBe('xn--bcher-kva.example.');
    expect(convertPunycode('XN--BCHER-KVA.example', 'decode', true)).toBe('bücher.example');
  });
  it('rejects malformed inputs', () => {
    expect(() => convertPunycode('xn--', 'decode', true)).toThrow();
    expect(() => convertPunycode('https://example.com', 'encode', true)).toThrow();
    expect(() => convertPunycode('abc..com', 'encode', true)).toThrow();
    expect(() => convertPunycode('ü', 'decode', false)).toThrow();
  });
});
