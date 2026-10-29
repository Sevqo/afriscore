import {dbAll,dbGet,dbRun,dbTransaction} from '../db';
import {now} from '../platform/crypto';
import {capture} from './events';
import {atomic} from './store';
import {evaluateIntelligenceAlerts} from './alerts';
import type {Access} from '../platform/auth';
/** Same durable worker as existing operations; no browser or external message dependency. */
export async function purgeExpiredConversations(at=now()){return dbTransaction(async()=>{await dbRun('DELETE FROM ac_assistant_messages WHERE conversation_id IN (SELECT id FROM ac_assistant_conversations WHERE expires_at<=?)',[at]);return dbRun('DELETE FROM ac_assistant_conversations WHERE expires_at<=?',[at]);});}
export async function processIntelligencePolicy(a:Access,at=new Date()){const p=await dbGet('SELECT configuration,updated_at FROM ac_intelligence_policies WHERE org_id=? AND environment=?',[a.org,a.environment]);if(!p||!JSON.parse(p.configuration).enabled)return {created:0};const hour=at.toISOString().slice(0,13);if(await dbGet('SELECT id FROM ac2_events WHERE org_id=? AND environment=? AND dedupe_key=?',[a.org,a.environment,'intelligence-hour:'+hour+':'+p.updated_at]))return {created:0};return atomic(a,async()=>{const marker=await capture(a,'intelligence.rules_evaluated',{classification:'configured_threshold_review'},{key:'intelligence-hour:'+hour+':'+p.updated_at});return marker.inserted?evaluateIntelligenceAlerts(a):{created:0};});}
