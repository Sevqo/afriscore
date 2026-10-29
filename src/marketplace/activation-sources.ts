import {dbRun,dbAll} from '../db/adapter';
import type {Access} from '../platform/auth';
export type ActivationSource={type:'direct'|'app';id:string};
export async function activationSource(a:Access,service:string,source:ActivationSource={type:'direct',id:'direct'}){
 return dbRun('INSERT INTO ac_service_activation_sources(org_id,environment,service_id,source_type,source_id,actor,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,service_id,source_type,source_id) DO NOTHING',[a.org,a.environment,service,source.type,source.id,a.actor,new Date().toISOString()]);
}
export async function activeAppSources(a:Access,service:string){return dbAll("SELECT s.source_id FROM ac_service_activation_sources s JOIN ac_app_installations i ON i.org_id=s.org_id AND i.environment=s.environment AND i.app_id=s.source_id WHERE s.org_id=? AND s.environment=? AND s.service_id=? AND s.source_type='app' AND i.status='installed'",[a.org,a.environment,service]);}
