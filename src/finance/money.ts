/** Integer minor units throughout the financial domain. No implicit FX. */
export const currencyDigits: Record<string, number> = {KES:2,USD:2,EUR:2,GBP:2,UGX:0,TZS:2,RWF:0};
export function exactNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw Object.assign(new Error('Financial amount exceeds supported precision'), {status:400});
  return Number(value);
}
export function sumMinor(values: (number|string)[]) {return exactNumber(values.reduce<bigint>((n,v)=>n+BigInt(v),0n));}
export function basisPoints(amount: number, bps: number) {return exactNumber((BigInt(amount)*BigInt(bps)+5000n)/10000n);}
export function parseMoney(value: string, currency: string) {
  const digits=currencyDigits[currency];
  if(digits===undefined || !/^\d+(?:\.\d+)?$/.test(value))throw new Error('Enter a supported currency and decimal amount');
  const [whole,fraction='']=value.split('.');
  if(fraction.length>digits)throw new Error('Too many decimal places for '+currency);
  return exactNumber(BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0')||'0'));
}
export function nextOccurrence(date:string, recurrence:string, anchorDay=Number(date.slice(8))) {
  if(recurrence==='once')return null;
  const d=new Date(date+'T00:00:00Z');
  if(recurrence==='weekly'){d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,10);}
  const months=({monthly:1,quarterly:3,yearly:12} as Record<string,number>)[recurrence];
  if(!months)throw new Error('Unsupported recurrence');
  const target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(anchorDay,last));return target.toISOString().slice(0,10);
}

export function parsePercent(value:string){if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(value))throw new Error('Use a percentage with up to two decimal places');const [whole,fraction='']=value.split('.'),bps=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(bps>10000)throw new Error('Tax rate must be between 0 and 100 percent');return bps;}
