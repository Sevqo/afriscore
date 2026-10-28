/** Legacy analytics must never silently add unlike currency units. */
export function singleCurrency(rows:ReadonlyArray<{currency?:string}>,fallback='KES'){
 const currencies=[...new Set(rows.map(row=>row.currency||fallback))];
 if(currencies.some(value=>!/^[A-Z]{3}$/.test(value)))throw Object.assign(new Error('Invalid source currency'),{status:422});
 if(currencies.length>1)throw Object.assign(new Error('Mixed currencies require separate currency reports; no conversion is performed'),{status:422});
 return currencies[0]||fallback;
}
