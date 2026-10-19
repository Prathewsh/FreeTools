import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type JsonView = 'code' | 'tree';
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface TreeRow {
  path: string;
  key: string;
  depth: number;
  type: string;
  preview: string;
  expandable: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-json-formatter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './json-formatter.component.html',
  styleUrl: './json-formatter.component.scss'
})
export class JsonFormatterComponent {
  inputText = signal('');
  outputText = signal('');
  parsedValue = signal<JsonValue | null>(null);
  errorMessage = signal('');
  successMessage = signal('');
  indentSize = signal<2 | 3 | 4>(2);
  sortKeys = signal(false);
  viewMode = signal<JsonView>('code');
  searchQuery = signal('');
  expandedPaths = signal(new Set<string>(['$']));

  characterCount = computed(() => this.inputText().length);
  lineCount = computed(() => this.inputText() ? this.inputText().split('\n').length : 0);
  outputBytes = computed(() => new Blob([this.outputText()]).size);

  treeRows = computed<TreeRow[]>(() => {
    const root = this.parsedValue();
    if (root === null && !this.outputText()) return [];
    const rows: TreeRow[] = [];
    this.flattenTree(root, '$', 'root', 0, rows, Boolean(this.searchQuery().trim()));
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.path} ${row.key} ${row.preview} ${row.type}`.toLowerCase().includes(query));
  });

  format() {
    const parsed = this.parseInput();
    if (parsed === undefined) return;
    const value = this.sortKeys() ? this.sortValue(parsed) : parsed;
    this.commit(value, JSON.stringify(value, null, this.indentSize()), 'JSON formatted successfully.');
  }

  minify() {
    const parsed = this.parseInput();
    if (parsed === undefined) return;
    const value = this.sortKeys() ? this.sortValue(parsed) : parsed;
    this.commit(value, JSON.stringify(value), 'JSON minified successfully.');
  }

  validate() {
    const parsed = this.parseInput();
    if (parsed === undefined) return;
    this.commit(parsed, JSON.stringify(parsed, null, this.indentSize()), 'Valid JSON — no syntax errors found.');
  }

  private parseInput(): JsonValue | undefined {
    this.errorMessage.set('');
    this.successMessage.set('');
    const input = this.inputText().trim();
    if (!input) {
      this.errorMessage.set('Paste JSON or open a .json file to begin.');
      return undefined;
    }
    try {
      return JSON.parse(input) as JsonValue;
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Invalid JSON.';
      const positionMatch = raw.match(/position\s+(\d+)/i);
      if (positionMatch) {
        const position = Number(positionMatch[1]);
        const before = input.slice(0, position);
        const line = before.split('\n').length;
        const column = position - before.lastIndexOf('\n');
        this.errorMessage.set(`Syntax error at line ${line}, column ${column}: ${raw}`);
      } else {
        this.errorMessage.set(raw);
      }
      return undefined;
    }
  }

  private commit(value: JsonValue, output: string, message: string) {
    this.parsedValue.set(value);
    this.outputText.set(output);
    this.successMessage.set(message);
    this.expandedPaths.set(new Set(['$']));
  }

  private sortValue(value: JsonValue): JsonValue {
    if (Array.isArray(value)) return value.map((item) => this.sortValue(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, this.sortValue(value[key])])) as { [key: string]: JsonValue };
    }
    return value;
  }

  private flattenTree(
    value: JsonValue,
    path: string,
    key: string,
    depth: number,
    rows: TreeRow[],
    forceExpanded: boolean
  ) {
    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object';
    const expandable = isObject;
    const expanded = forceExpanded || this.expandedPaths().has(path);
    const count = isArray ? value.length : isObject ? Object.keys(value).length : 0;
    rows.push({
      path,
      key,
      depth,
      type: isArray ? 'array' : value === null ? 'null' : typeof value,
      preview: expandable ? `${isArray ? '[' : '{'} ${count} ${count === 1 ? 'item' : 'items'} ${isArray ? ']' : '}'}` : JSON.stringify(value),
      expandable,
      expanded
    });
    if (!expandable || !expanded) return;
    Object.entries(value as JsonValue[] | { [key: string]: JsonValue }).forEach(([childKey, childValue]) => {
      const safeKey = childKey.replace(/~/g, '~0').replace(/\//g, '~1');
      const childPath = `${path}/${safeKey}`;
      this.flattenTree(childValue, childPath, childKey, depth + 1, rows, forceExpanded);
    });
  }

  togglePath(path: string) {
    const next = new Set(this.expandedPaths());
    next.has(path) ? next.delete(path) : next.add(path);
    this.expandedPaths.set(next);
  }

  expandAll() {
    const paths = new Set<string>();
    const visit = (value: JsonValue, path: string) => {
      if (value !== null && typeof value === 'object') {
        paths.add(path);
        Object.entries(value).forEach(([key, child]) => {
          const safeKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
          visit(child, `${path}/${safeKey}`);
        });
      }
    };
    const root = this.parsedValue();
    if (root !== null || this.outputText()) visit(root, '$');
    this.expandedPaths.set(paths);
  }

  collapseAll() {
    this.expandedPaths.set(new Set());
  }

  loadSample() {
    this.inputText.set(JSON.stringify({
      project: 'FreeTools',
      private: true,
      tools: ['background-remover', 'image-studio', 'json-formatter'],
      settings: { theme: 'dark', autosave: false },
      metrics: { filesProcessed: 128, successRate: 0.98 }
    }));
    this.format();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.inputText.set(String(reader.result ?? ''));
      this.format();
      input.value = '';
    };
    reader.onerror = () => this.errorMessage.set('Could not read that file.');
    reader.readAsText(file);
  }

  clear() {
    this.inputText.set('');
    this.outputText.set('');
    this.parsedValue.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.searchQuery.set('');
  }

  async copyOutput() {
    if (!this.outputText()) return;
    try {
      await navigator.clipboard.writeText(this.outputText());
      this.successMessage.set('Formatted JSON copied to clipboard.');
    } catch {
      this.errorMessage.set('Clipboard access is unavailable in this browser context.');
    }
  }

  download() {
    if (!this.outputText()) return;
    const url = URL.createObjectURL(new Blob([this.outputText()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'formatted.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}
