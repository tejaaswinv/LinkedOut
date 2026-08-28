'use client';
import { useEffect, useState } from 'react';
import Nav from '../../../components/Nav';
import { authFetch } from '../../../lib/authFetch';

export default function ModerationPage(){
  const [data,setData]=useState({reviews:[],verifications:[]});
  const [message,setMessage]=useState('');
  const load=()=>authFetch('/api/admin/moderation').then(async r=>({ok:r.ok,d:await r.json()})).then(({ok,d})=>{if(!ok)setMessage(d.error||'Could not load moderation queue.');else{setData(d);setMessage('')}}).catch(()=>setMessage('Could not load moderation queue.'));
  useEffect(()=>{load()},[]);
  const openEvidence=async(id)=>{const r=await authFetch(`/api/admin/evidence?id=${encodeURIComponent(id)}`);const d=await r.json();if(!r.ok){setMessage(d.error||'Could not open evidence.');return;}window.open(d.url,'_blank','noopener,noreferrer');};
  const act=async(payload)=>{const r=await authFetch('/api/admin/moderation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)setMessage(d.error||'Action failed.');else load();};
  return <><Nav/><main className="pageWrap adminWrap"><div className="sectionTitle"><div><h1>LinkedOut moderation</h1><p>Human review queue for edge-case posts and private employment proof.</p></div></div>{message&&<div className="authMessage">{message}</div>}
    <h2>Pending workplace stories <span className="countPill">{data.reviews.length}</span></h2>{data.reviews.length?data.reviews.map(r=><article className="card moderationCard" key={r.id}><div className="moderationMeta"><b>{r.pseudonym}</b><span>{r.role_title} · {r.company?.name||'Company'} · {r.location}</span></div><p>{r.body}</p><div className="chips">{r.tags?.map(t=><span key={t}>{t}</span>)}</div><div className="moderationReason"><b>Auto-moderation:</b> {r.moderation_reason||'No reason'} {r.moderation_flags?.length?`(${r.moderation_flags.join(', ')})`:''}</div><div className="moderationActions"><button className="approve" onClick={()=>act({type:'review',id:r.id,decision:'approved'})}>Approve & publish</button><button className="reject" onClick={()=>act({type:'review',id:r.id,decision:'rejected'})}>Reject</button></div></article>):<div className="card emptyState">No workplace stories waiting for human review.</div>}
    <h2>Employment proof <span className="countPill">{data.verifications.length}</span></h2>{data.verifications.length?data.verifications.map(v=><article className="card moderationCard" key={v.id}><div className="moderationMeta"><b>{v.company?.name||'Company'}</b><span>{v.role_title} · {v.department||'No department'} · {v.location||'No location'} · {v.employment_status}</span></div><p>Private evidence uploaded: {v.hasEvidence?'Yes':'No'}. Signed evidence links expire after five minutes.</p><div className="moderationActions">{v.hasEvidence&&<button onClick={()=>openEvidence(v.id)}>Open private proof</button>}<button className="approve" onClick={()=>act({type:'verification',id:v.id,decision:'verified'})}>Verify employment</button><button className="reject" onClick={()=>act({type:'verification',id:v.id,decision:'rejected'})}>Reject proof</button></div></article>):<div className="card emptyState">No employment documents waiting for review.</div>}
  </main></>;
}
