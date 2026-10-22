import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-tool',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-tool.component.html',
  styleUrl: './password-tool.component.scss'
})
export class PasswordToolComponent {
  // Generator options
  length = signal<number>(16);
  useUpper = signal<boolean>(true);
  useLower = signal<boolean>(true);
  useNumbers = signal<boolean>(true);
  useSymbols = signal<boolean>(true);
  avoidAmbiguous = signal<boolean>(true);

  password = signal<string>('');
  copied = signal<boolean>(false);

  // Strength tester input
  testPassword = signal<string>('');

  constructor() {
    this.generate();
  }

  generate() {
    let charset = '';
    if (this.useUpper()) charset += this.avoidAmbiguous() ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (this.useLower()) charset += this.avoidAmbiguous() ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    if (this.useNumbers()) charset += this.avoidAmbiguous() ? '23456789' : '0123456789';
    if (this.useSymbols()) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) {
      charset = 'abcdefghijklmnopqrstuvwxyz';
    }

    const arr = new Uint32Array(this.length());
    window.crypto.getRandomValues(arr);

    let res = '';
    for (let i = 0; i < this.length(); i++) {
      res += charset[arr[i] % charset.length];
    }
    this.password.set(res);
    this.testPassword.set(res);
  }

  copy() {
    navigator.clipboard.writeText(this.password());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  // Password analysis
  strength = computed(() => {
    const pwd = this.testPassword();
    if (!pwd) return { score: 0, text: 'Empty', color: '#64748b', entropy: 0, crackTime: 'Instant' };

    let pool = 0;
    if (/[a-z]/.test(pwd)) pool += 26;
    if (/[A-Z]/.test(pwd)) pool += 26;
    if (/[0-9]/.test(pwd)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) pool += 33;

    const entropy = Math.round(pwd.length * (Math.log2(pool || 1)));

    let score = 1;
    let text = 'Very Weak';
    let color = '#ef4444';
    let crackTime = '< 1 second';

    if (entropy > 80) {
      score = 4;
      text = 'Very Strong';
      color = '#10b981';
      crackTime = 'Centuries';
    } else if (entropy > 60) {
      score = 3;
      text = 'Strong';
      color = '#3b82f6';
      crackTime = 'Years';
    } else if (entropy > 40) {
      score = 2;
      text = 'Fair / Moderate';
      color = '#f59e0b';
      crackTime = 'Days / Months';
    }

    return { score, text, color, entropy, crackTime };
  });
}

