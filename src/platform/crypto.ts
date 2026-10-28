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
function currentKeyId(){const id=process.env.AFRICORE_ENCRYPTION_KEY_ID||'primary';if(!/^[a-zA-Z0-9_-]{1,32}$/.test(id))throw new Error('Invalid encryption key version');return id;}
function keys(){const raw=process.env.AFRICORE_ENCRYPTION_KEY;if((!raw||raw.length<32)&&process.env.NODE_ENV==='production')throw new Error('AFRICORE_ENCRYPTION_KEY is required');const old:Record<string,string>=JSON.parse(process.env.AFRICORE_ENCRYPTION_PREVIOUS_KEYS||'{}');return {...old,[currentKeyId()]:raw||'local-only-africore-key-do-not-use-in-production'};}
function key(raw:string){return createHash('sha256').update(raw).digest();}
export const encryptionContext=(...parts:string[])=>JSON.stringify(['africore-aead-v2',...parts]);
export function seal(value:string,context='application'){
 const version=process.env.AFRICORE_ENCRYPTION_WRITE_VERSION||(process.env.NODE_ENV==='production'?'1':'2');
 if(!['1','2'].includes(version))throw new Error('Invalid encryption write version');
 const id=currentKeyId(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(keys()[id]),iv);
 if(version==='2')cipher.setAAD(Buffer.from(encryptionContext(id,context)));
 const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 const envelope=[iv.toString('hex'),cipher.getAuthTag().toString('hex'),body.toString('hex')];
 return (version==='2'?['v2',id,...envelope]:envelope).join('.');
}
export function unseal(value:string,context='application'){
 const parts=value.split('.'),ring=keys();const modern=parts[0]==='v2';if(modern&&parts.length!==5||!modern&&parts.length!==3)throw new Error('Invalid encrypted envelope');
 const [ivHex,tagHex,bodyHex]=modern?parts.slice(2):parts;if(!/^[a-f0-9]{24}$/.test(ivHex)||!/^[a-f0-9]{32}$/.test(tagHex)||!/^([a-f0-9]{2})*$/.test(bodyHex))throw new Error('Invalid encrypted envelope');
 const candidates=modern?[ring[parts[1]]]:Object.values(ring);for(const raw of candidates){if(!raw)continue;try{const cipher=createDecipheriv('aes-256-gcm',key(raw),Buffer.from(ivHex,'hex'));if(modern)cipher.setAAD(Buffer.from(encryptionContext(parts[1],context)));cipher.setAuthTag(Buffer.from(tagHex,'hex'));return Buffer.concat([cipher.update(Buffer.from(bodyHex,'hex')),cipher.final()]).toString('utf8');}catch{}}
 throw new Error('Encrypted data authentication failed');
}
