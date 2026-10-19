import { JsonFormatterComponent } from './json-formatter.component';

describe('JsonFormatterComponent', () => {
  let component: JsonFormatterComponent;

  beforeEach(() => {
    component = new JsonFormatterComponent();
  });

  it('formats and minifies valid JSON', () => {
    component.inputText.set('{"name":"FreeTools","items":[1,2]}');
    component.format();
    expect(component.outputText()).toContain('\n  "name": "FreeTools"');
    expect(component.successMessage()).toContain('formatted');

    component.minify();
    expect(component.outputText()).toBe('{"name":"FreeTools","items":[1,2]}');
  });

  it('reports invalid input without replacing the previous result', () => {
    component.inputText.set('{"valid":true}');
    component.format();
    const validOutput = component.outputText();

    component.inputText.set('{"broken": }');
    component.format();
    expect(component.errorMessage()).toBeTruthy();
    expect(component.outputText()).toBe(validOutput);
  });

  it('sorts nested keys without losing special property names', () => {
    component.sortKeys.set(true);
    component.inputText.set('{"z":1,"nested":{"b":2,"a":1},"__proto__":"kept"}');
    component.format();
    expect(component.outputText()).toContain('"__proto__": "kept"');
    expect(component.outputText().indexOf('"a"')).toBeLessThan(component.outputText().indexOf('"b"'));
  });
});
