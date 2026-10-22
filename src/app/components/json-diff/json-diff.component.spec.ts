import { JsonDiffComponent } from './json-diff.component';

describe('CSV conversion', () => {
  let component: JsonDiffComponent;
  beforeEach(() => { component = new JsonDiffComponent(); });

  it('reads quoted commas, escaped quotes, multiline fields, and CRLF records', () => {
    component.csvInput.set('\uFEFFname,note\r\n"Doe, Jane","She said ""hello""\nagain"\r\n');
    component.convertCsvToJson();
    expect(JSON.parse(component.jsonFromCsv())).toEqual([{ name: 'Doe, Jane', note: 'She said "hello"\nagain' }]);
  });

  it('round trips all columns and preserves whitespace and special property names', () => {
    const rows = JSON.parse('[{"name":" A ","__proto__":"kept","quote":"a\\\"b"},{"name":"B","later":"line1\\nline2"}]');
    component.jsonToCsvInput.set(JSON.stringify(rows));
    component.convertJsonToCsv();
    component.csvInput.set(component.csvOutput());
    component.convertCsvToJson();
    expect(JSON.parse(component.jsonFromCsv())).toEqual([
      { name: ' A ', ['__proto__']: 'kept', quote: 'a"b', later: '' },
      { name: 'B', ['__proto__']: '', quote: '', later: 'line1\nline2' }
    ]);
  });

  it('clears output when CSV input is cleared', () => {
    component.convertCsvToJson();
    component.csvInput.set('');
    component.convertCsvToJson();
    expect(component.jsonFromCsv()).toBe('');
  });

  it('reports malformed CSV instead of silently dropping data', () => {
    for (const input of ['a,b\n"unclosed,b', 'a,b\n1,2,3', 'a,a\n1,2']) {
      component.csvInput.set(input);
      component.convertCsvToJson();
      expect(component.jsonFromCsv()).toBe('Error parsing CSV');
    }
  });

  it('rejects JSON arrays containing non-object rows', () => {
    component.jsonToCsvInput.set('[{}, null]');
    component.convertJsonToCsv();
    expect(component.csvOutput()).toBe('Input must be a JSON array of objects');
  });
});
