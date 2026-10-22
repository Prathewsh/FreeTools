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
    expect(compiled.querySelector('h1')?.textContent).toContain('Free tools,all in one place');
  });

  it('starts with the welcome screen and no demo controls', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.welcome-container')).toBeTruthy();
    expect(fixture.componentInstance.activeTab()).toBe('welcome');
    expect(element.textContent).not.toMatch(/try sample|demo beat|sunset demo/i);
    expect(element.querySelector('canvas')).toBeNull();
  });


  it('provides an options panel and upload workspace for every tool', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.collapsedCategories.set(new Set());
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

  it('includes the JSON formatter in the tool catalog', () => {
    const fixture = TestBed.createComponent(App);
    const ids = fixture.componentInstance.tools.map((tool) => tool.id);
    expect(ids).toContain('json-formatter');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places the video editor immediately above the audio editor', () => {
    const fixture = TestBed.createComponent(App);
    const ids = fixture.componentInstance.tools.map((tool) => tool.id);
    expect(ids.indexOf('video-editor')).toBe(ids.indexOf('audio-cutter') - 1);
  });

});
