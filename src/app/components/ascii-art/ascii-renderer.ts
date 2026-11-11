export interface AsciiOptions { characters: string; contrast: number; inverted: boolean; }

export function pixelsToAscii(pixels: Uint8ClampedArray, width: number, height: number, options: AsciiOptions): string {
  const ramp = Array.from(options.characters);
  if (ramp.length < 2) throw new Error('Use at least two characters in the character set.');
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3] / 255;
      // Composite transparency on white, matching the output preview.
      const brightness = (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) * alpha + 255 * (1 - alpha);
      let tone = Math.max(0, Math.min(1, ((brightness / 255 - 0.5) * options.contrast) + 0.5));
      if (options.inverted) tone = 1 - tone;
      line += ramp[Math.round(tone * (ramp.length - 1))];
    }
    lines.push(line);
  }
  return lines.join('\n');
}
