/* ============ Storage adapter ============
   Everything goes through Store. Replace load/save with fetch() calls to your own
   API (PostgreSQL etc.) and add your auth there. */
const Store={
  async load(){try{return JSON.parse(localStorage.getItem('planner')||'null')}catch(e){return null}},
  async save(s){try{localStorage.setItem('planner',JSON.stringify(s))}catch(e){}}
};

const $=s=>document.querySelector(s),DAY=864e5,MIN=6e4,DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const uid=()=>Math.random().toString(36).slice(2,10),pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DEV=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
let S={cats:[{id:'c1',name:'Class',color:'#e5737f'},{id:'c2',name:'Meetup',color:'#4f9be0'},{id:'c3',name:'Event',color:'#48b884'}],events:[],todo:[],hide:[],set:{tz:'auto',snap:15,dens:56,h0:9,h1:22}};
let wk=0,LAST=[],H=[],ED=null,DR=null,lastDev=DEV();
const TZ=()=>S.set.tz==='auto'?DEV():S.set.tz;

/* ============ Time zone helpers (events stored as UTC ms) ============ */
const fc={};
function parts(ms,tz){const f=fc[tz]||(fc[tz]=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'}));const o={};f.formatToParts(ms).forEach(p=>o[p.type]=+p.value);return o}
const wall=p=>Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
const off=(ms,tz)=>wall(parts(ms,tz))-ms;
const toMs=(w,tz)=>{let m=w-off(w,tz);return w-off(m,tz)};
const fmt=ms=>{const p=parts(ms,TZ());return p.hour+':'+pad(p.minute)};
const isoD=ms=>{const p=parts(ms,TZ());return p.year+'-'+pad(p.month)+'-'+pad(p.day)};
const monday=d=>d-((new Date(d).getUTCDay()+6)%7)*DAY;
function goToday(){const p=parts(Date.now(),TZ());wk=monday(Date.UTC(p.year,p.month-1,p.day))}

/* ============ Data helpers ============ */
const cat=id=>S.cats.find(c=>c.id===id)||{name:'Uncategorized',color:'#8a8fa3'};
const mut=fn=>{H.push(JSON.stringify(S));if(H.length>50)H.shift();fn();Store.save(S);render()};
const save=()=>{Store.save(S);render()};
const step=(s,t,n)=>{if(t==='daily')return s+n*DAY;if(t==='weekly')return s+n*7*DAY;const d=new Date(s);d.setUTCMonth(d.getUTCMonth()+n);return d.getTime()};

function occs(){
  const tz=TZ(),lo=toMs(wk,tz)-DAY,hi=toMs(wk+7*DAY,tz)+DAY,out=[];
  S.events.forEach(e=>{
    const dur=e.end-e.start,r=e.rep,add=t=>{
      if(t<lo||t>hi||(e.skip||[]).includes(t))return;
      const p=parts(t,tz),col=(Date.UTC(p.year,p.month-1,p.day)-wk)/DAY;
      if(col>=0&&col<7)out.push({e,t,dur,col,min:p.hour*60+p.minute,done:r?(e.doneOn||[]).includes(t):e.done});
    };
    if(!r){add(e.start);return}
    const until=r.until?Date.parse(r.until)+DAY:Infinity,cut=r.endBefore??Infinity;
    let n=0;const per=r.type==='daily'?DAY:7*DAY;
    if(r.type!=='monthly')n=Math.max(0,Math.floor((lo-e.start)/per)-1);
    for(let k=0;k<3000;k++,n++){const t=step(e.start,r.type,n);if(t>hi||t>=until||t>=cut)break;add(t)}
  });
  return out;
}
function lay(list){
  list.sort((a,b)=>a.min-b.min);const cl=[];let end=0;
  list.forEach(o=>{o.end=o.min+o.dur/MIN;if(!cl.length||o.min>=end){cl.push([o]);end=o.end}else{cl[cl.length-1].push(o);end=Math.max(end,o.end)}});
  cl.forEach(c=>{const lanes=[];c.forEach(o=>{let i=lanes.findIndex(x=>x<=o.min);if(i<0){i=lanes.length;lanes.push(0)}lanes[i]=o.end;o.lane=i});c.forEach(o=>o.n=lanes.length)});
}

const catOpts=v=>S.cats.map(c=>`<option value="${c.id}"${c.id===v?' selected':''}>${esc(c.name)}</option>`).join('');
const DURS=[15,30,60,90,120,180,240],durL=m=>m<60?m+' min':(m/60)+(m===60?' hour':' hours');
const durOpts=v=>(DURS.includes(v)?DURS:[...DURS,v].sort((a,b)=>a-b)).map(m=>`<option value="${m}"${m===v?' selected':''}>${durL(m)}</option>`).join('');
const vis=t=>t.week<=wk&&(!t.done||t.week===wk);
/* ============ Render ============ */
function render(){
  const tz=TZ(),{h0,h1,dens:hh}=S.set;
  document.documentElement.style.setProperty('--hh',hh+'px');
  const np=parts(Date.now(),tz),today=Date.UTC(np.year,np.month-1,np.day);
  const list=occs();LAST=list;
  const fmtD=(d,o)=>new Date(d).toLocaleDateString('en-US',{timeZone:'UTC',...o});
  $('#title').textContent=fmtD(wk,{month:'short',day:'numeric'})+' – '+fmtD(wk+6*DAY,{month:'short',day:'numeric',year:'numeric'});
  $('#jump').value=new Date(wk).toISOString().slice(0,10);
  // chips + weekly stats
  const hrs={};list.forEach(o=>hrs[o.e.cat]=(hrs[o.e.cat]||0)+o.dur/36e5);
  $('#chips').innerHTML=S.cats.map(c=>`<span class="chip" data-id="${c.id}"><input type="color" class="sw" value="${c.color}" aria-label="Category color"><input class="nm" value="${esc(c.name)}" size="${Math.max(4,c.name.length)}" aria-label="Category name"><em>${+(hrs[c.id]||0).toFixed(1)}h</em><button class="x" aria-label="Delete category">×</button></span>`).join('')+`<span class="chip"><input type="color" class="sw" id="nc" value="#8b7cf6" aria-label="New category color"><input class="nm" id="nn" placeholder="New category" size="12" autocomplete="off"><button id="addc" class="pri" style="padding:3px 12px">Add</button></span><span style="color:var(--mu);font-size:12px;margin-left:auto">Time zone: ${esc(tz)}</span>`;
  // grid
  let hid=0;
  const heads=DAYS.map((d,i)=>{const dt=wk+i*DAY;return `<div class="hd${dt===today?' today':''}">${d}<b>${new Date(dt).getUTCDate()}</b></div>`}).join('');
  const hrsCol=Array.from({length:h1-h0},(_,i)=>`<div class="hr">${h0+i}:00</div>`).join('');
  const cols=DAYS.map((_,i)=>{
    const dt=wk+i*DAY,items=list.filter(o=>o.col===i&&(o.min+o.dur/MIN>h0*60&&o.min<h1*60||(hid++,false)));
    lay(items);
    const evs=items.map(o=>{
      const c=cat(o.e.cat),top=Math.max(0,(o.min-h0*60)/60*hh),bot=Math.min((h1-h0)*hh,(o.min+o.dur/MIN-h0*60)/60*hh),h=Math.max(bot-top,16);
      return `<div class="ev${o.done?' done':''}" data-id="${o.e.id}" data-t="${o.t}" title="${esc(o.e.title)}" style="top:${top}px;height:${h}px;left:calc(${o.lane/o.n*100}% + 2px);width:calc(${100/o.n}% - 4px);--c:${c.color}"><input type="checkbox" class="chk"${o.done?' checked':''}><b>${esc(o.e.title)}</b><small>${fmt(o.t)}–${fmt(o.t+o.dur)}${o.e.rep?' ↻':''}${o.e.loc?' · '+esc(o.e.loc):''}${o.e.tz!==tz?' · '+esc(o.e.tz.split('/').pop()):''}</small><i class="rz"></i></div>`;
    }).join('');
    const nm=np.hour*60+np.minute,now=dt===today&&nm>=h0*60&&nm<h1*60?`<div class="now" style="top:${(nm-h0*60)/60*hh}px"></div>`:'';
    return `<div class="col${dt===today?' td':''}" data-i="${i}" style="height:${(h1-h0)*hh}px">${evs}${now}</div>`;
  }).join('');
  $('#cal').innerHTML=`<div class="grid head"><div class="tm"></div>${heads}</div><div class="grid body"><div class="tm">${hrsCol}</div>${cols}</div>`;
  $('#hid').textContent=hid?hid+' outside visible hours':'';
  // to-schedule
  const todos=S.todo.filter(vis);
  $('#aside').innerHTML=`<h2>To schedule · ${fmtD(wk,{month:'short',day:'numeric'})} – ${fmtD(wk+6*DAY,{month:'short',day:'numeric'})}</h2><p>Drag a note by its handle onto the grid. Drag an event here to unschedule it. Click a note to edit, or change its week.</p><button id="tadd" class="pri">+ Add task</button>${(n=>n?`<p>${n} more task${n>1?'s':''} planned for later weeks.</p>`:'')(S.todo.filter(t=>t.week>wk&&!t.done).length)}`+
      (todos.length?todos.map(t=>`<div class="note${t.done?' done':''}" data-id="${t.id}" style="--c:${cat(t.cat).color}"><span class="grip" draggable="true" title="Drag to the grid">⠿</span><input type="checkbox" class="dn"${t.done?' checked':''} aria-label="Done"><div class="nb"><b>${esc(t.title)}</b><small>${t.loc?esc(t.loc)+' · ':''}${durL(t.dur)} · ${esc(cat(t.cat).name)}${t.week<wk?' · Carried over':''}</small></div><button class="x" aria-label="Delete">×</button></div>`).join(''):'<p>Nothing waiting. Add ideas here before you pick a time.</p>');
}

/* ============ Grid interactions ============ */
const cal=$('#cal');
cal.addEventListener('pointerdown',e=>{
  if(e.button||e.target.classList.contains('chk'))return;
  const ev=e.target.closest('.ev'),col=e.target.closest('.col');if(!col)return;
  e.preventDefault();
  const cols=[...document.querySelectorAll('.col')],cw=col.getBoundingClientRect().width,{dens:hh,snap:sn,h0,h1}=S.set,base=h0*60;
  const yMin=(y,c)=>base+(y-c.getBoundingClientRect().top)/hh*60,q=m=>Math.round(m/sn)*sn;
  const sx=e.clientX,sy=e.clientY,ci=+col.dataset.i,o=ev&&LAST.find(x=>x.e.id===ev.dataset.id&&x.t==+ev.dataset.t),mode=ev?(e.target.classList.contains('rz')?'rz':'mv'):'cr';
  let moved=false,sel,a=Math.floor(yMin(sy,col)/sn)*sn,b=a+60,overAside=false;
  const origH=ev?ev.offsetHeight:0,aside=$('#aside');
  if(mode==='cr'){sel=document.createElement('div');sel.className='sel';col.appendChild(sel);}
  const draw=()=>{sel.style.top=(a-base)/60*hh+'px';sel.style.height=(b-a)/60*hh+'px'};
  if(sel){b=a+sn;draw()}
  const mv=m=>{
    const dx=m.clientX-sx,dy=m.clientY-sy;if(Math.hypot(dx,dy)>4)moved=true;if(!moved)return;
    if(mode==='cr'){b=Math.max(a+sn,Math.ceil(yMin(m.clientY,col)/sn)*sn);draw()}
    else if(mode==='rz'){ev.style.height=Math.max(8,origH+dy)+'px'}
    else{ev.style.transform=`translate(${dx}px,${dy}px)`;ev.style.zIndex=30;ev.style.pointerEvents='none';overAside=aside.contains(document.elementFromPoint(m.clientX,m.clientY));aside.classList.toggle('over',overAside)}
  };
  const up=m=>{
    window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);aside.classList.remove('over');
    const dx=m.clientX-sx,dy=m.clientY-sy;
    if(mode==='cr'){sel.remove();if(!moved)b=a+60;a=Math.max(base,Math.min(a,h1*60-sn));b=Math.min(b,h1*60);openEd({start:toMs(wk+ci*DAY+a*MIN,TZ()),end:toMs(wk+ci*DAY+b*MIN,TZ())});return}
    if(!moved){openEd(o);return}
    if(mode==='rz'){const d=Math.max(sn,q(o.dur/MIN+dy/hh*60));moveOcc(o,o.t,o.t+d*MIN);return}
    if(overAside){mut(()=>{S.todo.push({id:uid(),title:o.e.title,cat:o.e.cat,loc:o.e.loc||'',dur:Math.round(o.dur/MIN),week:wk});if(o.e.rep)(o.e.skip=o.e.skip||[]).push(o.t);else S.events=S.events.filter(x=>x!==o.e)});return}
    const nc=Math.max(0,Math.min(6,ci+Math.round(dx/cw))),nm=Math.max(base,Math.min(h1*60-sn,q(o.min+dy/hh*60))),ns=toMs(wk+nc*DAY+nm*MIN,TZ()),d=ns-o.t;
    moveOcc(o,ns,ns+o.dur);
  };
  const cancel=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);render()};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
});
cal.addEventListener('change',e=>{
  if(!e.target.classList.contains('chk'))return;
  const ev=e.target.closest('.ev'),x=S.events.find(v=>v.id===ev.dataset.id),t=+ev.dataset.t,on=e.target.checked;
  mut(()=>{if(!x.rep){x.done=on;return}const a=(x.doneOn||[]).filter(k=>k!==t);if(on)a.push(t);x.doneOn=a});
});
// drop from "to schedule"
cal.addEventListener('dragover',e=>{if(DR&&e.target.closest('.col'))e.preventDefault()});
cal.addEventListener('drop',e=>{
  const col=e.target.closest('.col'),t=S.todo.find(x=>x.id===DR);if(!col||!t)return;
  const {dens:hh,snap:sn,h0,h1}=S.set,m=Math.max(h0*60,Math.min(h1*60-sn,Math.floor((h0*60+(e.clientY-col.getBoundingClientRect().top)/hh*60)/sn)*sn));
  const s=toMs(wk+ +col.dataset.i*DAY+m*MIN,TZ());
  mut(()=>{S.todo=S.todo.filter(x=>x!==t);S.events.push({id:uid(),title:t.title,cat:t.cat,loc:t.loc||'',notes:'',start:s,end:s+t.dur*MIN,tz:TZ(),done:false,rep:null,skip:[]})});DR=null;
});

