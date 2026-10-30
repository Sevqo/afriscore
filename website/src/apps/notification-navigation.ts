import {appNavigationEvent} from './AppNavigation';
export const supportedNotificationSections=['Invoices','Payments','Reconciliation','Customers','Orders','Approvals','runs','Automations','followups','replenishment'];
export function openNotification(target:any,navigate:(tab:string)=>void,openRecord?:(tab:string,id:string)=>void){
 if(target.section==='API Explorer'){navigate('API Explorer');return;}
 if(openRecord&&target.record_id&&['Invoices','Customers','Orders'].includes(target.section)){openRecord(target.section,target.record_id);return;}
 if(['followups','replenishment','runs'].includes(target.section)){const url=new URL(location.href);url.searchParams.set('app',target.section==='followups'?'crm':target.section==='replenishment'?'inventory':'automations');url.searchParams.set('section',target.section);url.hash='Apps';history.pushState(null,'',url.pathname+url.search+url.hash);dispatchEvent(new Event(appNavigationEvent));navigate('Apps');return;}
 if(supportedNotificationSections.includes(target.section))navigate(target.section==='Automations'?'Automations':target.section);
}
