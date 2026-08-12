import { InstagramClient } from './instagram/client.js';
import { TiktokClient } from './tiktok/client.js';
import { PlatformRejected, type PlatformClient } from './types.js';

/**
 * The `platform` column is `text` and lists five platforms; we integrate two.
 * Constructing per call (rather than caching) means the base-URL env is read
 * fresh each time — tests point it at a fake without any reset hook, and the
 * clients hold nothing poolable. An unintegrated platform throws
 * `PlatformRejected`: waiting cannot make a YouTube reply succeed, so the
 * sender must send it to `failed` rather than retry forever.
 */
export function clientFor(platform: string): PlatformClient {
  switch (platform) {
    case 'instagram':
      return new InstagramClient(requireBaseUrl('INSTAGRAM_BASE_URL'));
    case 'tiktok':
      return new TiktokClient(requireBaseUrl('TIKTOK_BASE_URL'));
    default:
      throw new PlatformRejected(`unsupported platform: ${platform}`);
  }
}

function requireBaseUrl(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
