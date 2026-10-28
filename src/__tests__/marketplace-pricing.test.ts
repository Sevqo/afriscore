import test from 'node:test';
import assert from 'node:assert/strict';
import {costMinor,priceInput,type Price} from '../marketplace/pricing';
const base:Price={service_id:'invoicing',version:'test-v1',currency:'KES',model:'free',unit:'issued invoices',included:0,fixed_minor:0,unit_minor:10,tiers:[],minimum_minor:0,cap_minor:null,period:'monthly',effective_at:'2026-10-28T00:00:00.000Z',expires_at:null,tax_treatment:'Synthetic test only.',description:'Synthetic price; never published.'};
test('pricing computes free, flat, metered, allowance and hybrid in minor units',()=>{
 assert.equal(costMinor(base,999),0);
 assert.equal(costMinor({...base,model:'flat',fixed_minor:500},100),500);
 assert.equal(costMinor({...base,model:'metered'},3),30);
 assert.equal(costMinor({...base,model:'allowance',included:5},4),0);
 assert.equal(costMinor({...base,model:'allowance',included:5},7),20);
 assert.equal(costMinor({...base,model:'hybrid',fixed_minor:100,included:5},7),120);
});
test('graduated tiers charge incremental quantities and retain included allowance',()=>{
 const price:Price={...base,model:'tiered',included:2,tiers:[{up_to:5,unit_minor:10},{up_to:10,unit_minor:8},{up_to:null,unit_minor:5}]};
 assert.equal(costMinor(price,0),0);
 assert.equal(costMinor(price,7),50);
 assert.equal(costMinor(price,14),100);
 assert.throws(()=>priceInput.parse({...price,tiers:[{up_to:10,unit_minor:1},{up_to:5,unit_minor:1},{up_to:null,unit_minor:1}]}));
});
test('minimum, cap, expiry and safe integer boundaries fail or bound explicitly',()=>{
 assert.equal(costMinor({...base,model:'metered',minimum_minor:50,cap_minor:100},1),50);
 assert.equal(costMinor({...base,model:'metered',minimum_minor:50,cap_minor:100},100),100);
 assert.equal(costMinor({...base,model:'metered',minimum_minor:50},0),0);
 assert.throws(()=>costMinor({...base,model:'metered',unit_minor:1000000000},Number.MAX_SAFE_INTEGER));
 assert.throws(()=>costMinor(base,-1));
 assert.throws(()=>costMinor(base,0.5));
 assert.throws(()=>priceInput.parse({...base,expires_at:base.effective_at}));
 assert.throws(()=>priceInput.parse({...base,minimum_minor:100,cap_minor:10}));
});
