import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configureTestEnv} from './helpers';
configureTestEnv('application-refinement');
import {migrate,closeDb,dbGet} from '../db';
import {createApp} from '../app';
let server:ReturnType<ReturnType<typeof createApp>['listen']>,base:string;
before(async()=>{await migrate();server=createApp().listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+(server.address() as {port:number}).port;});
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await closeDb();});
async function req(path:string,method='GET',body?:unknown,cookie=''){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(body??{})});return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
async function identity(){const email=randomUUID()+'@example.test';const result=await req('/api/auth/signup','POST',{email,password:'Private-test-identity-2026!'});assert.equal(result.status,201);await req('/api/auth/verify','POST',{token:result.data.verification_token});return {...result,email};}
async function workspace(cookie:string,kind='business'){const r=await req('/api/auth/workspaces','POST',{kind,name:'Isolated refinement '+kind,display_name:'Test owner',country:'KE',currency:'KES',timezone:'Africa/Nairobi'},cookie);assert.equal(r.status,201);return '/api/v1/organizations/'+r.data.id;}
test('team invitation renewal/revocation, member roles and removal enforce current tenant access and the final owner',async()=>{
 const owner=await identity(),member=await identity(),stranger=await identity(),org=await workspace(owner.cookie),otherOrg=await workspace(stranger.cookie);
 const invite=await req(org+'/invitations','POST',{email:member.email,role:'viewer'},owner.cookie);assert.equal(invite.status,201);
 assert.equal((await req(org+'/invitations','POST',{email:member.email,role:'viewer'},owner.cookie)).status,409);
 assert.equal((await req(otherOrg+'/invitations/'+invite.data.id,'PATCH',{},stranger.cookie)).status,409);
 const renewed=await req(org+'/invitations/'+invite.data.id,'PATCH',{},owner.cookie);assert.equal(renewed.status,200);
 assert.equal((await req('/api/v1/invitations/accept','POST',{token:invite.data.token},member.cookie)).status,400);
 assert.equal((await req('/api/v1/invitations/accept','POST',{token:renewed.data.token},member.cookie)).status,200);
 const directory=await req(org+'/team','GET',undefined,owner.cookie);assert.equal(directory.data.data.length,2);const target=directory.data.data.find((r:any)=>r.email===member.email),founder=directory.data.data.find((r:any)=>r.email===owner.email);
 assert.equal((await req(org+'/team/'+founder.id,'PATCH',{role:'admin'},member.cookie)).status,403);
 assert.equal((await req(org+'/team/'+founder.id,'DELETE',undefined,owner.cookie)).status,409);
 assert.equal((await req(org+'/team/'+target.id,'PATCH',{role:'finance'},owner.cookie)).status,200);
 assert.equal((await req(org+'/team/'+target.id,'DELETE',undefined,owner.cookie)).status,200);
 assert.equal((await req(org+'/team','GET',undefined,member.cookie)).status,403);
 const revoked=await req(org+'/invitations','POST',{email:member.email,role:'viewer'},owner.cookie);assert.equal(revoked.status,201);assert.equal((await req(org+'/invitations/'+revoked.data.id,'DELETE',undefined,owner.cookie)).status,200);assert.equal((await req('/api/v1/invitations/accept','POST',{token:revoked.data.token},member.cookie)).status,400);
 assert.equal(Number((await dbGet("SELECT COUNT(*) AS n FROM ac_audit WHERE org_id=? AND action='membership.removed'",[org.split('/').at(-1)])).n),1);
});
test('personal dated activity agrees with persisted source totals and obligations support editing and completion',async()=>{
 const owner=await identity(),personal=await workspace(owner.cookie,'personal'),business=await workspace(owner.cookie);
 assert.equal((await req(personal+'/personal-income','POST',{description:'Recorded work',amount_minor:10000,currency:'KES',occurred_on:'2026-10-01'},owner.cookie)).status,201);
 assert.equal((await req(personal+'/expenses','POST',{description:'Recorded supplies',amount_minor:2500,currency:'KES',occurred_on:'2026-10-01',category:'stock'},owner.cookie)).status,201);
 const summary=await req(personal+'/personal-summary?currency=KES&from=2026-10-01&to=2026-10-01','GET',undefined,owner.cookie);assert.equal(summary.data.recorded_net_minor,7500);assert.deepEqual(summary.data.series,[{date:'2026-10-01',income:10000,expenses:2500,net:7500}]);
 assert.equal((await req(personal+'/personal-summary?currency=KES&from=2026-10-02&to=2026-10-03','GET',undefined,owner.cookie)).data.series.length,0);
 const obligation=await req(business+'/obligations','POST',{description:'Rent',amount_minor:5000,currency:'KES',next_due_date:'2026-11-01',recurrence:'monthly'},owner.cookie);assert.equal(obligation.status,201);
 assert.equal((await req(business+'/obligations/'+obligation.data.id,'PATCH',{description:'Office rent',amount_minor:6000,next_due_date:'2026-11-02',status:'completed'},owner.cookie)).status,200);
 const rows=await req(business+'/obligations','GET',undefined,owner.cookie);assert.equal(rows.data.data[0].status,'completed');assert.equal(rows.data.data[0].amount_minor,6000);
});
test('normal signed-in navigation cannot exhaust the credential-attempt bucket, while guessing remains limited',async()=>{
 const owner=await identity();
 for(let i=0;i<45;i++)assert.equal((await req('/api/auth/account','GET',undefined,owner.cookie)).status,200);
 let limited=false;for(let i=0;i<45;i++){const response=await req('/api/auth/signin','POST',{email:'absent@example.test',password:'invalid-identity-password'});if(response.status===429){limited=true;break;}}
 assert.equal(limited,true);assert.equal((await req('/api/auth/account','GET',undefined,owner.cookie)).status,200);
});
