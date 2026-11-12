import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UNIT_CATEGORIES, Unit, convertUnit } from './units';

@Component({
  selector: 'app-unit-converter',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './unit-converter.component.html',
  styleUrl: './unit-converter.component.scss'
})
export class UnitConverterComponent {
  readonly categories = UNIT_CATEGORIES;
  category = signal(UNIT_CATEGORIES[0]);
  query = signal('');
  value = signal('1');
  from = signal(UNIT_CATEGORIES[0].units[0]);
  to = signal(UNIT_CATEGORIES[0].units[1]);
  status = signal('');
  filteredCategories = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.categories.filter(c => `${c.name} ${c.units.map(u => `${u.name} ${u.symbol}`).join(' ')}`.toLowerCase().includes(q));
  });
  error = computed(() => {
    if (!this.value().trim() || !Number.isFinite(Number(this.value()))) return 'Enter a valid, finite number.';
    const base = Number(this.value()) * this.from().factor + this.from().offset;
    if (this.category().id === 'temperature' && base < -1e-10) return 'Temperature cannot be below absolute zero.';
    if (!Number.isFinite(this.result())) return 'The result is too large. Try a smaller value.';
    return '';
  });
  result = computed(() => convertUnit(Number(this.value()), this.from(), this.to()));
  selectCategory(id: string) {
    const category = this.categories.find(c => c.id === id);
    if (!category) return;
    this.category.set(category);
    this.from.set(category.units[0]);
    this.to.set(category.units[1]);
    this.status.set('');
  }
  selectUnit(side: 'from' | 'to', symbol: string) {
    const unit = this.category().units.find(u => u.symbol === symbol);
    if (unit) this[side].set(unit);
    this.status.set('');
  }
  swap() {
    const from = this.from();
    const result = this.result();
    const valid = !this.error();
    this.from.set(this.to());
    this.to.set(from);
    if (valid) this.value.set(String(result));
    this.status.set('');
  }
  equivalent(unit: Unit) { return convertUnit(Number(this.value()), this.from(), unit); }
  format(value: number): string {
    if (!Number.isFinite(value)) return 'Out of range';
    return Number(value.toPrecision(12)).toString();
  }
  async copy() {
    try {
      await navigator.clipboard.writeText(`${this.format(this.result())} ${this.to().symbol}`);
      this.status.set('Result copied.');
    } catch { this.status.set('Could not copy. Select the result to copy it manually.'); }
  }
}
