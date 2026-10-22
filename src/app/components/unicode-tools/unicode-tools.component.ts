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
  mode = signal<UnicodeMode>('lookup');
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
        '✓', '✔', '✕', '✖', '✗', '✘', '⊕', '⊗', '☑', '☒', '✚', '✛',
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
        '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'
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
        '⓪', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
        ...Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x24B6 + i)),
        ...Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x24D0 + i))
      ]
    },
    {
      name: 'Box Drawing & Borders',
      symbols: Array.from('─━│┃┄┅┆┇┈┉┊┋┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋═║╔╗╚╝╠╣╦╩╬╭╮╯╰╱╲╳')
    },
    {
      name: 'Shading & Block Elements',
      symbols: Array.from('▀▁▂▃▄▅▆▇█▉▊▋▌▍▎▏▐░▒▓▔▕▖▗▘▙▚▛▜▝▞▟')
    },
    {
      name: 'Keyboard, Computing & Controls',
      symbols: Array.from('⌘⌥⌃⇧⇪⌫⌦⎋⏎↵⇥⇤␣⌨⏏⏻⏼⏽⏾⏯⏭⏮⏩⏪⏫⏬⏸⏹⏺⌚⌛⏳⏰⏱⏲⎇⎈⌂')
    },
    {
      name: 'Weather, Nature & Astronomy',
      symbols: Array.from('☀☁☂☃☄☼☽☾★☆⚡❄❅❆☔⛄⛅⛈🌈🌊🌍🌎🌏🌑🌒🌓🌔🌕🌖🌗🌘☉☿♀♁♂♃♄♅♆♇')
    },
    {
      name: 'Science, Units & Letterlike Symbols',
      symbols: Array.from('℃℉KÅΩ℧µℏℎℓ℮℅℆℞℥℔Ⅎℵℶℷℸℂℍℕℙℚℝℤℬℰℱℋℐℒℳℛℭℌℑℜℨ')
    },
    {
      name: 'Logic, Relations & Advanced Math',
      symbols: Array.from('⇐⇒⇔⇍⇎⇏↦↤↪↩↼↽⇀⇁⊢⊣⊤⊥⊨⊩⊪⊫⊬⊭⊮⊯≔≕≜≝≟≪≫≲≳≺≻≼≽⊊⊋⊎⊏⊐⊑⊒⋀⋁⋂⋃⋄⋅⋆⋈⋮⋯⋰⋱⟨⟩⟦⟧⌈⌉⌊⌋')
    },
    {
      name: 'Roman Numerals',
      symbols: Array.from('ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅬⅭⅮⅯⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅺⅻⅼⅽⅾⅿ')
    },
    {
      name: 'Accented Latin Letters',
      symbols: Array.from('ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØŒÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøœùúûüýþÿĀāĂăĄąĆćČčĎďĐđĒēĖėĘęĞğİıŁłŃńŇňŌōŐőŘřŚśŠšŤťŪūŮůŰűŹźŻżŽž')
    },
    {
      name: 'Safety, Accessibility & Public Signs',
      symbols: Array.from('⚠☢☣⚕⚖⚙⚒⚓⛏⛑⛔♿🚻🚹🚺🚼🚭🚮🚰🚱🚳🚷🛂🛃🛄🛅♻⚐⚑☮☯☤☥')
    }
  ];

  filteredCategories = computed(() => {
    const q = this.searchSymbol().toLowerCase().trim();
    if (!q) return this.symbolCategories;
    return this.symbolCategories
      .map(cat => ({
        ...cat,
        symbols: cat.name.toLowerCase().includes(q) ? cat.symbols : cat.symbols.filter(s => s.toLowerCase().includes(q) || Array.from(s).some(char => ('u+' + char.codePointAt(0)!.toString(16).padStart(4, '0')).includes(q)))
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
