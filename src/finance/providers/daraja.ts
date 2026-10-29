import {z} from 'zod';
export const darajaConfiguration=z.object({consumer_key:z.string().min(8).max(300),consumer_secret:z.string().min(8).max(500),shortcode:z.string().regex(/^\d{5,8}$/),passkey:z.string().min(16).max(500),transaction_type:z.enum(['CustomerPayBillOnline','CustomerBuyGoodsOnline']).default('CustomerPayBillOnline')}).strict();
export type DarajaConfiguration=z.infer<typeof darajaConfiguration>;
export function kenyanPhone(value:string){const digits=value.replace(/[+\s()-]/g,'');const normalized=/^0[17]\d{8}$/.test(digits)?'254'+digits.slice(1):digits;if(!/^254[17]\d{8}$/.test(normalized))throw Object.assign(new Error('Enter a valid Kenyan mobile number'),{status:400});return normalized;}
/** Sandbox-only adapter. Acknowledgement is not confirmation. Never retries an ambiguous initiation. */
export class DarajaSandbox {
 private token?:{value:string;expires:number};private tokenFlight?:Promise<string>;
 readonly capabilities={mode:'sandbox',currencies:['KES'],initiate:true,lookup:true,c2b:false,refund:false,reversal:false,live:false};
 constructor(private configuration:DarajaConfiguration,private transport:typeof fetch=fetch,private clock=()=>new Date()){darajaConfiguration.parse(configuration);}
 private async request(path:string,init:RequestInit){
  try{const response=await this.transport('https://sandbox.safaricom.co.ke'+path,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('provider_http_'+response.status);return await response.json() as any;}catch(error){throw Object.assign(new Error('Daraja sandbox request unavailable; inspect the persisted attempt before retrying'),{status:503,code:'provider_unavailable'});}
 }
 private async bearer(){
  if(this.token&&this.token.expires>Date.now())return this.token.value;if(this.tokenFlight)return this.tokenFlight;
  this.tokenFlight=(async()=>{const data=await this.request('/oauth/v1/generate?grant_type=client_credentials',{method:'GET',headers:{Authorization:'Basic '+Buffer.from(this.configuration.consumer_key+':'+this.configuration.consumer_secret).toString('base64')}});const parsed=z.object({access_token:z.string().min(1),expires_in:z.coerce.number().int().positive()}).parse(data);this.token={value:parsed.access_token,expires:Date.now()+Math.max(0,parsed.expires_in-60)*1000};return parsed.access_token;})();
  try{return await this.tokenFlight;}finally{this.tokenFlight=undefined;}
 }
 private signing(){const timestamp=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(this.clock());const part=(key:string)=>timestamp.find(p=>p.type===key)?.value;const stamp=['year','month','day','hour','minute','second'].map(part).join('');return {Timestamp:stamp,Password:Buffer.from(this.configuration.shortcode+this.configuration.passkey+stamp).toString('base64')};}
 async initiate(input:{amount_minor:number;currency:string;phone:string;reference:string;callback_url:string}){
  if(input.currency!=='KES'||!Number.isSafeInteger(input.amount_minor)||input.amount_minor<=0||input.amount_minor%100!==0)throw Object.assign(new Error('Daraja requires a positive whole-shilling KES amount'),{status:400});
  const callback=new URL(input.callback_url);if(callback.protocol!=='https:'||callback.username||callback.password||callback.search||callback.hash)throw new Error('A trusted HTTPS callback is required');
  const phone=kenyanPhone(input.phone),data=await this.request('/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:'Bearer '+await this.bearer(),'Content-Type':'application/json'},body:JSON.stringify({BusinessShortCode:this.configuration.shortcode,...this.signing(),TransactionType:this.configuration.transaction_type,Amount:input.amount_minor/100,PartyA:phone,PartyB:this.configuration.shortcode,PhoneNumber:phone,CallBackURL:callback.href,AccountReference:input.reference.slice(0,12),TransactionDesc:'AfriCore test payment'})});
  const result=z.object({ResponseCode:z.coerce.string(),CheckoutRequestID:z.string().min(1).max(200),MerchantRequestID:z.string().min(1).max(200)}).parse(data);if(result.ResponseCode!=='0')throw Object.assign(new Error('Daraja did not accept this test request'),{status:502});
  return {status:'pending' as const,checkout_id:result.CheckoutRequestID,merchant_id:result.MerchantRequestID};
 }
 async lookup(checkoutId:string){
  z.string().min(1).max(200).parse(checkoutId);const data=await this.request('/mpesa/stkpushquery/v1/query',{method:'POST',headers:{Authorization:'Bearer '+await this.bearer(),'Content-Type':'application/json'},body:JSON.stringify({BusinessShortCode:this.configuration.shortcode,...this.signing(),CheckoutRequestID:checkoutId})});
  if(data.CheckoutRequestID!==checkoutId)throw Object.assign(new Error('Daraja checkout identity mismatch'),{status:502});
  if(data.ResultCode===undefined)return {status:'pending' as const};
  const code=String(data.ResultCode);return {status:code==='0'?'succeeded' as const:['1032','1037','1'].includes(code)?'failed' as const:'pending' as const,result_code:code};
 }
}