/* ============ To-schedule panel ============ */
const aside=$('#aside');
const ask=(msg,ok='Delete')=>new Promise(r=>{const d=$('#cf');$('#cfm').textContent=msg;$('#cfy').textContent=ok;d.returnValue='no';d.onclose=()=>r(d.returnValue==='yes');d.showModal()});
const tf=$('#tf'),td2=$('#td2');let TE=null;
function openTodo(t){TE=t||null;tf.cat.innerHTML=catOpts(t?.cat);tf.dur.innerHTML=durOpts(t?t.dur:60);tf.title.value=t?.title||'';tf.loc.value=t?.loc||'';tf.wk.value=new Date(t?t.week:wk).toISOString().slice(0,10);$('#tdel').hidden=!t;td2.showModal();tf.title.focus()}
tf.addEventListener('submit',()=>{const v={title:tf.title.value.trim()||'Untitled',cat:tf.cat.value,dur:+tf.dur.value,loc:tf.loc.value.trim(),week:tf.wk.value?monday(Date.parse(tf.wk.value+'T00:00:00Z')):wk};mut(()=>{if(TE)Object.assign(TE,v);else S.todo.push({id:uid(),...v})})});
$('#tcancel').onclick=()=>td2.close();
$('#tdel').onclick=async()=>{td2.close();if(await ask('Delete this task?'))mut(()=>S.todo=S.todo.filter(x=>x!==TE))};
aside.addEventListener('dragstart',e=>{const n=e.target.closest('.note');if(n){DR=n.dataset.id;e.dataTransfer.setData('text/plain',DR);e.dataTransfer.setDragImage(n,10,10)}});
aside.addEventListener('click',async e=>{
  if(e.target.id==='tadd'){openTodo();return}
  const n=e.target.closest('.note');if(!n)return;const t=S.todo.find(x=>x.id===n.dataset.id);if(!t)return;
  if(e.target.classList.contains('dn')||e.target.classList.contains('grip'))return;
  if(e.target.closest('.x')){if(await ask('Delete "'+t.title+'"?'))mut(()=>S.todo=S.todo.filter(x=>x!==t));return}
  openTodo(t);
});
aside.addEventListener('change',e=>{
  const n=e.target.closest('.note'),t=n&&S.todo.find(x=>x.id===n.dataset.id);
  if(t&&e.target.classList.contains('dn'))mut(()=>t.done=e.target.checked);
});

