/** Exact quantities are integer thousandths of the explicitly named product unit. */
export function quantityMilli(value:string|number):number {
 const text=String(value).trim();if(!/^\d{1,9}(?:\.\d{1,3})?$/.test(text))throw Object.assign(new Error('Quantity must have at most three decimal places'),{status:400});
 const [whole,fraction='']=text.split('.'),milli=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));if(milli>1000000000000n)throw Object.assign(new Error('Quantity exceeds supported precision'),{status:400});return Number(milli);
}
export const displayQuantity=(milli:number)=>{if(!Number.isSafeInteger(milli))throw new Error('Invalid stored quantity');return (milli/1000).toFixed(3).replace(/\.?0+$/,'')||'0';};
