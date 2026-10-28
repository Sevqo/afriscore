import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request as httpsRequest} from 'node:https';
export function publicWebhookAddress(address:string){
 const version=isIP(address);
 if(version===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
 if(version===6){const value=address.toLowerCase(),second=Number.parseInt(value.split(':')[1]||'0',16);return /^[23][0-9a-f]{3}:/.test(value)&&!value.startsWith('2001:db8:')&&!(value.startsWith('2001:')&&second<512)&&!value.startsWith('2002:')&&!value.startsWith('3fff:');}
 return false;
}
export async function resolveWebhookAddress(hostname:string,resolver=lookup){
 let timer:ReturnType<typeof setTimeout>|undefined;
 const addresses=await Promise.race([resolver(hostname,{all:true}),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('webhook_dns_timeout')),5000);timer.unref();})]).finally(()=>{if(timer)clearTimeout(timer);});
 if(!addresses.length||addresses.some(r=>!publicWebhookAddress(r.address)))throw new Error('webhook_destination_denied');
 return addresses[0];
}
/** Pin DNS validation to the actual TLS connection. Never use a second resolver,
 * environment proxy, reusable socket, redirect or unbounded response body. */
export function createWebhookTransport(resolver=lookup,requester:typeof httpsRequest=httpsRequest):typeof fetch{return async(target,init={})=>{
 const url=new URL(typeof target==='string'?target:target instanceof URL?target.href:target.url);
 if(url.protocol!=='https:'||url.port||url.username||url.password||isIP(url.hostname.replace(/^\[|\]$/g,'')))throw new Error('webhook_destination_denied');
 const allowed=(process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
 if((process.env.NODE_ENV==='production'||allowed.length)&&!allowed.includes(url.hostname.toLowerCase()))throw new Error('webhook_destination_denied');
 const selected=await resolveWebhookAddress(url.hostname,resolver);
 return new Promise<Response>((resolve,reject)=>{
  const headers=new Headers(init.headers);headers.delete('host');headers.delete('connection');headers.delete('proxy-authorization');
  const req=requester(url,{method:init.method||'POST',headers:Object.fromEntries(headers),agent:false,servername:url.hostname,family:selected.family,lookup:((_host:any,_options:any,callback:any)=>callback(null,selected.address,selected.family)) as any,signal:init.signal||undefined,rejectUnauthorized:true},res=>{
   const actual=res.socket.remoteAddress?.replace(/^::ffff:/,'');
   if(actual!==selected.address.replace(/^::ffff:/,'')){res.destroy();reject(new Error('webhook_peer_mismatch'));return;}
   let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>65536)res.destroy(new Error('webhook_response_too_large'));});
   res.on('error',()=>reject(new Error('webhook_response_failed')));
   res.on('end',()=>{const status=res.statusCode||502;if(status>=300&&status<400)reject(new Error('webhook_redirect_denied'));else resolve(new Response(null,{status}));});
  });
  req.setTimeout(5000,()=>req.destroy(new Error('webhook_timeout')));
  req.on('error',()=>reject(new Error('webhook_connection_failed')));
  if(init.body&&typeof init.body!=='string'){req.destroy();reject(new Error('Unsupported webhook body'));return;}
  if(typeof init.body==='string'&&Buffer.byteLength(init.body)>1048576){req.destroy();reject(new Error('Webhook payload too large'));return;}
  req.end(init.body||undefined);
 });
};}
export const pinnedWebhookFetch=createWebhookTransport();