/* ============ Categories ============ */
$('#chips').addEventListener('click',e=>{
  if(e.target.id==='addc'){const n=$('#nn').value.trim();if(!n){$('#nn').focus();return}const c=$('#nc').value;mut(()=>S.cats.push({id:uid(),name:n,color:c}));return}
  const ch=e.target.closest('.chip'),x=e.target.closest('.x');
  if(ch&&ch.dataset.id&&x){const c=cat(ch.dataset.id);ask('Delete category "'+c.name+'"? Its events stay but become uncategorized.').then(y=>{if(y)mut(()=>{S.cats=S.cats.filter(k=>k.id!==c.id)})})}
});
$('#chips').addEventListener('change',e=>{
  const ch=e.target.closest('.chip');if(!ch||!ch.dataset.id)return;const c=cat(ch.dataset.id),v=e.target.value.trim();
  if(e.target.classList.contains('sw'))mut(()=>c.color=e.target.value);
  else if(e.target.classList.contains('nm')){if(v)mut(()=>c.name=v);else render()}
});

/* ============ Event dialog ============ */
const f=$('#f'),ed=$('#ed');
function openEd(o){
  ED=o;const e=o.e||{title:'',cat:S.cats[0]?.id,loc:'',notes:'',rep:null},s=o.e?o.t:o.start,en=s+(o.e?o.dur:o.end-o.start);
  f.cat.innerHTML=S.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  f.title.value=e.title;f.cat.value=e.cat;f.date.value=isoD(s);f.st.value=pad(parts(s,TZ()).hour)+':'+pad(parts(s,TZ()).minute);
  const pe=parts(en,TZ());f.en.value=pad(pe.hour)+':'+pad(pe.minute);
  f.rep.value=e.rep?e.rep.type:'';f.until.value=e.rep?.until||'';f.loc.value=e.loc||'';f.notes.value=e.notes||'';
  $('#delA').hidden=!o.e;$('#del1').hidden=!(o.e&&o.e.rep);$('#delA').textContent=o.e&&o.e.rep?'Delete this & future':'Delete';
  ed.showModal();f.title.focus();
}
// Apply changes to one occurrence and every later one; earlier occurrences stay untouched.
function applyFuture(e,t,ch){
  ch={...ch};const d=ch.start-t,cut=e.rep&&e.rep.endBefore;
  if(ch.rep&&cut!=null)ch.rep={...ch.rep,endBefore:cut};
  if(t<=e.start){Object.assign(e,ch);e.doneOn=(e.doneOn||[]).map(k=>k+d);e.skip=(e.skip||[]).map(k=>k+d);return}
  S.events.push({id:uid(),title:e.title,cat:e.cat,loc:e.loc,notes:e.notes,tz:e.tz,done:false,rep:e.rep,...ch,
    doneOn:(e.doneOn||[]).filter(k=>k>=t).map(k=>k+d),skip:(e.skip||[]).filter(k=>k>=t).map(k=>k+d)});
  e.rep={...e.rep,endBefore:t};e.doneOn=(e.doneOn||[]).filter(k=>k<t);e.skip=(e.skip||[]).filter(k=>k<t);
}
const scope=()=>new Promise(r=>{const d=$('#sc');d.returnValue='no';d.onclose=()=>r(d.returnValue);d.showModal()});
// Detach one occurrence of a repeating event into its own standalone event
function splitOne(e,t,ch){
  const was=(e.doneOn||[]).includes(t);
  (e.skip=e.skip||[]).push(t);e.doneOn=(e.doneOn||[]).filter(k=>k!==t);
  S.events.push({id:uid(),title:e.title,cat:e.cat,loc:e.loc,notes:e.notes,tz:e.tz,done:was,skip:[],...ch,rep:null});
}
// Move/resize one occurrence; repeating events ask "only this" or "all"
async function moveOcc(o,ns,ne){
  let sc='all';
  if(o.e.rep){sc=await scope();if(sc==='no'){render();return}}
  mut(()=>{
    if(sc==='one')splitOne(o.e,o.t,{start:ns,end:ne});
    else applyFuture(o.e,o.t,{start:ns,end:ne});
  });
}
f.addEventListener('submit',async e=>{
  e.preventDefault();
  const tz=TZ(),d=f.date.value,s=toMs(Date.parse(d+'T'+f.st.value+':00Z'),tz);let en=toMs(Date.parse(d+'T'+f.en.value+':00Z'),tz);
  if(en<=s)en=s+S.set.snap*MIN;
  const rep=f.rep.value?{type:f.rep.value,until:f.until.value||null}:null,v={title:f.title.value.trim()||'Untitled',cat:f.cat.value,loc:f.loc.value,notes:f.notes.value,rep};
  let sc='all';
  if(ED.e&&ED.e.rep){sc=await scope();if(sc==='no')return}
  mut(()=>{
    if(!ED.e)S.events.push({id:uid(),...v,start:s,end:en,tz,done:false,skip:[]});
    else if(sc==='one')splitOne(ED.e,ED.t,{title:v.title,cat:v.cat,loc:v.loc,notes:v.notes,start:s,end:en});
    else applyFuture(ED.e,ED.t,{...v,start:s,end:en});
  });
  ed.close();
});
$('#cancel').onclick=()=>ed.close();
$('#delA').onclick=()=>{mut(()=>{const e=ED.e,t=ED.t;
  if(e.rep&&t>e.start){e.rep={...e.rep,endBefore:t};e.doneOn=(e.doneOn||[]).filter(k=>k<t);e.skip=(e.skip||[]).filter(k=>k<t)}
  else S.events=S.events.filter(x=>x!==e)});ed.close()};
