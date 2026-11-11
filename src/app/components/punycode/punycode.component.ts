import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { encode, decode } from 'punycode/punycode.es6.js';

export function convertPunycode(input: string, direction: 'encode' | 'decode', domain: boolean): string {
  if (input.length > 10000) throw new Error('Use at most 10,000 characters.');
  if (!input) return '';
  const convert = (value: string) => {
    if (direction === 'encode') return encode(value);
    if (/[^\x00-\x7f]/.test(value)) throw new Error('Punycode input must contain ASCII characters only.');
    const result = decode(value);
    if (/[\uD800-\uDFFF]/u.test(result)) throw new Error('Invalid Unicode sequence.');
    return result;
  };
  if (!domain) return convert(input);
  const value = input.trim().replace(/[\u3002\uFF0E\uFF61]/g, '.');
  if (/[\s/@:#?\\]/.test(value)) throw new Error('Enter a domain name only, without a URL scheme, path, or email address.');
  return value.split('.').map((label, index, labels) => {
    if (!label && index === labels.length - 1) return '';
    if (!label) throw new Error('Domain names cannot contain empty labels.');
    if (direction === 'decode') {
      if (!/^xn--/i.test(label)) return label;
      if (!/^xn--[a-z0-9-]+$/i.test(label)) throw new Error('Invalid xn-- label.');
      const decoded = convert(label.slice(4).toLowerCase());
      if (!/[^\x00-\x7f]/.test(decoded) || encode(decoded).toLowerCase() !== label.slice(4).toLowerCase()) throw new Error('Invalid xn-- label.');
      return decoded;
    }
    return /[^\x00-\x7f]/.test(label) ? `xn--${convert(label)}` : label;
  }).join('.');
}

@Component({
  selector: 'app-punycode', standalone: true, imports: [FormsModule],
  templateUrl: './punycode.component.html', styleUrl: './punycode.component.scss'
})
export class PunycodeComponent {
  input = signal('bücher');
  direction = signal<'encode' | 'decode'>('encode');
  domain = signal(false);
  status = signal('');
  result = computed(() => {
    try { return { value: convertPunycode(this.input(), this.direction(), this.domain()), error: '' }; }
    catch (error) { return { value: '', error: error instanceof Error ? error.message : 'Invalid Punycode input.' }; }
  });
  swap() {
    if (!this.result().value) return;
    this.input.set(this.result().value);
    this.direction.update(value => value === 'encode' ? 'decode' : 'encode');
    this.status.set('');
  }
  example() {
    this.input.set(this.domain() ? (this.direction() === 'encode' ? 'bücher.example' : 'xn--bcher-kva.example') : (this.direction() === 'encode' ? 'bücher' : 'bcher-kva'));
    this.status.set('');
  }
  async copy() {
    try { await navigator.clipboard.writeText(this.result().value); this.status.set('Copied!'); }
    catch { this.status.set('Clipboard unavailable. Select and copy the output manually.'); }
  }
}
