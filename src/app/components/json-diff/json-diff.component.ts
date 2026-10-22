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
      const lines = this.csvInput().trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] !== undefined ? values[i] : '';
        });
        return obj;
      });
      this.jsonFromCsv.set(JSON.stringify(rows, null, 2));
    } catch {
      this.jsonFromCsv.set('Error parsing CSV');
    }
  }

  convertJsonToCsv() {
    try {
      const arr = JSON.parse(this.jsonToCsvInput());
      if (!Array.isArray(arr) || !arr.length) {
        this.csvOutput.set('Input must be a JSON array of objects');
        return;
      }
      const headers = Object.keys(arr[0]);
      const csvLines = [
        headers.join(','),
        ...arr.map(row => headers.map(h => JSON.stringify(row[h] !== undefined ? row[h] : '')).join(','))
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