$('#del1').onclick=()=>{mut(()=>(ED.e.skip=ED.e.skip||[]).push(ED.t));ed.close()};

/* ============ Weekly review & copy week ============ */
function rvFill(){
  const one=LAST.filter(o=>!o.e.rep),now=Date.now(),done=one.filter(o=>o.e.done).length,un=one.filter(o=>!o.e.done).sort((a,b)=>a.t-b.t),hrs={};
  LAST.forEach(o=>hrs[o.e.cat]=(hrs[o.e.cat]||0)+o.dur/36e5);
  const mx=Math.max(1,...Object.values(hrs)),left=S.todo.filter(t=>vis(t)&&!t.done).length,fd=d=>new Date(d).toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
  $('#rvb').innerHTML=`<h2 style="margin:0 0 2px">Week review</h2><p style="margin:0;color:var(--mu)">${fd(wk)} – ${fd(wk+6*DAY)}</p>
  <h3>Completed</h3><p style="margin:0">${done} of ${one.length} one-off events marked done${one.length?' ('+Math.round(done/one.length*100)+'%)':''}</p>
  <h3>Time by category</h3>${S.cats.map(c=>{const h=hrs[c.id]||0;return `<div class="rvr" style="--c:${c.color}"><span>${esc(c.name)}</span><div class="bar"><i style="width:${h/mx*100}%"></i></div><span>${+h.toFixed(1)}h</span></div>`}).join('')}
  <h3>Unfinished events (${un.length})</h3>${un.length?`<p style="margin:0 0 6px;color:var(--mu)">Past events are pre-selected. Choose what to move to next week.</p>`+un.map(o=>`<label class="pkr"><input type="checkbox" class="pk" value="${o.e.id}@${o.t}"${o.t+o.dur<now?' checked':''}><span>${DAYS[o.col]} ${fmt(o.t)} · ${esc(o.e.title)}${o.t+o.dur>=now?' <small style="color:var(--mu)">upcoming</small>':''}</span></label>`).join('')+'<p><button id="rvr" class="pri">Move selected to next week</button></p>':'<p style="margin:0">All caught up.</p>'}
  <h3>Still in To schedule</h3><p style="margin:0">${left} task${left===1?'':'s'} not scheduled yet. They carry over to next week automatically.</p>
  <h3>Reflection</h3><textarea id="rvn" rows="3" placeholder="What went well? What will you change next week?">${esc(S.notes[wk]||'')}</textarea>`;
}
$('#rev').onclick=()=>{rvFill();$('#rv').showModal()};
$('#rvx').onclick=()=>$('#rv').close();
$('#rvb').addEventListener('click',e=>{
  if(e.target.id!=='rvr')return;
  const ids=[...document.querySelectorAll('#rvb .pk:checked')].map(x=>x.value),sel=LAST.filter(o=>!o.e.rep&&ids.includes(o.e.id+'@'+o.t));
  if(!sel.length)return;
  mut(()=>sel.forEach(o=>{S.todo.push({id:uid(),title:o.e.title,cat:o.e.cat,loc:o.e.loc||'',dur:Math.round(o.dur/MIN),week:wk+7*DAY});S.events=S.events.filter(x=>x!==o.e)}));
  rvFill();
});
$('#rvb').addEventListener('input',e=>{if(e.target.id==='rvn'){S.notes[wk]=e.target.value;Store.save(S)}});
$('#cp').onclick=async()=>{
  const src=LAST.filter(o=>!o.e.rep),tz=TZ();
  if(!src.length){await ask('This week has no one-off events to copy. Repeating events already show up every week.','OK');return}
  if(!await ask(`Copy ${src.length} event${src.length>1?'s':''} from this week to next week? Repeating events are skipped because they already repeat.`,'Copy'))return;
  mut(()=>src.forEach(o=>{const ns=toMs(wall(parts(o.t,tz))+7*DAY,tz);S.events.push({id:uid(),title:o.e.title,cat:o.e.cat,loc:o.e.loc||'',notes:o.e.notes||'',start:ns,end:ns+o.dur,tz,done:false,rep:null,skip:[]})}));
  go(1);
};

