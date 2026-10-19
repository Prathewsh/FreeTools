import { VideoEditorComponent } from './video-editor.component';

describe('VideoEditorComponent', () => {
  it('keeps trim handles ordered and calculates selection duration', () => {
    const component = new VideoEditorComponent();
    component.duration.set(20);
    component.trimStart.set(4);
    component.trimEnd.set(12);
    expect(component.selectionDuration()).toBe(8);

    component.updateTrimStart(15);
    expect(component.trimStart()).toBeCloseTo(11.9);
    component.updateTrimEnd(2);
    expect(component.trimEnd()).toBeCloseTo(12);
  });

  it('cycles rotation and resets transforms', () => {
    const component = new VideoEditorComponent();
    component.rotate();
    component.rotate();
    expect(component.rotation()).toBe(180);
    component.flipHorizontal.set(true);
    component.duration.set(10);
    component.resetEdits();
    expect(component.rotation()).toBe(0);
    expect(component.flipHorizontal()).toBe(false);
    expect(component.trimEnd()).toBe(10);
  });

  it('formats timeline values', () => {
    const component = new VideoEditorComponent();
    expect(component.formatTime(65.25)).toBe('01:05.3');
  });
});
