import { Component, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-cursor-explorer',
  standalone: true,
  templateUrl: './cursor-explorer.component.html',
  styleUrl: './cursor-explorer.component.scss'
})
export class CursorExplorerComponent implements OnDestroy {
  readonly cursors = [
    ['auto', 'Let the browser choose a cursor for the content: a text cursor over text, or an arrow elsewhere.'],
    ['default', 'Show the standard arrow for your platform. Useful for elements without a special mouse action.'],
    ['none', 'Hide the cursor while it is inside this area. Move outside the preview to see it again.'],
    ['context-menu', 'Indicate that a context menu is available for this element.'],
    ['help', 'Indicate that additional help or information is available.'],
    ['pointer', 'Show a pointing hand, commonly used for links and clickable actions.'],
    ['progress', 'Indicate background activity while the interface remains available for interaction.'],
    ['wait', 'Indicate that an operation is busy and the user should wait.'],
    ['cell', 'Indicate that a table cell or group of cells can be selected.'],
    ['crosshair', 'Show a precise crosshair for selection, drawing, or positioning.'],
    ['text', 'Show a text selection cursor for horizontal text.'],
    ['vertical-text', 'Show a text selection cursor for vertically arranged text.'],
    ['alias', 'Indicate that dragging will create an alias or shortcut.'],
    ['copy', 'Indicate that the dragged item will be copied.'],
    ['move', 'Indicate that an element can be moved to another position.'],
    ['no-drop', 'Indicate that a dragged item cannot be dropped at this location.'],
    ['not-allowed', 'Indicate that the requested action is unavailable.'],
    ['grab', 'Show an open hand for content that can be grabbed and dragged.'],
    ['grabbing', 'Show a closed hand while content is being dragged.'],
    ['all-scroll', 'Indicate that content can be panned in any direction.'],
    ['col-resize', 'Indicate that a column boundary can be moved horizontally.'],
    ['row-resize', 'Indicate that a row boundary can be moved vertically.'],
    ['n-resize', 'Indicate resizing from the top (north) edge.'],
    ['e-resize', 'Indicate resizing from the right (east) edge.'],
    ['s-resize', 'Indicate resizing from the bottom (south) edge.'],
    ['w-resize', 'Indicate resizing from the left (west) edge.'],
    ['ne-resize', 'Indicate resizing from the top-right (northeast) corner.'],
    ['nw-resize', 'Indicate resizing from the top-left (northwest) corner.'],
    ['se-resize', 'Indicate resizing from the bottom-right (southeast) corner.'],
    ['sw-resize', 'Indicate resizing from the bottom-left (southwest) corner.'],
    ['ew-resize', 'Indicate horizontal resizing in either direction.'],
    ['ns-resize', 'Indicate vertical resizing in either direction.'],
    ['nesw-resize', 'Indicate diagonal resizing between the top-right and bottom-left corners.'],
    ['nwse-resize', 'Indicate diagonal resizing between the top-left and bottom-right corners.'],
    ['zoom-in', 'Indicate that the content can be magnified.'],
    ['zoom-out', 'Indicate that the content can be reduced in magnification.']
  ].map(([name, description]) => ({ name, description }));

  copied = signal('');
  message = signal('');
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  async copyCode(name: string) {
    if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer);
    this.copied.set('');
    this.message.set('');
    try {
      await navigator.clipboard.writeText(`cursor: ${name};`);
      this.copied.set(name);
      this.message.set(`Copied cursor: ${name};`);
      this.feedbackTimer = setTimeout(() => { this.copied.set(''); this.message.set(''); }, 2000);
    } catch {
      this.message.set(`Clipboard unavailable. Select and copy the code below the ${name} preview.`);
    }
  }

  ngOnDestroy() { if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer); }
}