/* ============ Settings, navigation, import/export ============ */
const sf=$('#sf');
$('#set').onclick=()=>{
  const zs=Intl.supportedValuesOf?Intl.supportedValuesOf('timeZone'):[DEV(),'UTC'];
  sf.tz.innerHTML=`<option value="auto">Device (auto: ${esc(DEV())})</option>`+zs.map(z=>`<option>${z}</option>`).join('');
  sf.tz.value=S.set.tz;sf.snap.value=S.set.snap;sf.dens.value=S.set.dens;sf.h0.value=S.set.h0;sf.h1.value=S.set.h1;$('#st').showModal();
};
sf.addEventListener('change',()=>{
  const h0=Math.max(0,Math.min(22,+sf.h0.value||9)),h1=Math.max(h0+1,Math.min(24,+sf.h1.value||22));
  Object.assign(S.set,{tz:sf.tz.value,snap:+sf.snap.value,dens:+sf.dens.value,h0,h1});save();
});
const go=n=>{wk+=n*7*DAY;render()};
$('#prev').onclick=()=>go(-1);$('#next').onclick=()=>go(1);$('#today').onclick=()=>{goToday();render()};
$('#jump').onchange=e=>{if(e.target.value){wk=monday(Date.parse(e.target.value+'T00:00:00Z'));render()}};
$('#exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='planner-'+new Date().toISOString().slice(0,10)+'.json';a.click()};
$('#imp').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{const t=e.target.files[0];if(!t)return;try{const d=JSON.parse(await t.text());if(!d.events||!d.cats)throw 0;d.notes=d.notes||{};d.hide=d.hide||[];mut(()=>S=d)}catch(x){ask('This file is not a valid planner export.','OK')}e.target.value=''};
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.key==='ArrowLeft')go(-1);else if(e.key==='ArrowRight')go(1);
  else if((e.ctrlKey||e.metaKey)&&e.key==='z'&&H.length){e.preventDefault();S=JSON.parse(H.pop());Store.save(S);render()}
});
setInterval(()=>{if(S.set.tz==='auto'&&DEV()!==lastDev){lastDev=DEV();goToday()}if(!document.querySelector('dialog[open]')&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))render()},60000);

(async()=>{const d=await Store.load();if(d)S=d;S.hide=S.hide||[];S.notes=S.notes||{};goToday();render()})();