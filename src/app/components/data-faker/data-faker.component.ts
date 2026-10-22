import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type CellValue = string | number | boolean | null;
type Generator = 'id' | 'name' | 'email' | 'role' | 'company' | 'phone' | 'city' | 'country' | 'joinedDate' | 'custom' | 'number' | 'boolean' | 'null';
interface DataField { id: string; name: string; generator: Generator; value: string; }
type DataRow = Record<string, CellValue>;

@Component({
  selector: 'app-data-faker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-faker.component.html',
  styleUrl: './data-faker.component.scss'
})
export class DataFakerComponent {
  recordCount = signal<number>(10);
  exportFormat = signal<'json' | 'csv' | 'sql'>('json');
  generatedData = signal<DataRow[]>([]);
  tableName = signal('users');
  view = signal<'edit' | 'output'>('output');
  private outputDrafts = signal<Partial<Record<'json' | 'csv' | 'sql', string>>>({});
  hasOutputDraft = computed(() => this.outputDrafts()[this.exportFormat()] !== undefined);
  editableOutput = computed(() => this.outputDrafts()[this.exportFormat()] ?? this.formattedOutput());
  exportError = computed(() => this.hasOutputDraft() ? '' : this.validationError());

  editOutput(text: string) {
    this.outputDrafts.update(drafts => ({ ...drafts, [this.exportFormat()]: text }));
  }

  resetOutput() {
    this.outputDrafts.update(drafts => {
      const next = { ...drafts };
      delete next[this.exportFormat()];
      return next;
    });
  }
  fields = signal<DataField[]>(['id', 'name', 'email', 'role', 'company', 'phone', 'city', 'country', 'joinedDate'].map(name => ({
    id: name, name, generator: name as Generator, value: ''
  })));
  generators: Generator[] = ['id', 'name', 'email', 'role', 'company', 'phone', 'city', 'country', 'joinedDate', 'custom', 'number', 'boolean', 'null'];
  validationError = computed(() => {
    const names = this.fields().map(field => field.name);
    if (!names.length) return 'Add at least one field.';
    if (names.some(name => !name.trim())) return 'Every field needs a name.';
    if (new Set(names).size !== names.length) return 'Field names must be unique.';
    if (names.some(name => name.includes('\0')) || this.tableName().includes('\0')) return 'Names cannot contain null characters.';
    if (this.exportFormat() === 'sql' && !this.tableName().trim()) return 'Enter a SQL table name.';
    if (this.exportFormat() === 'sql' && this.generatedData().some(row => Object.values(row).some(value => typeof value === 'string' && value.includes('\0')))) return 'SQL text values cannot contain null characters.';
    return '';
  });

  updateField(id: string, patch: Partial<DataField>) {
    this.fields.update(fields => fields.map(field => field.id === id ? { ...field, ...patch } : field));
  }

  addField() {
    const id = crypto.randomUUID();
    let name = 'custom_field';
    for (let i = 2; this.fields().some(field => field.name === name); i++) name = `custom_field_${i}`;
    this.fields.update(fields => [...fields, { id, name, generator: 'custom', value: '' }]);
    this.generatedData.update(rows => rows.map(row => ({ ...row, [id]: '' })));
  }

