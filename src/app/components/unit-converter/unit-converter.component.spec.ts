import { UnitConverterComponent } from './unit-converter.component';
import { UNIT_CATEGORIES, convertUnit } from './units';

describe('Unit converter', () => {
  const convert = (category: string, from: string, to: string, value: number) => {
    const units = UNIT_CATEGORIES.find(c => c.id === category)!.units;
    return convertUnit(value, units.find(u => u.symbol === from)!, units.find(u => u.symbol === to)!);
  };
  it('converts common metric and imperial measurements', () => {
    expect(convert('length', 'mi', 'km', 1)).toBeCloseTo(1.609344, 10);
    expect(convert('mass', 'lb', 'kg', 1)).toBeCloseTo(.45359237, 10);
    expect(convert('area', 'ac', 'm²', 1)).toBeCloseTo(4046.8564224, 7);
    expect(convert('energy', 'kcal', 'J', 1)).toBe(4184);
    expect(convert('pressure', 'atm', 'Pa', 1)).toBe(101325);
  });
  it('handles temperature offsets and absolute zero', () => {
    expect(convert('temperature', '°C', '°F', 0)).toBeCloseTo(32, 10);
    expect(convert('temperature', '°F', '°C', -40)).toBeCloseTo(-40, 10);
    expect(convert('temperature', '°C', 'K', -273.15)).toBe(0);
    const component = new UnitConverterComponent();
    component.selectCategory('temperature');
    component.value.set('-274');
    expect(component.error()).toContain('absolute zero');
    component.value.set('-273.15');
    expect(component.error()).toBe('');
  });
  it('distinguishes US and Imperial volume and decimal and binary storage', () => {
    expect(convert('volume', 'US gal', 'L', 1)).toBeCloseTo(3.785411784, 10);
    expect(convert('volume', 'UK gal', 'L', 1)).toBeCloseTo(4.54609, 10);
    expect(convert('data', 'MB', 'B', 1)).toBe(1000000);
    expect(convert('data', 'MiB', 'B', 1)).toBe(1048576);
    expect(convert('data-rate', 'MB/s', 'Mbit/s', 1)).toBe(8);
  });
  it('round trips every unit through its category base', () => {
    for (const category of UNIT_CATEGORIES) {
      for (const unit of category.units) {
        const value = convertUnit(123.456, unit, category.units[0]);
        expect(convertUnit(value, category.units[0], unit)).toBeCloseTo(123.456, 8);
      }
    }
  });
  it('validates input, preserves tiny values, swaps, and resets category units', () => {
    const component = new UnitConverterComponent();
    for (const value of ['', ' ', 'abc', 'Infinity', '1e999']) {
      component.value.set(value);
      expect(component.error()).not.toBe('');
    }
    component.value.set('1e-20');
    expect(component.error()).toBe('');
    expect(component.format(component.result())).toBe('1e-23');
    component.value.set('1000');
    component.swap();
    expect(component.value()).toBe('1');
    expect(component.result()).toBe(1000);
    component.selectCategory('mass');
    expect(component.from().symbol).toBe('kg');
    expect(component.to().symbol).toBe('g');
  });
  it('finds categories by unit name and symbol', () => {
    const component = new UnitConverterComponent();
    component.query.set('fahrenheit');
    expect(component.filteredCategories().map(c => c.id)).toEqual(['temperature']);
    component.query.set('heat');
    expect(component.filteredCategories().map(c => c.id)).toEqual(['energy']);
  });
});
