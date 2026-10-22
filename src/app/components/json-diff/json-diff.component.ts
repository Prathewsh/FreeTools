import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type JsonSubtool = 'diff' | 'csv' | 'yaml';

@Component({
  selector: 'app-json-diff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './json-diff.component.html',
  styleUrl: './json-diff.component.scss'
})
export class JsonDiffComponent {
  mode = signal<JsonSubtool>('diff');

  // JSON Diff
  leftJson = signal('{\n  "name": "FreeTools",\n  "version": 1,\n  "active": true\n}');
  rightJson = signal('{\n  "name": "FreeTools",\n  "version": 2,\n  "active": false,\n  "author": "MGE"\n}');
  diffResults = signal<Array<{ type: 'added' | 'removed' | 'changed' | 'same'; path: string; leftVal?: any; rightVal?: any }>>([]);

  // CSV to JSON
  csvInput = signal('id,name,role\n1,Alice,Admin\n2,Bob,Editor\n3,Charlie,Viewer');
  jsonFromCsv = signal('');

  // JSON to CSV
  jsonToCsvInput = signal('[\n  {"id": 1, "name": "Alice", "role": "Admin"},\n  {"id": 2, "name": "Bob", "role": "Editor"}\n]');
  csvOutput = signal('');

  constructor() {
    this.runDiff();
  }

  runDiff() {
    try {
      const obj1 = JSON.parse(this.leftJson());
      const obj2 = JSON.parse(this.rightJson());
      const results: Array<{ type: 'added' | 'removed' | 'changed' | 'same'; path: string; leftVal?: any; rightVal?: any }> = [];

      const allKeys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)]));
      for (const k of allKeys) {
        if (!(k in obj1)) {
          results.push({ type: 'added', path: k, rightVal: JSON.stringify(obj2[k]) });
        } else if (!(k in obj2)) {
          results.push({ type: 'removed', path: k, leftVal: JSON.stringify(obj1[k]) });
        } else if (JSON.stringify(obj1[k]) !== JSON.stringify(obj2[k])) {
          results.push({ type: 'changed', path: k, leftVal: JSON.stringify(obj1[k]), rightVal: JSON.stringify(obj2[k]) });
        } else {
          results.push({ type: 'same', path: k, leftVal: JSON.stringify(obj1[k]) });
        }
      }
      this.diffResults.set(results);
    } catch {
      this.diffResults.set([]);
    }
  }

  convertCsvToJson() {
    try {
      const input = this.csvInput().replace(/^\uFEFF/, '');
      if (!input.trim()) {
        this.jsonFromCsv.set('');
        return;
      }
      const records: string[][] = [];
      let row: string[] = [];
      let field = '';
      let quoted = false;
      let closedQuote = false;
      const finishField = () => {
        row.push(field);
        field = '';
        closedQuote = false;
      };
      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (quoted) {
          if (char === '"') {
            if (input[i + 1] === '"') { field += '"'; i++; }
            else { quoted = false; closedQuote = true; }
          } else field += char;
        } else if (char === ',') {
          finishField();
        } else if (char === '\n' || char === '\r') {
          finishField();
          records.push(row);
          row = [];
          if (char === '\r' && input[i + 1] === '\n') i++;
        } else if (char === '"' && !field && !closedQuote) {
          quoted = true;
        } else {
          if (closedQuote || char === '"') throw new Error('Invalid CSV quoting');
          field += char;
        }
      }
      if (quoted) throw new Error('Unclosed CSV quote');
      if (field || row.length || closedQuote) {
        finishField();
        records.push(row);
      }
      const headers = records[0];
      if (new Set(headers).size !== headers.length) throw new Error('Duplicate headers');
      const rows = records.slice(1).map(values => {
        if (values.length !== headers.length) throw new Error('Column count mismatch');
        return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
      });
      this.jsonFromCsv.set(JSON.stringify(rows, null, 2));
    } catch {
      this.jsonFromCsv.set('Error parsing CSV');
    }
  }

  convertJsonToCsv() {
    try {
      const arr = JSON.parse(this.jsonToCsvInput());
      if (!Array.isArray(arr) || !arr.length || arr.some(row => row === null || typeof row !== 'object' || Array.isArray(row))) {
        this.csvOutput.set('Input must be a JSON array of objects');
        return;
      }
      const headers = Array.from(new Set<string>(arr.flatMap(row => Object.keys(row))));
      const escapeField = (value: unknown): string => {
        const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };
      const csvLines = [
        headers.map(escapeField).join(','),
        ...arr.map(row => headers.map(h => escapeField(Object.hasOwn(row, h) ? row[h] : '')).join(','))
      ];
      this.csvOutput.set(csvLines.join('\n'));
    } catch {
      this.csvOutput.set('Error: invalid JSON array');
    }
  }

  // File import for CSV
  importCsvFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.csvInput.set(content);
        this.convertCsvToJson();
      };
      reader.readAsText(file);
    }
  }

  // File import for JSON to CSV
  importJsonFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.jsonToCsvInput.set(content);
        this.convertJsonToCsv();
      };
      reader.readAsText(file);
    }
  }

  // Export functions
  downloadCsv(content: string, filename: string = 'export.csv') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadJson(content: string, filename: string = 'data.json') {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  copy(val: string) {
    navigator.clipboard.writeText(val);
  }
}
