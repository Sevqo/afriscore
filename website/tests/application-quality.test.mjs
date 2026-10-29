import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerSessions} from '../src/accounts/security-sessions.ts';
import {describeSession,sessionDate} from '../src/accounts/session-presentation.ts';
import {allowanceLabel,selectUsage} from '../src/marketplace/usage-presentation.ts';
test('session cards distinguish browser hints without leaking headers or inventing models',()=>{
 assert.equal(describeSession('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605 Safari/604.1'),'iPhone · Safari');
 assert.equal(describeSession('Mozilla Windows Chrome/120 Edg/120'),'Windows device · Edge');
 assert.equal(describeSession(null),'Authenticated session');assert.equal(sessionDate('invalid'),'Unavailable');
});
test('provider sessions keep revocation handles out of view models and fail closed',async()=>{
 const calls=[];let failure=false;const client={getSession:async()=>({data:{session:{id:'current'}}}),listSessions:async()=>({data:[{id:'current',token:'private-current'},{id:'other',token:'private-other',userAgent:'iPhone Safari'}]}),revokeSession:async input=>{calls.push(input);return failure?{error:{message:'Denied'}}:{data:{status:true}};},revokeOtherSessions:async()=>failure?{error:{message:'Denied'}}:{data:{status:true}}};
 const controller=providerSessions(client),rows=await controller.load();assert.equal(rows[0].current,true);assert.equal(rows[1].can_revoke,true);assert.ok(!JSON.stringify(rows).includes('private-'));
 await assert.rejects(controller.revoke('current'),/Refresh/);await assert.rejects(controller.revoke('unknown'),/Refresh/);failure=true;await assert.rejects(controller.revoke('other'),/Denied/);await assert.rejects(controller.revokeOthers(),/Denied/);failure=false;await controller.revoke('other');assert.deepEqual(calls[1],{token:'private-other'});await assert.rejects(controller.revoke('other'),/Refresh/);
});
test('free allowances are not advertised as unlimited; usage filters precede stable sorting and paging',()=>{
 assert.equal(allowanceLabel({model:'free',included:0}),'Free · no usage limit configured');assert.equal(allowanceLabel({model:'allowance',included:1000,remaining_allowance:250}),'250 of 1,000 remaining');
 const services=[{id:'a',name:'Invoices',category:'Finance'},{id:'b',name:'Clients',category:'Business'}],lines=[{service_id:'a',price_id:'1',unit:'issued invoices',quantity:1,estimated_minor:20},{service_id:'b',price_id:'2',unit:'customers',quantity:5,estimated_minor:0}];
 assert.equal(selectUsage(lines,services,'invoice','Finance','charges')[0].service_id,'a');assert.equal(selectUsage(lines,services,'','all','usage')[0].service_id,'b');assert.equal(selectUsage(lines,services,'missing','all','name').length,0);assert.equal(lines[0].service_id,'a');
});
test('installed Neon vanilla SDK uses real provider session endpoints',async()=>{
 const original=globalThis.fetch;const paths=[];
 const jwt='eyJhbGciOiJFZERTQSJ9.'+Buffer.from(JSON.stringify({exp:Date.now()/1000+900})).toString('base64url')+'.fixture';
 globalThis.fetch=async(input,init)=>{const path=new URL(String(input instanceof Request?input.url:input)).pathname;paths.push(path);let data=path.endsWith('/get-session')?{user:{id:'user'},session:{id:'current',token:'opaque',expiresAt:new Date(Date.now()+86400000).toISOString()}}:path.endsWith('/list-sessions')?[{id:'current',token:'current-handle'},{id:'other',token:'other-handle'}]:{status:true};return Response.json(data,{headers:{'set-auth-jwt':jwt}});};
 try{const {createAuthClient}=await import('@neondatabase/auth');const {BetterAuthVanillaAdapter}=await import('@neondatabase/auth/vanilla');const client=createAuthClient('https://auth.example.invalid',{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include'}})});const controller=providerSessions(client);const rows=await controller.load();assert.equal(rows[0].current,true);await controller.revoke('other');await controller.revokeOthers();assert.ok(paths.some(p=>p.endsWith('/revoke-session')));assert.ok(paths.some(p=>p.endsWith('/revoke-other-sessions')));}finally{globalThis.fetch=original;}
});

test('password changes require confirmation and current credentials, revoke other sessions and surface provider denial',async()=>{
 const {changeAccountPassword}=await import('../src/accounts/security-password.ts');let calls=[];const client={changePassword:async input=>{calls.push(input);return {data:{}};}};
 await assert.rejects(changeAccountPassword(client,'old','12345678','different'),/match/);await assert.rejects(changeAccountPassword(client,'old','short','short'),/between/);await assert.rejects(changeAccountPassword(client,'','12345678','12345678'),/current/);assert.equal(calls.length,0);
 await changeAccountPassword(client,'old','new-password','new-password');assert.deepEqual(calls[0],{currentPassword:'old',newPassword:'new-password',revokeOtherSessions:true});await assert.rejects(changeAccountPassword({changePassword:async()=>({error:{message:'Incorrect password'}})},'old','new-password','new-password'),/Incorrect/);await assert.rejects(changeAccountPassword(null,'old','new-password','new-password'),/recovery/);
});
