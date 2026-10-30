import {useEffect,useState} from 'react';
import {QuotationEditor} from './QuotationEditor';
import {useIdempotentAPI} from './useIdempotentAPI';
import type {API} from '../operations/UI';
export function OrderDraftEditor({row,api:providedApi,scope,services,customers,onSaved}:{row:any;api:API;scope:string;services:any[];customers:any[];onSaved:()=>void}){
 const api=useIdempotentAPI(providedApi,scope),[data,setData]=useState<any>(null),[error,setError]=useState('');const has=(id:string)=>services.some(s=>s.id===id&&s.status==='active'),inventoryActive=has('inventory'),productsActive=has('products');
 useEffect(()=>{let current=true;setData(null);setError('');Promise.all([api('/business/orders/'+row.id+'/draft'),productsActive?api('/products'):Promise.resolve({data:[]}),inventoryActive?api('/inventory/warehouses'):Promise.resolve({data:[],locations:[]})]).then(([draft,p,w])=>{if(current)setData({draft,products:p.data,warehouses:w});}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[scope,row.id,inventoryActive,productsActive]);
 return <details><summary>Edit draft items, terms & stock allocation</summary>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading the current draft version…</p>}{data?.draft.editable&&<QuotationEditor quotation={data.draft.order} documentType="order" orderRevision={data.draft.revision} customers={customers} products={data.products} warehouses={data.warehouses} inventoryActive={inventoryActive} api={api} onSaved={onSaved}/>}</details>;
}
