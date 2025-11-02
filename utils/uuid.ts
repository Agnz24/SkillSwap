// utils/uuid.ts
import * as Crypto from 'expo-crypto';

export async function uuidV4(): Promise<string> {
  // Prefer Expo's randomUUID if available
  // @ts-ignore
  if (typeof Crypto.randomUUID === 'function') {
    // @ts-ignore
    return Crypto.randomUUID() as string;
  }
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = Array.from(bytes, toHex).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
