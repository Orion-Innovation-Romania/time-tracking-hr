/**
 * JPEG of the visible tab, using the browser's own screen capture.
 * html-to-image rebuilds the DOM and was producing a blank / wrong picture.
 */
export async function capturePageJpeg(): Promise<Blob | null> {
  const media = navigator.mediaDevices;
  if (!media?.getDisplayMedia) return null;

  let stream: MediaStream | undefined;
  try {
    stream = await media.getDisplayMedia({
      audio: false,
      video: { frameRate: 1 },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      systemAudio: 'exclude',
    } as DisplayMediaStreamOptions);

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth || !video.videoHeight) {
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.72);
    });
    return blob;
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}
