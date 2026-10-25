import {
  randomBytes,
  createHash,
  scrypt,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { promisify } from 'node:util';
export const now = () => new Date().toISOString();
export const secret = () => randomBytes(32).toString('hex');
export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const derive = promisify(scrypt);
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return (
    salt + ':' + ((await derive(password, salt, 64)) as Buffer).toString('hex')
  );
}
export async function passwordMatches(password: string, encoded: string) {
  const [salt, digest] = encoded.split(':');
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
}
function key() {
  const raw = process.env.AFRICORE_ENCRYPTION_KEY;
  if (!raw && process.env.NODE_ENV === 'production')
    throw new Error('AFRICORE_ENCRYPTION_KEY is required');
  return createHash('sha256')
    .update(raw || 'local-only-africore-key-do-not-use-in-production')
    .digest();
}
export function seal(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((v) => v.toString('hex'))
    .join('.');
}
export function unseal(value: string) {
  const [iv, tag, body] = value.split('.').map((v) => Buffer.from(v, 'hex'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
