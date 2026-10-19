import { TestBed } from '@angular/core/testing';
import { App, ToolTab } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('In-browser Media Studio & Tools');
  });

  it('starts with an upload screen and no demo controls', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.empty-dropzone')).toBeTruthy();
    expect(element.querySelector('input[type="file"]')).toBeTruthy();
    expect(element.textContent).not.toMatch(/try sample|demo beat|sunset demo/i);
    expect(element.querySelector('canvas')).toBeNull();
  });


  it('provides an options panel and upload workspace for every tool', async () => {
    const fixture = TestBed.createComponent(App);
    const tabs: ToolTab[] = ['bg-remover', 'image-studio', 'video-editor', 'audio-cutter', 'batch-converter', 'color-palette'];
    for (const tab of tabs) {
      fixture.componentInstance.selectTool(tab);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.editor-options')).toBeTruthy();
      expect(element.querySelector('.editor-stage .empty-dropzone')).toBeTruthy();
      expect(element.querySelectorAll('.rail-tool.active')).toHaveLength(1);
    }
  });

  it('places the JSON formatter after colors', () => {
    const fixture = TestBed.createComponent(App);
    const ids = fixture.componentInstance.tools.map((tool) => tool.id);
    expect(ids.slice(-2)).toEqual(['color-palette', 'json-formatter']);
  });

  it('places the video editor immediately above the audio editor', () => {
    const fixture = TestBed.createComponent(App);
    const ids = fixture.componentInstance.tools.map((tool) => tool.id);
    expect(ids.indexOf('video-editor')).toBe(ids.indexOf('audio-cutter') - 1);
  });

});
