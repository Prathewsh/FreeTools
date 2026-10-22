import { parseGIF, decompressFrame } from 'gifuct-js';

export async function decodeGif(data: ArrayBuffer, signal?: AbortSignal) {
  if (data.byteLength > 25_000_000) throw new Error('Please use a GIF smaller than 25 MB.');
  if (!/^GIF8[79]a$/.test(new TextDecoder().decode(data.slice(0, 6)))) throw new Error('This is not a GIF file. Use a direct .gif URL or upload a GIF.');
  const gif = parseGIF(data);
  const images = gif.frames.filter(frame => 'image' in frame);
  const { width, height } = gif.lsd;
  if (!images.length || !width || !height) throw new Error('This GIF has no readable frames.');
  if (images.length > 500 || width * height * images.length > 100_000_000) throw new Error('This GIF is too large to edit here. Use a shorter or smaller GIF (up to 500 frames).');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d')!;
  const frames: { dataUrl: string; delay: number }[] = [];
  for (const image of images) {
    signal?.throwIfAborted();
    const dims = image.image.descriptor;
    if (!dims.width || !dims.height || dims.width * dims.height > 16_000_000 || dims.left + dims.width > width || dims.top + dims.height > height) throw new Error('Invalid or oversized GIF frame.');
    const frame = decompressFrame(image, gif.gct, true);
    if (!frames.length && frame.transparentIndex === undefined) {
      const bg = gif.gct?.[gif.lsd.backgroundColorIndex];
      if (bg) { ctx.fillStyle = `rgb(${bg.join(',')})`; ctx.fillRect(0, 0, width, height); }
    }
    const { left, top, width: w, height: h } = frame.dims;
    if (!w || !h || w * h > 16_000_000) throw new Error('Invalid or oversized GIF frame.');
    const previous = frame.disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null;
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patch = patchCtx.createImageData(w, h);
    patch.data.set(frame.patch);
    patchCtx.putImageData(patch, 0, 0);
    ctx.drawImage(patchCanvas, left, top);
    frames.push({ dataUrl: canvas.toDataURL('image/png'), delay: Math.max(20, frame.delay || 100) });
    if (frame.disposalType === 2) {
      ctx.clearRect(left, top, w, h);
      const bg = gif.gct?.[gif.lsd.backgroundColorIndex];
      if (frame.transparentIndex === undefined && bg) {
        ctx.fillStyle = `rgb(${bg.join(',')})`;
        ctx.fillRect(left, top, w, h);
      }
    } else if (previous) ctx.putImageData(previous, 0, 0);
    // Let controls, cancellation, and the loading indicator update during decoding.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal?.throwIfAborted();
  return { width, height, frames };
}
