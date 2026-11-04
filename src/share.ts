import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';

/** Opens the share sheet with an image (native), Web Share, or a download fallback. */
export async function shareImage(
  cv: HTMLCanvasElement,
  fileName: string,
  text: string,
): Promise<void> {
  const dataUrl = cv.toDataURL('image/png');
  if (isNative) {
    const res = await Filesystem.writeFile({
      path: fileName,
      data: dataUrl.split(',')[1]!,
      directory: Directory.Cache,
    });
    await Share.share({ title: text, text, files: [res.uri], dialogTitle: 'Share your buddy' });
    return;
  }
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function shareText(text: string): Promise<void> {
  if (isNative) {
    await Share.share({ text, dialogTitle: 'Send to a friend' });
    return;
  }
  if (navigator.share) {
    await navigator.share({ text });
    return;
  }
  await navigator.clipboard?.writeText(text);
}
