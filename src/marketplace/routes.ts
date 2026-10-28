import {Router} from 'express';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {access,user,route,fail,type Access} from '../platform/auth';
import {dbAll,dbGet,dbRun,dbTransaction} from '../db/adapter';
import {safeCSV} from '../operations/store';
import {financialSnapshot,analyticsQuery} from '../operations/intelligence';
import {verifyCredential} from '../trust/credentials';
import {catalogFor,activate,deactivate,estimate,limitsFor,setLimit,lockWorkspace,publishPrice,correction,definitions,collection,billingPeriod} from './engine';
import {serviceCatalog} from './catalog';
export const marketplace=Router();
marketplace.get('/organizations/:org/services',route(async(req,res)=>res.json(await catalogFor(await access(req)))));
marketplace.post('/organizations/:org/services/:service/activate',route(async(req,res)=>{const a=await access(req,'admin');res.json(await activate(a,String(req.params.service),req.body));}));
marketplace.post('/organizations/:org/services/:service/deactivate',route(async(req,res)=>{const a=await access(req,'admin');res.json(await deactivate(a,String(req.params.service),req.body));}));
marketplace.patch('/organizations/:org/services/:service/preferences',route(async(req,res)=>{
 const a=await access(req,'admin');if(a.api)fail(403,'Human workspace administrator required');
 const d=z.object({favorite:z.boolean(),position:z.number().int().min(0).max(100)}).strict().parse(req.body);
 await dbTransaction(async()=>{await lockWorkspace(a.org);
 const rows=await dbAll('SELECT service_id FROM ac_service_entitlements WHERE org_id=? AND environment=? ORDER BY position,service_id',[a.org,a.environment]);
 const id=String(req.params.service);if(!rows.some(r=>r.service_id===id))fail(404,'Service not activated');
 const ordered=rows.map(r=>r.service_id).filter(s=>s!==id);ordered.splice(Math.min(d.position,ordered.length),0,id);
 const at=new Date().toISOString();for(let position=0;position<ordered.length;position++)await dbRun('UPDATE ac_service_entitlements SET position=?,updated_at=? WHERE org_id=? AND environment=? AND service_id=?',[position,at,a.org,a.environment,ordered[position]]);
 await dbRun('UPDATE ac_service_entitlements SET favorite=? WHERE org_id=? AND environment=? AND service_id=?',[d.favorite?1:0,a.org,a.environment,id]);
 });res.json(d);
}));
marketplace.get('/organizations/:org/usage',route(async(req,res)=>{
 const a=await access(req),period=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(req.query.period)||billingPeriod();
 const [usage,limits,alerts,statements,reservations]=await Promise.all([estimate(a,period),limitsFor(a),dbAll('SELECT service_id,threshold,kind,created_at FROM ac_usage_alerts WHERE org_id=? AND environment=? AND period=? ORDER BY created_at DESC',[a.org,a.environment,period]),dbAll('SELECT id,period,currency,status,created_at FROM ac_billing_statements WHERE org_id=? AND environment=? ORDER BY period DESC LIMIT 24',[a.org,a.environment]),dbAll("SELECT service_id,COUNT(*) AS operations,SUM(quantity) AS quantity FROM ac_usage_reservations WHERE org_id=? AND environment=? AND status='reserved' GROUP BY service_id",[a.org,a.environment])]);
 res.json({...usage,limits:limits.map(l=>({...l,thresholds:JSON.parse(l.thresholds)})),alerts,statements,pending_reservations:reservations,payment_status:'not_collecting',renewal_date:null});
}));
marketplace.get('/organizations/:org/usage/events',route(async(req,res)=>{
 const a=await access(req),q=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).default(billingPeriod()),offset:z.coerce.number().int().min(0).max(1e6).default(0),service:z.string().regex(/^[a-z][a-z0-9_]{1,60}$/).optional()}).parse(req.query);
 res.json({data:await dbAll('SELECT id,service_id,meter_id,quantity,unit,source,occurred_at,price_id,related_event_id FROM ac_usage_events WHERE org_id=? AND environment=? AND period=?'+(q.service?' AND service_id=?':'')+' ORDER BY occurred_at DESC,id DESC LIMIT 100 OFFSET ?',[a.org,a.environment,q.period,...(q.service?[q.service]:[]),q.offset]),offset:q.offset,limit:100});
}));
marketplace.put('/organizations/:org/usage/limits/:service',route(async(req,res)=>res.json(await setLimit(await access(req,'admin'),String(req.params.service),req.body))));
marketplace.get('/organizations/:org/usage/export',route(async(req,res)=>{
 const a=await access(req),period=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.period);
 const rows=await dbAll('SELECT id,service_id,quantity,unit,period,occurred_at,source,price_id FROM ac_usage_events WHERE org_id=? AND environment=? AND period=? ORDER BY occurred_at,id LIMIT 10000',[a.org,a.environment,period]);
 const fields=['id','service_id','quantity','unit','period','occurred_at','source','price_id'];res.setHeader('Content-Disposition','attachment; filename="africore-usage-'+period+'.csv"');res.type('text/csv').send([fields.join(','),...rows.map(r=>fields.map(k=>safeCSV(r[k])).join(','))].join('\n'));
}));
marketplace.post('/organizations/:org/billing/statements',route(async(req,res)=>{
 const a=await access(req,'admin');if(a.api)fail(403,'Human workspace administrator required');const d=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)}).strict().parse(req.body);
 const result=await dbTransaction(async()=>{await lockWorkspace(a.org);const snapshot=await estimate(a,d.period),id=randomUUID();await dbRun('INSERT INTO ac_billing_statements(id,org_id,environment,period,currency,status,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,period,currency) DO NOTHING',[id,a.org,a.environment,d.period,'KES','frozen_estimate',JSON.stringify(snapshot),new Date().toISOString()]);return dbGet('SELECT id,status,period FROM ac_billing_statements WHERE org_id=? AND environment=? AND period=? AND currency=?',[a.org,a.environment,d.period,'KES']);});res.json({...result,collection_enabled:false,message:'Estimate snapshot saved. This is not a payable invoice.'});
}));
marketplace.get('/organizations/:org/billing/statements/:id',route(async(req,res)=>{
 const a=await access(req),row=await dbGet('SELECT * FROM ac_billing_statements WHERE id=? AND org_id=? AND environment=?',[String(req.params.id),a.org,a.environment]);if(!row)fail(404,'Statement not found');res.json({id:row.id,status:row.status,...JSON.parse(row.snapshot),payment_status:'not_collecting'});
}));
marketplace.get('/organizations/:org/overview',route(async(req,res)=>{const a=await access(req);res.json(await financialSnapshot(a,analyticsQuery.parse(req.query)));}));
marketplace.post('/organizations/:org/verification',route(async(req,res)=>{await access(req);const d=z.object({credential:z.string().min(20).max(100000),issuer_jwk:z.record(z.string(),z.unknown()).optional()}).strict().parse(req.body);res.json(await verifyCredential(d.credential,d.issuer_jwk));}));
async function internal(req:any):Promise<Access>{const u=await user(req),allowed=(process.env.AFRICORE_ENGINEERING_EMAILS||'').split(',').map(s=>s.trim().toLowerCase());if(!u.verified||!allowed.includes(u.email))fail(403,'Verified internal engineering allowlist required');return {actor:u.id,org:String(req.params.org||'platform'),environment:z.enum(['sandbox','production']).parse(req.headers['x-environment']||'sandbox'),role:'operator',api:false};}
marketplace.get('/internal/services/admin',route(async(req,res)=>{await internal(req);res.json({services:await definitions(),prices:(await dbAll('SELECT * FROM ac_service_prices ORDER BY created_at DESC')).map(p=>({id:p.id,...JSON.parse(p.data)})),usage:await dbAll('SELECT service_id,period,SUM(quantity) AS quantity FROM ac_usage_events GROUP BY service_id,period'),pending:await dbAll("SELECT id,org_id,environment,service_id,quantity,created_at FROM ac_usage_reservations WHERE status='reserved' ORDER BY created_at LIMIT 100"),collection_enabled:collection.enabled});}));
marketplace.post('/internal/services/prices',route(async(req,res)=>res.status(201).json(await publishPrice(await internal(req),req.body))));
marketplace.post('/internal/services/definitions',route(async(req,res)=>{
 const a=await internal(req);const d=z.object({id:z.string().regex(/^[a-z][a-z0-9_]{1,60}$/),expected_version:z.number().int().min(0),enabled:z.boolean(),name:z.string().min(2).max(100),description:z.string().min(10).max(300),detail:z.string().min(10).max(1500),availability:z.enum(['available','evaluation','requires_configuration','unavailable'])}).strict().parse(req.body);
 const base=serviceCatalog.find(s=>s.id===d.id);if(!base)fail(400,'New executable product IDs require a reviewed registry/route change');
 const result=await dbTransaction(async()=>{const row=await dbGet('SELECT * FROM ac_services WHERE id=?',[d.id]);if(!row||Number(row.version)!==d.expected_version)fail(409,'Service version changed');const version=Number(row.version)+1,definition={...JSON.parse(row.definition),name:d.name,description:d.description,detail:d.detail,availability:d.availability,version};const changed=await dbRun('UPDATE ac_services SET definition=?,enabled=?,version=?,updated_at=? WHERE id=? AND version=?',[JSON.stringify(definition),d.enabled?1:0,version,new Date().toISOString(),d.id,d.expected_version]);if(!changed.changes)fail(409,'Service version changed');await dbRun('INSERT INTO ac_service_history(id,org_id,environment,service_id,actor,action,data,created_at) VALUES (?,?,?,?,?,?,?,?)',[randomUUID(),'platform','sandbox',d.id,a.actor,'definition.updated',JSON.stringify({version,enabled:d.enabled}),new Date().toISOString()]);return definition;});res.json(result);
}));
marketplace.post('/internal/services/workspaces/:org/:service/suspend',route(async(req,res)=>{
 const a=await internal(req),d=z.object({reason:z.string().min(10).max(500)}).strict().parse(req.body);await dbTransaction(async()=>{await lockWorkspace(a.org);await dbRun("UPDATE ac_service_entitlements SET status='suspended',updated_at=? WHERE org_id=? AND environment=? AND service_id=?",[new Date().toISOString(),a.org,a.environment,String(req.params.service)]);await dbRun('INSERT INTO ac_service_history(id,org_id,environment,service_id,actor,action,data,created_at) VALUES (?,?,?,?,?,?,?,?)',[randomUUID(),a.org,a.environment,String(req.params.service),a.actor,'suspended',JSON.stringify(d),new Date().toISOString()]);});res.json({status:'suspended'});
}));
marketplace.post('/internal/services/workspaces/:org/usage/:event/correct',route(async(req,res)=>{const a=await internal(req),d=z.object({quantity:z.number().int().positive().max(1e9),reason:z.string().min(10).max(500)}).strict().parse(req.body);res.json(await correction(a,String(req.params.event),d.quantity,d.reason));}));
marketplace.post('/internal/services/workspaces/:org/reservations/:reservation/release',route(async(req,res)=>{const a=await internal(req),d=z.object({reason:z.string().min(10).max(500)}).strict().parse(req.body);await dbTransaction(async()=>{await lockWorkspace(a.org);const result=await dbRun("UPDATE ac_usage_reservations SET status='reviewed_release',updated_at=? WHERE id=? AND org_id=? AND environment=? AND status='reserved'",[new Date().toISOString(),String(req.params.reservation),a.org,a.environment]);if(!result.changes)fail(409,'Reservation is not pending');await dbRun('INSERT INTO ac_service_history(id,org_id,environment,service_id,actor,action,data,created_at) VALUES (?,?,?,?,?,?,?,?)',[randomUUID(),a.org,a.environment,'all',a.actor,'reservation.reviewed',JSON.stringify({...d,reservation:String(req.params.reservation)}),new Date().toISOString()]);});res.json({released:true,usage_deleted:false});}));
