import {z} from 'zod';
const integer=z.number().int().min(0).max(1_000_000_000);
export const priceInput=z.object({service_id:z.string().regex(/^[a-z][a-z0-9_]{1,60}$/),version:z.string().regex(/^[a-zA-Z0-9._-]{1,60}$/),currency:z.literal('KES'),model:z.enum(['free','flat','metered','allowance','tiered','hybrid']),unit:z.string().min(1).max(100),included:integer,fixed_minor:integer,unit_minor:integer,tiers:z.array(z.object({up_to:integer.positive().nullable(),unit_minor:integer}).strict()).max(20),minimum_minor:integer,cap_minor:integer.nullable(),period:z.literal('monthly'),effective_at:z.string().datetime(),expires_at:z.string().datetime().nullable(),tax_treatment:z.string().min(5).max(300),description:z.string().min(5).max(500)}).strict().superRefine((p,ctx)=>{
 if(p.expires_at&&p.expires_at<=p.effective_at)ctx.addIssue({code:'custom',message:'Expiry must follow effective date'});
 if(p.cap_minor!==null&&p.minimum_minor>p.cap_minor)ctx.addIssue({code:'custom',message:'Minimum exceeds cap'});
 if(p.model==='tiered'){
  let previous=0;
  if(!p.tiers.length||p.tiers.at(-1)?.up_to!==null)ctx.addIssue({code:'custom',message:'Graduated tiers must end with an open tier'});
  p.tiers.forEach((tier,index)=>{if(tier.up_to===null&&index!==p.tiers.length-1||tier.up_to!==null&&tier.up_to<=previous)ctx.addIssue({code:'custom',message:'Tier boundaries must increase'});if(tier.up_to!==null)previous=tier.up_to;});
 }
});
export type Price=z.infer<typeof priceInput>;
export function costMinor(input:Price,quantity:number,includeFixed=true){
 const p=priceInput.parse(input);
 if(!Number.isSafeInteger(quantity)||quantity<0)throw new Error('Invalid aggregate usage');
 if(p.model==='free')return 0;
 let billable=BigInt(Math.max(0,quantity-(['allowance','hybrid','tiered'].includes(p.model)?p.included:0))),amount=0n;
 if(p.model==='tiered'){
  let previous=0n;
  for(const tier of p.tiers){const span=tier.up_to===null?billable:BigInt(tier.up_to)-previous;const units=billable<span?billable:span;amount+=units*BigInt(tier.unit_minor);billable-=units;if(tier.up_to!==null)previous=BigInt(tier.up_to);if(!billable)break;}
 }else if(p.model!=='flat')amount=billable*BigInt(p.unit_minor);
 if(includeFixed&&['flat','hybrid'].includes(p.model))amount+=BigInt(p.fixed_minor);
 if(amount>0n&&amount<BigInt(p.minimum_minor))amount=BigInt(p.minimum_minor);
 if(p.cap_minor!==null&&amount>BigInt(p.cap_minor))amount=BigInt(p.cap_minor);
 if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Price exceeds supported integer precision');
 return Number(amount);
}
