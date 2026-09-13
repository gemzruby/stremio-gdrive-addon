import rawMedia from '../data/media.json';

export interface MediaItem {
  id: string; type: 'movie'; name: string; description: string;
  poster?: string; background?: string; releaseInfo: string;
  driveFileId: string; mimeType: string;
}

export function validateMedia(input: unknown): MediaItem[] {
  if (!Array.isArray(input)) throw new Error('Media config must be an array');
  const ids = new Set<string>();
  const files = new Set<string>();
  return input.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Invalid media item ${index}`);
    const item = value as Record<string, unknown>;
    for (const key of ['id', 'name', 'description', 'releaseInfo', 'driveFileId', 'mimeType']) {
      if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`Invalid ${key} in media item ${index}`);
    }
    if (item.type !== 'movie' || !/^tam_[a-zA-Z0-9_-]+$/.test(item.id as string)) throw new Error(`Invalid type or id in media item ${index}`);
    if (ids.has(item.id as string) || files.has(item.driveFileId as string)) throw new Error(`Duplicate media id or Drive file ID in item ${index}`);
    for (const key of ['poster', 'background']) {
      if (item[key] === undefined) continue;
      try { if (typeof item[key] !== 'string' || new URL(item[key] as string).protocol !== 'https:') throw new Error(); }
      catch { throw new Error(`Invalid ${key} URL in media item ${index}`); }
    }
    ids.add(item.id as string); files.add(item.driveFileId as string);
    return item as unknown as MediaItem;
  });
}

export const media = validateMedia(rawMedia);
export function publicMeta(item: MediaItem) {
  const { id, type, name, description, poster, background, releaseInfo } = item;
  return { id, type, name, description, poster, background, releaseInfo };
}
