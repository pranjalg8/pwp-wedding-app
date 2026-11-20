// Which uploads the quote reader accepts.

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

// What the file is, from the browser's own guess or else the extension (phones sometimes report nothing for HEIC).
export function mimeOf(name: string, reported: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const guess = Object.values(TYPES).includes(reported) ? reported : TYPES[ext];
  return guess ?? null;
}
