import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lorem-ipsum',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lorem-ipsum.component.html',
  styleUrl: './lorem-ipsum.component.scss'
})
export class LoremIpsumComponent {
  unitType = signal<'paragraphs' | 'sentences' | 'words' | 'lists'>('paragraphs');
  count = signal<number>(3);
  startWithLorem = signal<boolean>(true);
  copied = signal<boolean>(false);

  loremWords = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
    'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim',
    'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
    'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit',
    'voluptate', 'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt',
    'mollit', 'anim', 'id', 'est', 'laborum'
  ];

  randomSentence(minWords = 8, maxWords = 15): string {
    const len = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
    const words: string[] = [];
    for (let i = 0; i < len; i++) {
      words.push(this.loremWords[Math.floor(Math.random() * this.loremWords.length)]);
    }
    const sentence = words.join(' ');
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
  }

  generatedContent = computed(() => {
    const n = Math.max(1, Math.min(100, this.count()));
    const type = this.unitType();

    if (type === 'words') {
      const words: string[] = [];
      if (this.startWithLorem()) words.push('Lorem', 'ipsum', 'dolor', 'sit', 'amet');
      while (words.length < n) {
        words.push(this.loremWords[Math.floor(Math.random() * this.loremWords.length)]);
      }
      return words.slice(0, n).join(' ');
    }

    if (type === 'sentences') {
      const sentences: string[] = [];
      if (this.startWithLorem()) {
        sentences.push('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
      }
      while (sentences.length < n) {
        sentences.push(this.randomSentence());
      }
      return sentences.join(' ');
    }

    if (type === 'lists') {
      const items: string[] = [];
      for (let i = 0; i < n; i++) {
        items.push(`• ${this.randomSentence(4, 9)}`);
      }
      return items.join('\n');
    }

    // Paragraphs
    const paras: string[] = [];
    for (let i = 0; i < n; i++) {
      const sCount = Math.floor(Math.random() * 3) + 4;
      const sentences: string[] = [];
      if (i === 0 && this.startWithLorem()) {
        sentences.push('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.');
      }
      while (sentences.length < sCount) {
        sentences.push(this.randomSentence());
      }
      paras.push(sentences.join(' '));
    }
    return paras.join('\n\n');
  });

  copyText() {
    navigator.clipboard.writeText(this.generatedContent());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}

