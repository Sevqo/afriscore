type Entry = { value?: unknown; expires: number; pending?: Promise<unknown>; generation: number; controller:AbortController };
/** Memory-only cache. No bearer tokens, capabilities, keys or browser persistence. */
export class QueryCache {
  private entries = new Map<string,Entry>();
  private generation=0;
  private now:()=>number;
  private ttl:number;
  constructor(now=()=>Date.now(),ttl=15000){this.now=now;this.ttl=ttl;}
  async read<T>(key:string,load:(signal:AbortSignal)=>Promise<T>):Promise<T>{
    const existing=this.entries.get(key);
    if(existing?.value!==undefined&&existing.expires>this.now())return structuredClone(existing.value) as T;
    if(existing?.pending)return existing.pending as Promise<T>;
    const entry:Entry={expires:0,generation:this.generation,controller:new AbortController()};
    entry.pending=load(entry.controller.signal).then(value=>{if(this.entries.get(key)===entry&&entry.generation===this.generation){entry.value=structuredClone(value);entry.expires=this.now()+this.ttl;entry.pending=undefined;}return value;}).catch(error=>{if(this.entries.get(key)===entry)this.entries.delete(key);throw error;});
    this.entries.set(key,entry);
    if(this.entries.size>100)this.entries.delete(this.entries.keys().next().value!);
    return entry.pending as Promise<T>;
  }
  clear(){this.generation++;for(const entry of this.entries.values())entry.controller.abort();this.entries.clear();}
  invalidate(matches:(key:string)=>boolean){for(const key of this.entries.keys())if(matches(key))this.entries.delete(key);}
  cancelPending(matches:(key:string)=>boolean){for(const [key,entry]of this.entries)if(entry.pending&&matches(key)){entry.controller.abort();this.entries.delete(key);}}
  peek<T>(key:string):T|undefined{const entry=this.entries.get(key);return entry?.value!==undefined&&entry.expires+45000>this.now()?structuredClone(entry.value) as T:undefined;}
}
export const protectedQueries=new QueryCache();
let identity:string|null=null;
export function setQueryIdentity(next:string|null){if(next!==identity){protectedQueries.clear();identity=next;}}
export const queryIdentity=()=>identity;
export function clearPrivateQueries(){protectedQueries.clear();identity=null;}
export function queryKey(identity:string,environment:string,path:string){return JSON.stringify([identity,environment,path]);}
export function invalidateWorkspace(path:string,environment:string){const root=/^\/api\/v1\/organizations\/[^/]+/.exec(path)?.[0];if(!root){protectedQueries.clear();return;}protectedQueries.invalidate(key=>{const parts=JSON.parse(key);return parts[1]===environment&&parts[2].startsWith(root+'/');});}
export function cancelOtherWorkspaceReads(path:string,environment:string){protectedQueries.cancelPending(key=>{const parts=JSON.parse(key);return parts[1]!==environment||!parts[2].startsWith(path+'/');});}
export function peekQuery<T=unknown>(path:string,environment:string,demo=false){const subject=demo?'isolated-browser-demo':identity;return subject&&cacheable(path)?protectedQueries.peek<T>(queryKey(subject,environment,path)):undefined;}
export function cacheable(path:string){return /^\/api\/v1\/organizations\/[a-zA-Z0-9-]+\/(?:report|intelligence|payments|reconciliation|team|expenses|obligations|personal-summary|personal-income|automations|automation-runs|notifications|approvals|shipments|risk-signals|records\/(?:customers|orders|invoices|transactions|applications))(?:\?|$)/.test(path)&&!path.includes('format=csv');}
