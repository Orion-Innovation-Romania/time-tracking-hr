const MAX_BYTES = 1_800_000;

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((res) => res.blob());
}

/**
 * JPEG of the current page, taken before the problem-report dialog opens.
 * Returns null if the library cannot render (modern CSS, CORS images, etc.).
 */
export async function capturePageJpeg(): Promise<Blob | null> {
  try {
    const { toJpeg } = await import('html-to-image');
    const options = {
      quality: 0.72,
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      cacheBust: true,
      filter: (node: Node) => {
        if (!(node instanceof HTMLElement)) return true;
        return node.dataset.ttahProblemReport !== 'fab';
      },
    };
    let dataUrl = await toJpeg(document.body, options);
    let blob = await dataUrlToBlob(dataUrl);
    if (blob.size > MAX_BYTES) {
      dataUrl = await toJpeg(document.body, { ...options, quality: 0.5 });
      blob = await dataUrlToBlob(dataUrl);
    }
    if (blob.size > 2 * 1024 * 1024) return null;
    return blob;
  } catch {
    return null;
  }
}

export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
