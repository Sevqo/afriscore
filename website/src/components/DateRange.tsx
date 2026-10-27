import { useEffect, useState, type ReactNode } from 'react';
import { isIsoDate } from '../charts/model';
export function DateRange({onApply, children, from='', to=''}:{onApply:(from:string,to:string)=>void;children?:ReactNode;from?:string;to?:string}) {
  const [start,setStart]=useState(from),[end,setEnd]=useState(to),[error,setError]=useState('');
  useEffect(()=>{setStart(from);setEnd(to);},[from,to]);
  return <form className="panel date-range" onSubmit={e=>{e.preventDefault();const values=new FormData(e.currentTarget),first=String(values.get('from')||''),last=String(values.get('to')||'');if((first&&!isIsoDate(first))||(last&&!isIsoDate(last))||(first&&last&&first>last)){setError('Choose valid dates with From before or equal to To.');return;}setError('');onApply(first,last);}}>
    <label className="field"><span>From</span><input type="date" name="from" value={start} max={end||undefined} onChange={e=>setStart(e.target.value)} /></label>
    <label className="field"><span>To</span><input type="date" name="to" value={end} min={start||undefined} onChange={e=>setEnd(e.target.value)} /></label>
    {children}<div className="date-range-actions"><button className="secondary-button">Apply</button><button type="button" className="quiet-button" onClick={()=>{setStart('');setEnd('');setError('');onApply('','');}}>Reset</button></div>
    {error&&<p className="alert error" role="alert">{error}</p>}
  </form>;
}
