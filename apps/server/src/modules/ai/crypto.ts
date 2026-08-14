import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

function key(): Buffer {
  // 由 JWT_SECRET 派生 32 字节密钥；生产建议使用独立 KMS
  return createHash('sha256').update(env.jwtSecret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(cipherText: string): string {
  const buf = Buffer.from(cipherText, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function maskSecret(plain: string): string {
  if (!plain) return '';
  if (plain.length <= 8) return '****';
  return `${plain.slice(0, 4)}****${plain.slice(-4)}`;
}
