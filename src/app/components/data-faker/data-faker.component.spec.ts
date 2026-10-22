import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DataFakerComponent } from './data-faker.component';

describe('Data Faker customization', () => {
  let component: DataFakerComponent;
  beforeEach(() => { component = new DataFakerComponent(); });

  it('preserves edits across formats and field renames, including special keys', () => {
    component.generatedData.set([{ name: 'custom' }]);
    component.fields.set([{ id: 'name', name: '__proto__', generator: 'custom', value: '' }]);
    expect(JSON.parse(component.formattedOutput())[0]['__proto__']).toBe('custom');
    component.exportFormat.set('csv');
    expect(component.formattedOutput()).toBe('__proto__\ncustom');
    component.updateField('name', { name: 'display_name' });
    component.exportFormat.set('json');
    expect(JSON.parse(component.formattedOutput())).toEqual([{ display_name: 'custom' }]);
  });

  it('escapes SQL identifiers and strings and retains typed values', () => {
    component.fields.set(['text', 'number', 'boolean', 'null'].map(id => ({ id, name: id, generator: 'custom', value: '' })));
    component.generatedData.set([{ text: "O'Brien", number: 42, boolean: false, null: null }]);
    component.tableName.set('my"table');
    component.exportFormat.set('sql');
    expect(component.formattedOutput()).toBe('INSERT INTO "my""table" ("text", "number", "boolean", "null") VALUES (\'O\'\'Brien\', 42, FALSE, NULL);');
    component.exportFormat.set('json');
    expect(JSON.parse(component.formattedOutput())[0]).toEqual({ text: "O'Brien", number: 42, boolean: false, null: null });
  });

  it('escapes CSV headers, quotes, commas and newlines', () => {
    component.fields.set([{ id: 'a', name: 'a,b', generator: 'custom', value: '' }]);
    component.generatedData.set([{ a: 'hello "world"\nnext' }]);
    component.exportFormat.set('csv');
    expect(component.formattedOutput()).toBe('"a,b"\n"hello ""world""\nnext"');
  });

  it('adds custom defaults and removes fields and rows from exports', () => {
    component.addField();
    const field = component.fields().at(-1)!;
    component.updateField(field.id, { name: 'quantity', generator: 'number', value: '12' });
    component.recordCount.set(2);
    component.generateDataset();
    expect(JSON.parse(component.formattedOutput())[0].quantity).toBe(12);
    component.addRow();
    expect(component.generatedData().at(-1)![field.id]).toBe(12);
    component.removeRow(0);
    expect(component.generatedData()).toHaveLength(2);
    component.removeField(field.id);
    expect(component.formattedOutput()).not.toContain('quantity');
  });

  it('blocks exports with duplicate or empty field names', () => {
    component.updateField('email', { name: 'name' });
    expect(component.validationError()).toContain('unique');
    expect(component.formattedOutput()).toBe('');
    component.updateField('email', { name: '' });
    expect(component.validationError()).toContain('needs a name');
  });

  it('normalizes invalid record counts and numeric input', () => {
    component.recordCount.set(NaN);
    component.generateDataset();
    expect(component.generatedData()).toHaveLength(1);
    component.editNumber(0, 'id', Infinity);
    expect(component.generatedData()[0]['id']).toBe(0);
  });

  it('lets users edit values in the table without losing them on record count changes', async () => {
    TestBed.configureTestingModule({ imports: [DataFakerComponent] });
    const fixture = TestBed.createComponent(DataFakerComponent);
    fixture.componentInstance.view.set('edit');
    await fixture.whenStable();
    const textarea = fixture.nativeElement.querySelector('textarea[aria-label="name, row 1"]') as HTMLTextAreaElement;
    textarea.value = "O'Brien";
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const count = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    count.value = '20';
    count.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(JSON.parse(fixture.componentInstance.formattedOutput())[0].name).toBe("O'Brien");
    expect(fixture.componentInstance.generatedData()).toHaveLength(10);
  });
  it('opens an editable preview and copies the exact edited content', async () => {
    TestBed.configureTestingModule({ imports: [DataFakerComponent] });
    const fixture = TestBed.createComponent(DataFakerComponent);
    await fixture.whenStable();
    const editor = fixture.nativeElement.querySelector('textarea[aria-label="Editable dataset preview"]') as HTMLTextAreaElement;
    expect(editor).toBeTruthy();
    editor.value = '[{"custom":42}]';
    editor.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      fixture.componentInstance.copyOutput();
      expect(writeText).toHaveBeenCalledWith('[{"custom":42}]');
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('keeps independent drafts across formats and regeneration until explicitly discarded', () => {
    component.editOutput('[{"custom":42}]');
    component.exportFormat.set('sql');
    component.editOutput('CREATE TABLE custom (id INTEGER);');
    component.exportFormat.set('csv');
    component.editOutput('');
    expect(component.editableOutput()).toBe('');
    component.generateDataset();
    component.exportFormat.set('json');
    expect(component.editableOutput()).toBe('[{"custom":42}]');
    component.exportFormat.set('sql');
    expect(component.editableOutput()).toBe('CREATE TABLE custom (id INTEGER);');
    component.resetOutput();
    expect(component.editableOutput()).toContain('INSERT INTO');
  });

});
