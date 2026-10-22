import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type BinaryMode = 'text-to-bin' | 'bin-to-text' | 'base-converter' | 'bitwise';

@Component({
  selector: 'app-binary-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './binary-tools.component.html',
  styleUrl: './binary-tools.component.scss'
})
export class BinaryToolsComponent {
  mode = signal<BinaryMode>('text-to-bin');
  inputText = signal('');
  outputText = signal('');

  // Base converter
  inputNumber = signal('42');
  inputBase = signal(10);
  binaryVal = signal('');
  octalVal = signal('');
  decimalVal = signal('');
  hexVal = signal('');

  // Bitwise
  operandA = signal(12);
  operandB = signal(5);

  bitwiseAnd = computed(() => this.operandA() & this.operandB());
  bitwiseAndBin = computed(() => (this.bitwiseAnd()).toString(2));

  bitwiseOr = computed(() => this.operandA() | this.operandB());
  bitwiseOrBin = computed(() => (this.bitwiseOr()).toString(2));

  bitwiseXor = computed(() => this.operandA() ^ this.operandB());
  bitwiseXorBin = computed(() => (this.bitwiseXor()).toString(2));

  bitwiseNotA = computed(() => ~this.operandA());
  bitwiseNotABin = computed(() => ((~this.operandA()) >>> 0).toString(2));

  shiftLeft = computed(() => this.operandA() << 1);
  shiftLeftBin = computed(() => (this.shiftLeft()).toString(2));

  shiftRight = computed(() => this.operandA() >> 1);
  shiftRightBin = computed(() => (this.shiftRight()).toString(2));

  constructor() {
    this.updateBases();
  }

  onInputTextChange(val: string) {
    this.inputText.set(val);
    this.convert();
  }

  convert() {
    const text = this.inputText();
    if (!text) {
      this.outputText.set('');
      return;
    }

    if (this.mode() === 'text-to-bin') {
      const bin = Array.from(text)
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join(' ');
      this.outputText.set(bin);
    } else if (this.mode() === 'bin-to-text') {
      try {
        const clean = text.replace(/[^01\s]/g, '').trim();
        const bytes = clean.split(/\s+/);
        const chars = bytes.map(b => String.fromCharCode(parseInt(b, 2)));
        this.outputText.set(chars.join(''));
      } catch {
        this.outputText.set('Invalid binary format');
      }
    }
  }

  updateBases() {
    try {
      const num = parseInt(this.inputNumber(), this.inputBase());
      if (isNaN(num)) {
        this.binaryVal.set('Invalid');
        this.octalVal.set('Invalid');
        this.decimalVal.set('Invalid');
        this.hexVal.set('Invalid');
        return;
      }
      this.binaryVal.set(num.toString(2));
      this.octalVal.set(num.toString(8));
      this.decimalVal.set(num.toString(10));
      this.hexVal.set(num.toString(16).toUpperCase());
    } catch {
      this.binaryVal.set('Error');
    }
  }

  copy(val: string) {
    navigator.clipboard.writeText(val);
  }
}

