import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeToolsComponent } from './time-tools.component';

describe('Countdown timer', () => {
  let component: TimeToolsComponent;

  beforeEach(() => {
    vi.useFakeTimers();
    component = new TimeToolsComponent();
    component.timerMinutes.set(0);
    component.timerSeconds.set(10);
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
  });

  it('pauses and resumes without counting paused time', () => {
    component.startTimer();
    vi.advanceTimersByTime(2500);
    component.pauseTimer();
    expect(component.timerRemaining()).toBe(7500);
    vi.advanceTimersByTime(5000);
    expect(component.timerRemaining()).toBe(7500);
    component.startTimer();
    vi.advanceTimersByTime(7500);
    expect(component.timerDisplay()).toBe('00:00:00');
    expect(component.timerFinished()).toBe(true);
    expect(component.timerRunning()).toBe(false);
  });

  it('catches up after delayed callbacks and can restart', () => {
    component.startTimer();
    vi.setSystemTime(Date.now() + 20000);
    vi.advanceTimersByTime(100);
    expect(component.timerRemaining()).toBe(0);
    expect(component.timerFinished()).toBe(true);
    component.startTimer();
    expect(component.timerDisplay()).toBe('00:00:10');
    expect(component.timerFinished()).toBe(false);
  });

  it('resets to the configured duration and cleans up on destruction', () => {
    component.startTimer();
    vi.advanceTimersByTime(1000);
    component.resetTimer();
    expect(component.timerDisplay()).toBe('00:00:10');
    expect(component.timerStarted()).toBe(false);
    component.startTimer();
    component.ngOnDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects empty, negative, fractional, out-of-range, and zero durations', () => {
    for (const seconds of [null, -1, 1.5, 60, NaN, 0]) {
      component.timerSeconds.set(seconds as number);
      component.startTimer();
      expect(component.timerRunning()).toBe(false);
    }
    component.timerHours.set(100);
    component.startTimer();
    expect(component.timerRunning()).toBe(false);
  });
});
