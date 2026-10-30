import {useEffect,useState} from 'react';
import {Icon} from '../components/Icon';
import type {API} from '../operations/UI';
export const appNavigationEvent='africore:app-navigation';
export function useAppContext(api:API,scope:string,enabled=true){
 const [catalog,setCatalog]=useState<{scope:string;apps:any[]}>({scope:'',apps:[]}),[selection,setSelection]=useState(()=>({id:new URLSearchParams(location.search).get('app'),section:new URLSearchParams(location.search).get('section')||'dashboard'})),[revision,setRevision]=useState(0);
 useEffect(()=>{const sync=()=>setSelection({id:new URLSearchParams(location.search).get('app'),section:new URLSearchParams(location.search).get('section')||'dashboard'}),refresh=()=>setRevision(v=>v+1);addEventListener('popstate',sync);addEventListener(appNavigationEvent,sync);addEventListener('africore:apps-changed',refresh);return()=>{removeEventListener('popstate',sync);removeEventListener(appNavigationEvent,sync);removeEventListener('africore:apps-changed',refresh);};},[]);
 useEffect(()=>{if(!enabled)return;let current=true;setCatalog({scope,apps:[]});api('/apps').then(r=>{if(current)setCatalog({scope,apps:r.apps});}).catch(()=>{});return()=>{current=false;};},[scope,enabled,revision]);
 const app=catalog.scope===scope?catalog.apps.find(a=>a.id===selection.id&&a.installation?.status==='installed'):null;
 return {app,section:selection.section};
}
export function AppContextNavigation({app,section,tab,navigate}:{app:any;section:string;tab:string;navigate:(tab:string)=>void}){
 const direct:Record<string,string>={Invoices:'Invoices',Payments:'Payments',Expenses:'Expenses',Reconciliation:'Reconciliation',Reports:'Reports',Customers:'Customers',Orders:'Orders',Fulfillment:'Fulfillment',Intelligence:'Intelligence',Automations:'Automations',Approvals:'Approvals',products:'Products',quotations:'Quotations'};
 function open(value:string){const url=new URL(location.href);if(value==='all'){url.searchParams.delete('app');url.searchParams.delete('section');}else{url.searchParams.set('app',app.id);url.searchParams.set('section',value);}const target=value==='all'?'Apps':direct[value]||'Apps';url.hash=encodeURIComponent(target);history.pushState(null,'',url.pathname+url.search+url.hash);dispatchEvent(new Event(appNavigationEvent));navigate(target);}
 return <><button onClick={()=>open('all')}><Icon name="left"/> All apps</button><p className="workspace-label">{app.name}</p>{app.navigation.map((n:any)=>{const active=direct[n.section]?tab===direct[n.section]:tab==='Apps'&&section===n.section;return <button key={n.section} className={active?'active':''} aria-current={active?'page':undefined} onClick={()=>open(n.section)}>{n.label}</button>;})}<hr/><button onClick={()=>navigate('Notifications')}>Notifications</button><button onClick={()=>navigate('Approvals')}>Approvals</button><button onClick={()=>navigate('My Services')}>Services</button><button onClick={()=>navigate('Usage & Billing')}>Usage & billing</button><button onClick={()=>navigate('Overview')}>Workspace home</button></>;
}
