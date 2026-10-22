import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type UnicodeMode = 'lookup' | 'symbols';

interface SymbolCategory {
  name: string;
  symbols: string[];
}

@Component({
  selector: 'app-unicode-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unicode-tools.component.html',
  styleUrl: './unicode-tools.component.scss'
})
export class UnicodeToolsComponent {
  mode = signal<UnicodeMode>('symbols');
  inputText = signal('Hello 🌍');
  searchSymbol = signal('');
  copiedText = signal('');

  symbolCategories: SymbolCategory[] = [
    {
      name: 'Arrows & Pointers',
      symbols: [
        '←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙',
        '↚', '↛', '↞', '↠', '↢', '↣', '↩', '↪', '⇄', '⇅',
        '⇆', '➔', '➜', '➤', '➥', '➦', '➧', '➨', '➩', '➪',
        '➫', '➬', '➭', '➮', '➯', '➱', '➲', '➳', '➴', '➵',
        '⇦', '⇧', '⇨', '⇩', '⇪', '⌅', '⌆', '⌤', '⏎', '▶',
        '◀', '▲', '▼', '◄', '►', '▻', '◅', '▷', '◁', '⋖', '⋗'
      ]
    },
    {
      name: 'Math & Operators',
      symbols: [
        '±', '×', '÷', '≈', '≠', '≡', '≢', '≤', '≥', '≦', '≧',
        '∞', '∑', '∏', '√', '∛', '∜', '∫', '∬', '∭', '∮', '∆',
        '∇', '∂', '∈', '∉', '∋', '∌', '⊂', '⊃', '⊆', '⊇', '⊄',
        '⊅', '∧', '∨', '¬', '∀', '∃', '∄', '∅', '∠', '°', '∟',
        '∩', '∪', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊞', '⊟',
        '⊥', '∥', '∦', '∴', '∵', '∶', '∷', '∼', '∽', '∾', '∿'
      ]
    },
    {
      name: 'Greek Alphabet',
      symbols: [
        'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
        'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω',
        'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
        'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'
      ]
    },
    {
      name: 'Currency & Banking',
      symbols: [
        '$', '€', '£', '¥', '₹', '₽', '₩', '₺', '₴', '₿', '₫', '₱',
        '₲', '₵', '₡', '¢', '¤', 'ƒ', '֏', '؋', '৲', '৳', '૱', '௹',
        '฿', '៛', '₠', '₢', '₣', '₤', '₥', '₦', '₧', 'Rs', 'Kz'
      ]
    },
    {
      name: 'Stars, Checks & Marks',
      symbols: [
        '★', '☆', '✦', '✧', '✩', '✪', '✫', '✬', '✭', '✮', '✯', '✰',
        '✓', '✔', '✕', '✖', '✗', '✘', '⊕', '⊗', '✓', '✕', '✚', '✛',
        '✜', '✝', '✞', '✟', '✠', '✡', '✢', '✣', '✤', '✥', '✱', '✲',
        '✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽', '✾'
      ]
    },
    {
      name: 'Geometric Shapes & Blocks',
      symbols: [
        '■', '□', '▢', '▣', '▤', '▥', '▦', '▧', '▨', '▩', '▲', '△',
        '▴', '▵', '▶', '▷', '▸', '▹', '▼', '▽', '▾', '▿', '◀', '◁',
        '◆', '◇', '◈', '◉', '◊', '○', '◌', '◍', '◎', '●', '◐', '◑',
        '◒', '◓', '◔', '◕', '◖', '◗', '◘', '◙', '◚', '◛', '◜', '◝'
      ]
    },
    {
      name: 'Fractions & Subscripts/Superscripts',
      symbols: [
        '½', '⅓', '⅔', '¼', '¾', '⅕', '⅖', '⅗', '⅘', '⅙', '⅚', '⅛',
        '⅜', '⅝', '⅞', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹',
        '⁰', '⁺', '⁻', '⁼', '⁽', '⁾', 'ⁿ', '₁', '₂', '₃', '₄', '₅',
        '₆', '₇', '₈', '₉', '₀', '₊', '₋', '₌', '₍', '₎'
      ]
    },
    {
      name: 'Typography, Punctuation & Quotes',
      symbols: [
        '«', '»', '“', '”', '‘', '’', '„', '‚', '—', '–', '…', '§',
        '¶', '©', '®', '™', '°', '·', '•', '†', '‡', '‰', '‱', '′',
        '″', '‴', '¿', '¡', '‽', '⁂', '※', '‼', '⁇', '⁈', '⁉', '‸'
      ]
    },
    {
      name: 'Card Suits, Zodiac & Games',
      symbols: [
        '♠', '♣', '♥', '♦', '♤', '♧', '♡', '♢', '♔', '♕', '♖', '♗',
        '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟', '♈', '♉', '♊', '♋',
        '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⚀', '⚁', '⚂', '⚃'
      ]
    },
    {
      name: 'Music & Audio Notes',
      symbols: [
        '♩', '♪', '♫', '♬', '♭', '♮', '♯', '𝄞', '𝄢', '𝄡', '𝄪', '𝄫'
      ]
    },
    {
      name: 'Enclosed & Circled Numbers',
      symbols: [
        '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
        '❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿',
        '㈠', '㈡', '㈢', '㈣', '㈤', '㈥', '㈦', '㈧', '㈨', '㈩',
        'Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', 'Ⓕ', 'Ⓖ', 'Ⓗ', 'Ⓘ', 'Ⓙ'
      ]
    }
  ];

  filteredCategories = computed(() => {
    const q = this.searchSymbol().toLowerCase().trim();
    if (!q) return this.symbolCategories;
    return this.symbolCategories
      .map(cat => ({
        ...cat,
        symbols: cat.symbols.filter(s => s.toLowerCase().includes(q))
      }))
      .filter(cat => cat.symbols.length > 0);
  });

  parsedCharacters = computed(() => {
    const text = this.inputText();
    const chars: Array<{ char: string; codePoint: number; hex: string; htmlEntity: string; utf8: string }> = [];
    for (const char of text) {
      const code = char.codePointAt(0) || 0;
      chars.push({
        char,
        codePoint: code,
        hex: 'U+' + code.toString(16).toUpperCase().padStart(4, '0'),
        htmlEntity: `&#${code};`,
        utf8: encodeURIComponent(char)
      });
    }
    return chars;
  });

  copySymbol(sym: string) {
    navigator.clipboard.writeText(sym);
    this.copiedText.set(sym);
    setTimeout(() => this.copiedText.set(''), 1500);
  }
}
