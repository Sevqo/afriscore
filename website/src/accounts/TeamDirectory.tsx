import { useState } from 'react';
type Member={id:string;email:string;role:string;display_name?:string};
type Invitation={id:string;email:string;role:string;expires_at:string;accepted_at?:string;revoked?:number|string};
type Call=(path:string,method?:string,body?:unknown)=>Promise<any>;
export function TeamDirectory({data,call,action,role,actor}:{data?:{data?:Member[];invitations?:Invitation[]};call:Call;action:(fn:()=>Promise<any>)=>Promise<any>;role:string;actor:string}){
  const [search,setSearch]=useState(''),[token,setToken]=useState(''),[pending,setPending]=useState(false);
  const admin=['owner','admin'].includes(role),roles=['admin','finance','operations','viewer'];
  async function run(fn:()=>Promise<any>){setPending(true);setToken('');try{const result=await action(fn);if(result?.token)setToken(result.token);}finally{setPending(false);}}
  return <div className="team-directory">
    <section className="panel"><h2>Members</h2><label className="field"><span>Find a member</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or email"/></label>
      {(data?.data||[]).filter(m=>(m.email+' '+(m.display_name||'')).toLowerCase().includes(search.toLowerCase())).map(m=><article className="account-record team-member" key={m.id}>
        <span className="member-initials" aria-hidden="true">{(m.display_name||m.email).slice(0,2).toUpperCase()}</span><div><strong>{m.display_name||m.email}</strong>{m.display_name&&<p>{m.email}</p>}<small>{m.role} · Active{m.id===actor?' · You':''}</small></div>
        {admin&&<div className="row-actions"><label className="field"><span>Role for {m.email}</span><select aria-label={'Role for '+m.email} value={m.role} disabled={pending||m.id===actor||(m.role==='owner'&&role!=='owner')} onChange={e=>run(()=>call('/team/'+m.id,'PATCH',{role:e.target.value}))}>{['owner',...roles].map(r=><option key={r} disabled={r==='owner'&&role!=='owner'}>{r}</option>)}</select></label>
          <button disabled={pending||(m.role==='owner'&&role!=='owner')} onClick={()=>{if(confirm('Remove '+m.email+' from this workspace? Their account and records will remain.'))void run(()=>call('/team/'+m.id,'DELETE'));}}>Remove</button></div>}
      </article>)}
      {!data?.data?.length&&<p>No members are available for this workspace.</p>}<small>Join dates and last activity are not recorded; they are not estimated.</small>
    </section>
    <section className="panel"><h2>Invitations</h2>{admin&&<form className="form-grid" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));void run(()=>call('/invitations','POST',values));}}><label className="field"><span>Email address</span><input required name="email" type="email" autoComplete="email"/></label><label className="field"><span>Role</span><select name="role">{roles.map(r=><option key={r}>{r}</option>)}</select></label><button className="button" disabled={pending}>{pending?'Saving…':'Invite member'}</button><small>No invitation email service is connected. Share the one-time token with the intended colleague.</small></form>}
      {token&&<div className="alert one-time" role="status"><p>Share this invitation token with its intended recipient. It is shown once.</p><code>{token}</code><button className="quiet-button" onClick={()=>setToken('')}>Dismiss</button></div>}
      {(data?.invitations||[]).map(i=>{const status=i.accepted_at?'Accepted':Number(i.revoked)>0?'Revoked':Date.parse(i.expires_at)<Date.now()?'Expired':'Pending';return <article className="account-record" key={i.id}><div><strong>{i.email}</strong><p>{i.role} · {status}</p><small>Expires {new Date(i.expires_at).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi'})}</small></div>{admin&&!i.accepted_at&&status!=='Revoked'&&<div className="row-actions"><button disabled={pending} onClick={()=>run(()=>call('/invitations/'+i.id,'PATCH'))}>Renew token</button><button disabled={pending} onClick={()=>{if(confirm('Revoke this invitation?'))void run(()=>call('/invitations/'+i.id,'DELETE'));}}>Revoke</button></div>}</article>;})}
      {!data?.invitations?.length&&<p>No invitations yet. Invite a colleague when you need shared access.</p>}
    </section>
    <details className="panel"><summary>Roles &amp; permissions</summary><p>Owners manage ownership. Administrators manage the team. Finance members manage financial records; operations members manage operational tasks. Viewers can read permitted records. Every request is checked by the backend.</p><p>The last owner cannot be removed. Access changes are recorded in the workspace audit history.</p></details>
  </div>;
}
