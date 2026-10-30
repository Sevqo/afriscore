import type {API} from '../operations/UI';
/** Failed writes retain their key; concurrent identical submissions share one request. */
export function createWriteIntents(provided:API,scope:string,makeKey:()=>string=()=>crypto.randomUUID()){
 const intents=new Map<string,{key:string;pending?:Promise<any>}>();
 const call:API=async(path,method='GET',body,headers)=>{
  if(['GET','HEAD'].includes(method))return provided(path,method,body,headers);
  const fingerprint=JSON.stringify([scope,path,method,body]);let intent=intents.get(fingerprint);
  if(!intent){if(intents.size>=64)throw Error('Too many unconfirmed operations. Retry or verify an existing operation before starting more.');intent={key:makeKey()};intents.set(fingerprint,intent);}
  if(intent.pending)return intent.pending;const current=intent;
  current.pending=Promise.resolve().then(()=>provided(path,method,body,{...headers,'Idempotency-Key':current.key})).then(result=>{if(intents.get(fingerprint)===current)intents.delete(fingerprint);return result;}).finally(()=>{current.pending=undefined;});
  return current.pending;
 };
 return {call,clear:()=>intents.clear()};
}