  removeField(id: string) {
    this.fields.update(fields => fields.filter(field => field.id !== id));
    this.generatedData.update(rows => rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== id))));
  }

  editCell(index: number, id: string, value: CellValue) {
    this.generatedData.update(rows => rows.map((row, i) => i === index ? { ...row, [id]: value } : row));
  }

  cellType(value: CellValue): string { return value === null ? 'null' : typeof value; }

  changeCellType(index: number, id: string, type: string) {
    const value = this.generatedData()[index][id];
    this.editCell(index, id, type === 'null' ? null : type === 'boolean' ? value === true || value === 'true' : type === 'number' ? (Number.isFinite(Number(value)) ? Number(value) : 0) : String(value ?? ''));
  }

  editNumber(index: number, id: string, value: number | null) {
    this.editCell(index, id, value !== null && Number.isFinite(value) ? value : 0);
  }

  addRow() {
    if (this.generatedData().length >= 500) return;
    this.generatedData.update(rows => [...rows, Object.fromEntries(this.fields().map(field => [field.id, this.customValue(field)]))]);
  }

  removeRow(index: number) { this.generatedData.update(rows => rows.filter((_, i) => i !== index)); }

  private customValue(field: DataField): CellValue {
    if (field.generator === 'null') return null;
    if (field.generator === 'boolean') return field.value === 'true';
    if (field.generator === 'number') return Number.isFinite(Number(field.value)) ? Number(field.value) : 0;
    return field.value;
  }

  private firstNames = ['Alex', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Oliver', 'Charlotte', 'Aiden', 'Harper'];
  private lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
  private domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'acme.io', 'cloudcorp.net', 'startup.dev'];
  private roles = ['Software Engineer', 'Product Designer', 'VP of Engineering', 'DevOps Architect', 'Data Scientist', 'Security Analyst', 'Product Manager', 'QA Lead'];
  private companies = ['Apex Dynamics', 'Starlight Labs', 'Quantum Software', 'Pulse Media', 'Echo Technologies', 'Vortex Systems', 'Prism Cloud'];
  private cities = ['San Francisco', 'New York', 'London', 'Berlin', 'Tokyo', 'Toronto', 'Sydney', 'Singapore', 'Amsterdam', 'Paris'];
  private countries = ['United States', 'United Kingdom', 'Germany', 'Japan', 'Canada', 'Australia', 'Singapore', 'Netherlands', 'France'];

  constructor() {
    this.generateDataset();
  }

  generateDataset() {
    const count = Math.min(500, Math.max(1, Math.trunc(Number(this.recordCount())) || 1));
    this.recordCount.set(count);
    const list: DataRow[] = [];

    for (let i = 0; i < count; i++) {
      const first = this.randItem(this.firstNames);
      const last = this.randItem(this.lastNames);
      const domain = this.randItem(this.domains);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
      const phone = `+1 (${Math.floor(Math.random() * 800) + 200}) ${Math.floor(Math.random() * 899) + 100}-${Math.floor(Math.random() * 8999) + 1000}`;
      const year = 2021 + Math.floor(Math.random() * 4);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

      const person: DataRow = {
        id: crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now() + i),
        name: `${first} ${last}`,
        email,
        role: this.randItem(this.roles),
        company: this.randItem(this.companies),
        phone,
        city: this.randItem(this.cities),
        country: this.randItem(this.countries),
        joinedDate: `${year}-${month}-${day}`
      };
      list.push(Object.fromEntries(this.fields().map(field => [field.id,
        Object.hasOwn(person, field.generator) ? person[field.generator] : this.customValue(field)
      ])));
    }

    this.generatedData.set(list);
  }

  private randItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  formattedOutput = computed(() => {
    if (this.validationError()) return '';
    const fields = this.fields();
    const data = this.generatedData();
    if (this.exportFormat() === 'json') {
      return JSON.stringify(data.map(row => Object.fromEntries(fields.map(field => [field.name, row[field.id] ?? null]))), null, 2);
    }
    if (this.exportFormat() === 'csv') {
      const escape = (value: CellValue) => {
        const text = String(value ?? '');
        return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };
      return [fields.map(field => escape(field.name)).join(','), ...data.map(row => fields.map(field => escape(row[field.id])).join(','))].join('\n');
    }
    const identifier = (name: string) => '"' + name.replace(/"/g, '""') + '"';
    const literal = (value: CellValue) => value === null ? 'NULL' : typeof value === 'string' ? "'" + value.replace(/'/g, "''") + "'" : typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
    return data.map(row => `INSERT INTO ${identifier(this.tableName())} (${fields.map(field => identifier(field.name)).join(', ')}) VALUES (${fields.map(field => literal(row[field.id] ?? null)).join(', ')});`).join('\n');
  });

  copyOutput() {
    if (this.exportError()) return;
    navigator.clipboard.writeText(this.editableOutput());
  }

  downloadOutput() {
    if (this.exportError()) return;
    const ext = this.exportFormat();
    const blob = new Blob([this.editableOutput()], { type: ext === 'json' ? 'application/json' : ext === 'csv' ? 'text/csv;charset=utf-8' : 'application/sql' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `fake_dataset.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

