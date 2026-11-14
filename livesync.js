/* Live sync of jobs, worksheets and photos for one Google account.
   This device's localStorage stays the working copy. Firestore is updated from it
   and can update it. Saved PDFs are not synced. Nothing here writes to Google Calendar.
   The Firebase scripts are loaded from the Google CDN only after the config is real. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSASync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const CDN='https://www.gstatic.com/firebasejs/11.9.1/';
  const MAX_DOC=1048576;
  const META_KEY='ccsa.sync.v1';
  const OUTBOX_KEY='ccsa.sync.outbox';
  const TOMB_KEY='ccsa.sync.tombs';

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function timeOf(v){const t=Date.parse(v||'');return isNaN(t)?0:t}
  function configReady(cfg){
    if(!cfg||typeof cfg!=='object')return false;
    if(!cfg.apiKey||!cfg.authDomain||!cfg.projectId||!cfg.appId)return false;
    return !/YOUR_/i.test(JSON.stringify(cfg));
  }
  /* Google sign-in opens a popup, then a full-page redirect if the popup is blocked.
     GitHub Pages cannot proxy Firebase's /__/auth handler, so the handler stays on
     firebaseapp.com. An installed iPhone app does not get that result back: Safari
     keeps the sign-in, and the home screen icon stays signed out. */
  function isIos(nav){
    nav=nav||{};
    const ua=String(nav.userAgent||'');
    return /iPad|iPhone|iPod/.test(ua)||(nav.platform==='MacIntel'&&(nav.maxTouchPoints||0)>1);
  }
  function isAndroid(nav){return /Android/i.test(String((nav||{}).userAgent||''))}
  function isStandalone(nav){
    nav=nav||{};
    return nav.standalone===true||nav.displayMode==='standalone'||nav.displayMode==='fullscreen';
  }
  function inAppBrowser(nav){
    const ua=String((nav||{}).userAgent||'');
    return /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|MicroMessenger|LinkedInApp|Twitter/i.test(ua);
  }
  function signInPlan(nav){
    nav=nav||{};
    if(inAppBrowser(nav))return 'open-browser';
    if(isIos(nav)&&isStandalone(nav))return 'popup-then-browser';
    return 'popup-then-redirect';
  }
  function browserHelp(nav){
    nav=nav||{};
    if(inAppBrowser(nav)){
      if(isIos(nav))return {label:'Open in Safari',text:'This in-app browser blocks Google sign-in. Tap Open in Safari, then tap Sign in. Worksheets on this device were not changed.'};
      return {label:'Open in Chrome',text:'This in-app browser blocks Google sign-in. Tap Open in Chrome, then tap Sign in. Worksheets on this device were not changed.'};
    }
    if(isIos(nav)&&isStandalone(nav))return {label:'Open in Safari',text:'This home screen app cannot finish Google sign-in. Tap Open in Safari, then tap Sign in in that tab. On iPhone the home screen icon does not receive that sign-in. Sync works in the Safari tab. Worksheets already on this phone stay on this phone.'};
    if(isAndroid(nav)&&isStandalone(nav))return {label:'Open in Chrome',text:'Google sign-in did not finish in the installed app. Tap Open in Chrome, then tap Sign in. Chrome and the home screen icon usually share that sign-in. If this icon still says Not signed in, use the Chrome tab for sync. Worksheets on this phone were not changed.'};
    return null;
  }
  function openingHelp(nav){
    const plan=signInPlan(nav);
    if(plan==='popup-then-redirect')return null;
    return browserHelp(nav);
  }
  function safeHref(href){
    const s=String(href||'');
    if(/^https:\/\//i.test(s))return s;
    return 'https://adamcw68.github.io/smoke-log/';
  }
  function pageHost(){try{return typeof location!=='undefined'?location.hostname:''}catch(e){return ''}}
  function pageURL(){
    try{
      if(typeof location==='undefined'||!location.origin)return 'https://adamcw68.github.io/smoke-log/';
      return location.origin+location.pathname;
    }catch(e){return 'https://adamcw68.github.io/smoke-log/'}
  }
  function withHref(help){
    if(!help)return null;
    return {label:help.label,text:help.text,href:help.href||pageURL()};
  }
  function docId(id){
    const s=encodeURIComponent(String(id==null?'':id));
    return s||'x';
  }
  function photoFits(byteLength){
    const n=+byteLength||0;
    if(n<=0)return false;
    const b64=Math.ceil(n/3)*4;
    return b64+1024<MAX_DOC;
  }
  function statusLabel(state){
    state=state||{};
    if(!state.configured)return "Sync isn't set up yet";
    if(!state.user)return 'Not signed in';
    if(state.phase==='paused')return 'Sync paused';
    if(state.phase==='syncing')return 'Syncing';
    if(state.phase==='offline')return 'Offline - changes saved on this device';
    return 'Synced';
  }
  function fmtWhen(iso){
    const d=new Date(iso);
    if(!iso||isNaN(d.getTime()))return '';
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let h=d.getHours();
    const min=String(d.getMinutes()).padStart(2,'0');
    const ap=h>=12?'pm':'am';
    h=h%12;if(h===0)h=12;
    return d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear()+', '+h+':'+min+' '+ap;
  }
  function panelHTML(state){
    state=state||{};
    const label=statusLabel(state);
    const account=state.user?(state.user.email||state.user.uid):'';
    const when=state.lastSync?'Last sync '+fmtWhen(state.lastSync):'';
    const photos=+state.unsyncedPhotos||0;
    const photoNote=photos?(photos+' photo'+(photos===1?' is':'s are')+' only on this device. A photo that cannot fit in one record is not uploaded.'):'';
    const help=state.help&&!state.user?state.help:null;
    let buttons='';
    if(state.configured&&state.user)buttons='<button type="button" class="btn" id="syncout">Sign out</button>';
    else if(state.configured)buttons='<button type="button" class="btn'+(help?'':' pri')+'" id="syncin">Sign in</button>';
    const open=help?'<a class="btn pri" id="syncopen" href="'+esc(safeHref(help.href))+'" target="_blank" rel="noopener">'+esc(help.label||'Open in the browser')+'</a>':'';
    const setup=state.configured?'':'<p class="note">Sync is off until a Firebase web config is saved in firebase-config.js. Jobs on this device are unchanged.</p>';
    return '<section class="f" id="syncpanel" aria-label="Sync"><h2>Sync</h2>'
      +'<p id="syncstatus"><b>'+esc(label)+'</b></p>'
      +(account?'<p class="note" id="syncaccount">'+esc(account)+'</p>':'')
      +(when?'<p class="note" id="synctime">'+esc(when)+'</p>':'')
      +(photoNote?'<p class="note" id="syncphoto">'+esc(photoNote)+'</p>':'')
      +(state.error?'<p class="note" id="syncerror">'+esc(state.error)+'</p>':'')
      +(help?'<p class="note" id="synchelp">'+esc(help.text)+'</p>':'')
      +setup
      +'<p class="note">Saved PDFs stay on this device. On another device, open the worksheet and tap Make PDF.</p>'
      +open+buttons+'</section>';
  }
  function transfer(){
    const g=typeof globalThis!=='undefined'?globalThis:root;
    if(g&&g.CCSATransfer)return g.CCSATransfer;
    throw new Error('transfer.js is required before sync');
  }
  function jobTime(job,forms){
    const f=forms&&job?forms[job.id]:null;
    return Math.max(timeOf(job&&job.updated),timeOf(f&&f.updated));
  }
  function latestTombs(list){
    const m=new Map();
    (list||[]).forEach(function(t){
      if(!t||!t.id)return;
      const key=(t.kind||'job')+':'+t.id;
      const prev=m.get(key);
      if(!prev||timeOf(t.at)>timeOf(prev.at))m.set(key,t);
    });
    return m;
  }
  function killed(tombs,kind,id,itemTime){
    const t=tombs.get(kind+':'+id);
    return !!(t&&timeOf(t.at)>=itemTime);
  }
  /* Ignore the clock and private scratch fields. A newer timestamp with the same
     worksheet is not a change, so opening a job or hiding the app does not upload it. */
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(function(key){
        if(key==='updated'||key==='_calGen'||value[key]===undefined)return;
        out[key]=stable(value[key]);
      });
      return out;
    }
    return value;
  }
  function contentSig(job,form){
    return JSON.stringify(stable({job:job||null,form:form||null}));
  }
  function needsPush(localJob,localForm,remoteJob,remoteForm){
    if(!localJob||!localJob.id)return false;
    if(!remoteJob)return true;
    return contentSig(localJob,localForm||null)!==contentSig(remoteJob,remoteForm||null);
  }
  /* Newest worksheet wins. A record that exists on only one side is kept.
     A tombstone removes a record only when the delete is newer than that record.
     A document is queued for upload only when its saved content differs. */
  function reconcile(local,remote){
    local=local||{};remote=remote||{};
    const tombs=latestTombs([].concat(local.tombstones||[],remote.tombstones||[]));
    const localJobs=(local.jobs||[]).filter(function(j){return j&&j.id&&!killed(tombs,'job',j.id,jobTime(j,local.forms))});
    const remoteJobs=(remote.jobs||[]).filter(function(j){return j&&j.id&&!killed(tombs,'job',j.id,jobTime(j,remote.forms))});
    const localForms={},remoteForms={};
    localJobs.forEach(function(j){if(local.forms&&local.forms[j.id])localForms[j.id]=local.forms[j.id]});
    remoteJobs.forEach(function(j){if(remote.forms&&remote.forms[j.id])remoteForms[j.id]=remote.forms[j.id]});
    const merged=transfer().mergeWorksheets({jobs:localJobs,forms:localForms,photos:[],pdfs:[]},{jobs:remoteJobs,forms:remoteForms,photos:[],pdfs:[]});
    const localPhotos=(local.photos||[]).filter(function(p){return p&&p.id&&!killed(tombs,'photo',p.id,timeOf(p.ts))});
    const remotePhotos=(remote.photos||[]).filter(function(p){return p&&p.id&&!killed(tombs,'photo',p.id,timeOf(p.ts))});
    const localPhoto=new Map(localPhotos.map(function(p){return [p.id,p]}));
    const remotePhoto=new Map(remotePhotos.map(function(p){return [p.id,p]}));
    const remoteJob=new Map(remoteJobs.map(function(j){return [String(j.id),j]}));
    const pullPhotos=[],pushPhotos=[];
    localPhotos.forEach(function(p){
      const other=remotePhoto.get(p.id);
      if(!other||timeOf(p.ts)>timeOf(other.ts))pushPhotos.push(p.id);
    });
    remotePhotos.forEach(function(p){
      const other=localPhoto.get(p.id);
      if(!other||timeOf(p.ts)>timeOf(other.ts))pullPhotos.push(p);
    });
    const pushJobs=[];
    merged.jobs.forEach(function(j){
      const other=remoteJob.get(String(j.id))||null;
      const remoteForm=other?remoteForms[String(other.id)]||null:null;
      if(needsPush(j,merged.forms[j.id]||null,other,remoteForm))pushJobs.push(j.id);
    });
    const dropJobs=(local.jobs||[]).filter(function(j){return j&&j.id&&killed(tombs,'job',j.id,jobTime(j,local.forms))}).map(function(j){return j.id});
    const dropPhotos=(local.photos||[]).filter(function(p){return p&&p.id&&killed(tombs,'photo',p.id,timeOf(p.ts))}).map(function(p){return p.id});
    return {jobs:merged.jobs,forms:merged.forms,pullPhotos:pullPhotos,pushJobs:pushJobs,pushPhotos:pushPhotos,dropJobs:dropJobs,dropPhotos:dropPhotos,tombstones:Array.from(tombs.values())};
  }
  function queueOp(box,op){
    const next=(box||[]).filter(function(x){return !(x&&x.op===op.op&&x.id===op.id&&x.kind===op.kind)});
    next.push(op);
    return next;
  }
  function drainOps(box,online){
    const list=box||[];
    if(!online)return {send:[],keep:list.slice()};
    return {send:list.slice(),keep:[]};
  }
  function plain(obj){
    try{return JSON.parse(JSON.stringify(obj))}catch(e){return null}
  }
  function isQuotaError(err){
    const code=String(err&&(err.code||err.status)||'');
    const msg=String(err&&err.message||err||'');
    return code==='resource-exhausted'||code==='429'||/resource-exhausted|\b429\b|quota exceeded/i.test(code+' '+msg);
  }
  function quotaMessage(){
    return 'Firebase has hit its daily write limit. Changes stay on this phone and will sync after the limit resets. Nothing on this phone was cleared.';
  }
  /* A normal day: real edits and a real reorder upload those documents only.
     Opening a job, hiding the app, and reloading do not upload unchanged worksheets. */
  function simulateSyncDay(count,steps){
    const jobs=[];
    const forms={};
    for(let i=0;i<count;i++){
      const id='job-'+i;
      jobs.push({id:id,addr:i+' Street, Yamba NSW 2464',order:i+1,agent:'RWM',section:'Permanent'});
      forms[id]={date:'2026-11-14',alarms:1,comments:'',al:[{yn:{cleaned:'Yes'}}]};
    }
    const acked=new Map();
    jobs.forEach(function(j){acked.set(j.id,contentSig(j,forms[j.id]))});
    let writes=0;
    let box=[];
    function queueChanged(){
      jobs.forEach(function(j){
        if(acked.get(j.id)!==contentSig(j,forms[j.id]||null))box=queueOp(box,{op:'job',id:j.id});
      });
    }
    function flushNow(){
      const drained=drainOps(box,true);
      box=drained.keep.slice();
      drained.send.forEach(function(op){
        const job=jobs.find(function(j){return j.id===op.id});
        const sig=contentSig(job,forms[op.id]||null);
        if(acked.get(op.id)!==sig){writes++;acked.set(op.id,sig)}
      });
    }
    (steps||[]).forEach(function(step){
      if(step.type==='edit'){
        forms[step.id].comments=step.comments;
        forms[step.id].updated=step.at||'2026-11-14T01:00:00.000Z';
        queueChanged();
        flushNow();
      }else if(step.type==='open'||step.type==='reload'){
        if(step.id&&forms[step.id])forms[step.id].updated=step.at||'2026-11-14T02:00:00.000Z';
        queueChanged();
        flushNow();
      }else if(step.type==='calendar'){
        jobs.forEach(function(j,i){j.order=i+1});
        queueChanged();
        flushNow();
      }else if(step.type==='reorder'){
        (step.ids||[]).forEach(function(id,i){
          const job=jobs.find(function(j){return j.id===id});
          if(job)job.order=i+1;
        });
        queueChanged();
        flushNow();
      }
    });
    return writes;
  }

  const state={configured:false,user:null,phase:'signed-out',lastSync:'',unsyncedPhotos:0,error:'',help:null};
  let hooks=null,booted=false,applying=false,armed=false,db=null,auth=null,fb=null;
  let unsubs=[],flushTimer=null,applyTimer=null,unsynced=new Set();
  const jobSnap=new Map();
  const acked=new Map();
  let quotaUntil=0;
  const remote={jobs:[],forms:{},photos:[],tombstones:[]};
  function quotaHeld(){return !!(quotaUntil&&Date.now()<quotaUntil)}
  function holdQuota(){quotaUntil=Date.now()+6*60*60*1000;state.phase='paused';state.error=quotaMessage()}
  function localSig(id){
    const jobs=hooks&&hooks.getJobs?hooks.getJobs()||[]:[];
    const job=jobs.find(function(j){return j&&String(j.id)===String(id)});
    if(!job)return '';
    const form=hooks&&hooks.getForms?(hooks.getForms()||{})[id]||null:null;
    return contentSig(job,form);
  }
  function enqueueIfChanged(id){
    const sig=localSig(id);
    if(!sig||acked.get(String(id))===sig)return;
    enqueue({op:'job',id:id});
  }

  function paint(){
    if(!hooks||!hooks.paint)return;
    try{hooks.paint()}catch(e){}
  }
  function readStore(key,fallback){
    try{
      const raw=hooks.storage.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch(e){return fallback}
  }
  function writeStore(key,value){
    try{hooks.storage.setItem(key,JSON.stringify(value))}catch(e){}
  }
  function meta(){return readStore(META_KEY,{backedUpUid:'',mergedUid:'',lastSync:''})||{}}
  function outbox(){return readStore(OUTBOX_KEY,[])||[]}
  function tombs(){return readStore(TOMB_KEY,[])||[]}
  function setOutbox(list){writeStore(OUTBOX_KEY,list)}
  function setTombs(list){writeStore(TOMB_KEY,list)}
  function enqueue(op){setOutbox(queueOp(outbox(),op))}
  function userRef(){return state.user&&state.user.uid}
  function col(name){return fb.collection(db,'users',userRef(),name)}
  function jobRef(id){return fb.doc(db,'users',userRef(),'jobs',docId(id))}
  function photoRef(id){return fb.doc(db,'users',userRef(),'photos',docId(id))}
  function tombRef(kind,id){return fb.doc(db,'users',userRef(),'tombstones',docId(kind+':'+id))}

  async function collect(){
    const photos=await hooks.photoAll().catch(function(){return []});
    return {
      jobs:hooks.getJobs()||[],
      forms:hooks.getForms()||{},
      photos:(photos||[]).map(function(p){return {id:p.id,ts:p.ts,job:p.job,slot:p.slot,type:p.type,w:p.w,h:p.h}}),
      tombstones:tombs()
    };
  }
  function arm(){
    jobSnap.clear();
    (hooks.getJobs()||[]).forEach(function(j){
      if(!j||!j.id)return;
      const copy=Object.assign({},j);
      delete copy.updated;
      jobSnap.set(j.id,JSON.stringify(copy));
    });
    armed=true;
  }
  function stampJobs(){
    const now=new Date().toISOString();
    (hooks.getJobs()||[]).forEach(function(j){
      if(!j||!j.id)return;
      const copy=Object.assign({},j);
      delete copy.updated;
      const sig=JSON.stringify(copy);
      if(jobSnap.get(j.id)!==sig){
        j.updated=now;
        jobSnap.set(j.id,sig);
        enqueueIfChanged(j.id);
      }
    });
  }
  function snapshotJobs(snap){
    const jobs=[],forms={};
    snap.forEach(function(d){
      const data=d.data()||{};
      if(!data.job||!data.job.id||data.deleted)return;
      jobs.push(data.job);
      if(data.form)forms[data.job.id]=data.form;
    });
    remote.jobs=jobs;remote.forms=forms;
  }
  function snapshotPhotos(snap){
    const photos=[];
    snap.forEach(function(d){
      const data=d.data()||{};
      if(!data.id||data.deleted)return;
      photos.push(data);
    });
    remote.photos=photos;
  }
  function snapshotTombs(snap){
    const list=[];
    snap.forEach(function(d){
      const data=d.data()||{};
      if(data.id)list.push(data);
    });
    remote.tombstones=list;
  }
  let pendingApply=false;
  async function applyRemote(){
    if(applying){pendingApply=true;return}
    if(!state.user)return;
    applying=true;
    state.phase=navigator.onLine?'syncing':'offline';
    paint();
    try{
      const local=await collect();
      const result=reconcile(local,remote);
      await hooks.applyResult(result);
      (result.jobs||[]).forEach(function(j){
        if(!j||!j.id)return;
        if((result.pushJobs||[]).some(function(id){return String(id)===String(j.id)}))return;
        acked.set(String(j.id),contentSig(j,result.forms[j.id]||null));
      });
      (result.pushJobs||[]).forEach(function(id){enqueueIfChanged(id)});
      (result.pushPhotos||[]).forEach(function(id){enqueue({op:'photo',id:id})});
      arm();
      if(navigator.onLine)await flush();
      else if(state.phase!=='paused'){state.phase='offline';state.error=''}
      if(state.phase!=='offline'&&state.phase!=='paused'){state.phase='synced';state.lastSync=new Date().toISOString();state.error='';const m=meta();m.lastSync=state.lastSync;m.mergedUid=state.user.uid;writeStore(META_KEY,m)}
      state.unsyncedPhotos=unsynced.size;
    }catch(e){
      if(state.phase!=='paused'){
        state.phase=navigator.onLine?'synced':'offline';
        state.error='Sync paused. Worksheets on this device were kept.';
      }
    }finally{
      applying=false;
      paint();
      if(pendingApply){pendingApply=false;scheduleApply()}
    }
  }
  function scheduleApply(){
    clearTimeout(applyTimer);
    applyTimer=setTimeout(function(){applyRemote().catch(function(){})},200);
  }
  async function uploadPhoto(id){
    const rec=await hooks.photoGet(id);
    if(!rec||!rec.data)return;
    const len=rec.data.byteLength||rec.data.length||0;
    if(!photoFits(len)){unsynced.add(id);return}
    unsynced.delete(id);
    const b64=hooks.toB64(rec.data);
    if(b64.length+1024>=MAX_DOC){unsynced.add(id);return}
    await fb.setDoc(photoRef(id),plain({id:rec.id,job:rec.job||'',slot:rec.slot||'',type:rec.type||'image/jpeg',w:rec.w||0,h:rec.h||0,ts:rec.ts||new Date().toISOString(),b64:b64}));
  }
  function jobPayload(id){
    const jobs=hooks.getJobs()||[];
    const job=jobs.find(function(j){return j&&String(j.id)===String(id)});
    if(!job)return null;
    const form=(hooks.getForms()||{})[id]||null;
    const updated=new Date(Math.max(timeOf(job.updated),timeOf(form&&form.updated))||Date.now()).toISOString();
    const copy=Object.assign({},job);
    if(!copy.updated)copy.updated=updated;
    return {data:plain({id:String(job.id),job:copy,form:form,updated:updated,deleted:false}),sig:contentSig(job,form)};
  }
  async function commitJobOps(items){
    const CHUNK=400;
    for(let i=0;i<items.length;i+=CHUNK){
      const chunk=items.slice(i,i+CHUNK);
      const batch=fb.writeBatch(db);
      const ready=[];
      chunk.forEach(function(item){
        const built=jobPayload(item.op.id);
        if(!built||!built.data)return;
        batch.set(jobRef(item.op.id),built.data);
        ready.push({id:item.op.id,sig:built.sig});
      });
      if(!ready.length)continue;
      await batch.commit();
      ready.forEach(function(item){acked.set(String(item.id),item.sig)});
    }
  }
  async function flush(){
    if(!state.user||!db)return;
    if(quotaHeld()){state.phase='paused';state.error=quotaMessage();paint();return}
    if(typeof navigator!=='undefined'&&navigator.onLine===false){state.phase='offline';paint();return}
    const drained=drainOps(outbox(),true);
    if(!drained.send.length){if(state.phase!=='synced'&&state.phase!=='paused'){state.phase='synced';paint()}return}
    state.phase='syncing';paint();
    const failed=[];
    const jobOps=[];
    const other=[];
    drained.send.forEach(function(op){
      if(op.op==='job'){
        const sig=localSig(op.id);
        if(!sig||acked.get(String(op.id))===sig)return;
        jobOps.push({op:op,sig:sig});
      }else other.push(op);
    });
    try{await commitJobOps(jobOps)}
    catch(e){
      const leftover=jobOps.filter(function(item){return acked.get(String(item.op.id))!==item.sig}).map(function(item){return item.op});
      if(isQuotaError(e)){holdQuota();failed.push.apply(failed,leftover.concat(other));other.length=0}
      else failed.push.apply(failed,leftover);
    }
    if(!quotaHeld()){
      for(let i=0;i<other.length;i++){
        const op=other[i];
        try{
          if(op.op==='photo')await uploadPhoto(op.id);
          else if(op.op==='tomb')await fb.setDoc(tombRef(op.kind||'job',op.id),plain({kind:op.kind||'job',id:op.id,at:op.at}));
        }catch(e){
          if(isQuotaError(e)){holdQuota();failed.push.apply(failed,other.slice(i));break}
          failed.push(op);
        }
      }
    }
    setOutbox(failed.concat(drainOps(outbox(),false).keep.filter(function(op){
      return !drained.send.some(function(sent){return sent.op===op.op&&sent.id===op.id&&sent.kind===op.kind});
    })));
    state.unsyncedPhotos=unsynced.size;
    if(quotaHeld()){state.phase='paused';state.error=quotaMessage()}
    else if(failed.length){state.phase='offline';state.error='Some changes are still only on this device. They will sync when the connection is back.'}
    else{state.phase='synced';state.error='';state.lastSync=new Date().toISOString();const m=meta();m.lastSync=state.lastSync;writeStore(META_KEY,m)}
    paint();
  }
  function scheduleFlush(){
    clearTimeout(flushTimer);
    if(quotaHeld()){state.phase='paused';state.error=quotaMessage();paint();return}
    flushTimer=setTimeout(function(){flush().catch(function(){if(state.phase!=='paused'){state.phase='offline';paint()}})},1000);
  }
  async function pullOnce(){
    const jobsSnap=await fb.getDocs(col('jobs'));
    const photoSnap=await fb.getDocs(col('photos'));
    const tombSnap=await fb.getDocs(col('tombstones'));
    snapshotJobs(jobsSnap);
    snapshotPhotos(photoSnap);
    snapshotTombs(tombSnap);
    await applyRemote();
  }
  function listen(){
    unsubs.forEach(function(fn){try{fn()}catch(e){}});
    unsubs=[
      fb.onSnapshot(col('jobs'),function(snap){snapshotJobs(snap);scheduleApply()},function(){state.phase='offline';paint()}),
      fb.onSnapshot(col('photos'),function(snap){snapshotPhotos(snap);scheduleApply()},function(){state.phase='offline';paint()}),
      fb.onSnapshot(col('tombstones'),function(snap){snapshotTombs(snap);scheduleApply()},function(){state.phase='offline';paint()})
    ];
  }
  async function onUser(user){
    if(!user){
      unsubs.forEach(function(fn){try{fn()}catch(e){}});
      unsubs=[];
      acked.clear();
      state.user=null;
      state.phase='signed-out';
      paint();
      return;
    }
    state.user={uid:user.uid,email:user.email||''};
    state.phase='syncing';
    state.error='';
    state.help=null;
    paint();
    try{
      const m=meta();
      const local=await collect();
      const hasLocal=(local.jobs&&local.jobs.length)||Object.keys(local.forms||{}).length||(local.photos&&local.photos.length);
      if(hasLocal&&m.backedUpUid!==user.uid){
        await hooks.backup();
        m.backedUpUid=user.uid;
        writeStore(META_KEY,m);
      }
      await pullOnce();
      listen();
      m.mergedUid=user.uid;
      writeStore(META_KEY,m);
    }catch(e){
      state.phase='offline';
      state.error='Sync could not start. Worksheets on this device were kept.';
      paint();
    }
  }
  async function loadSdk(){
    const cfg=globalThis.CCSA_FIREBASE;
    const appMod=await import(CDN+'firebase-app.js');
    const authMod=await import(CDN+'firebase-auth.js');
    const storeMod=await import(CDN+'firebase-firestore.js');
    const app=appMod.initializeApp(cfg);
    auth=authMod.getAuth(app);
    try{
      db=storeMod.initializeFirestore(app,{localCache:storeMod.persistentLocalCache({tabManager:storeMod.persistentMultipleTabManager()})});
    }catch(e){
      try{db=storeMod.initializeFirestore(app,{localCache:storeMod.persistentLocalCache()})}
      catch(e2){db=storeMod.getFirestore(app)}
    }
    fb={
      doc:storeMod.doc,collection:storeMod.collection,getDoc:storeMod.getDoc,getDocs:storeMod.getDocs,onSnapshot:storeMod.onSnapshot,setDoc:storeMod.setDoc,deleteDoc:storeMod.deleteDoc,writeBatch:storeMod.writeBatch,
      GoogleAuthProvider:authMod.GoogleAuthProvider,signInWithPopup:authMod.signInWithPopup,signInWithRedirect:authMod.signInWithRedirect,getRedirectResult:authMod.getRedirectResult,onAuthStateChanged:authMod.onAuthStateChanged,signOut:authMod.signOut,
      getAuth:authMod.getAuth,createUserWithEmailAndPassword:authMod.createUserWithEmailAndPassword,sendPasswordResetEmail:authMod.sendPasswordResetEmail,
      initializeApp:appMod.initializeApp,getApp:appMod.getApp
    };
    return authMod;
  }
  function browserEnv(){
    const nav=typeof navigator!=='undefined'?navigator:{};
    let displayMode='';
    try{
      if(window.matchMedia){
        if(window.matchMedia('(display-mode: standalone)').matches)displayMode='standalone';
        else if(window.matchMedia('(display-mode: fullscreen)').matches)displayMode='fullscreen';
      }
    }catch(e){}
    return {userAgent:nav.userAgent||'',platform:nav.platform||'',maxTouchPoints:nav.maxTouchPoints||0,standalone:nav.standalone===true,displayMode:displayMode};
  }
  function signInFailure(code, host){
    const site=host||'this site';
    let msg;
    if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request')msg='Sign-in was cancelled. Worksheets on this device were not changed.';
    else if(code==='auth/unauthorized-domain')msg='Google sign-in is blocked for '+site+'. In the Firebase console open Authentication, then Settings, then Authorized domains, and add '+site+'. Worksheets on this device were not changed.';
    else if(code==='auth/popup-blocked')msg='The browser blocked the Google window. Allow popups for this site, then tap Sign in again. Worksheets on this device were not changed.';
    else if(code==='auth/operation-not-supported-in-this-environment')msg='This app cannot open the Google sign-in window.';
    else if(code==='auth/web-storage-unsupported')msg='This browser is blocking the storage Google sign-in needs.';
    else if(code==='auth/network-request-failed')msg='Sign-in could not reach Google. Check the connection and try again. Worksheets on this device were not changed.';
    else if(code==='auth/missing-redirect-result')msg='Google sent the browser back without a sign-in. This installed app did not receive it.';
    else msg='Sign-in did not finish. Worksheets on this device were not changed.';
    return code?msg+' ('+code+')':msg;
  }
  function redirectFollowUp(o){
    o=o||{};
    if(o.hasUser)return {error:'',help:false};
    const env=o.env||{};
    if(o.code)return {error:signInFailure(o.code,o.host,env),help:!!browserHelp(env)};
    if(o.pending)return {error:signInFailure('auth/missing-redirect-result',o.host,env),help:!!browserHelp(env)};
    return {error:'',help:false};
  }
  const REDIRECT_KEY='ccsa.sync.redirect';
  function markRedirect(){try{sessionStorage.setItem(REDIRECT_KEY,'1')}catch(e){}}
  function clearRedirect(){try{sessionStorage.removeItem(REDIRECT_KEY)}catch(e){}}
  function redirectPending(){try{return sessionStorage.getItem(REDIRECT_KEY)==='1'}catch(e){return false}}
  function showSignInError(code, env){
    state.error=signInFailure(code,pageHost(),env);
    const help=browserHelp(env);
    if(help)state.help=withHref(help);
    paint();
  }
  async function signIn(){
    if(!state.configured){state.error="Sync isn't set up yet";paint();return}
    const env=browserEnv();
    const plan=signInPlan(env);
    if(plan==='open-browser'){
      state.error='';
      state.help=withHref(browserHelp(env));
      paint();
      return;
    }
    if(!auth||!fb){state.error='Sync is not connected yet. Your worksheets on this device were not changed.';paint();return}
    const provider=new fb.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    state.error='';
    try{
      await fb.signInWithPopup(auth,provider);
      state.help=null;
    }catch(e){
      const code=e&&e.code||'';
      if(code==='auth/popup-closed-by-user'){showSignInError(code,env);return}
      const canRedirect=plan==='popup-then-redirect'&&(code==='auth/popup-blocked'||code==='auth/operation-not-supported-in-this-environment'||code==='auth/web-storage-unsupported'||code==='auth/cancelled-popup-request');
      if(canRedirect){
        try{
          markRedirect();
          await fb.signInWithRedirect(auth,provider);
          return;
        }catch(e2){
          clearRedirect();
          showSignInError((e2&&e2.code)||code,env);
          return;
        }
      }
      showSignInError(code,env);
    }
  }
  async function signOut(){
    if(auth&&fb){try{await fb.signOut(auth)}catch(e){}}
    state.user=null;state.phase='signed-out';state.error='';
    state.help=withHref(openingHelp(browserEnv()));
    paint();
  }
  function afterSave(key){
    if(!armed||applying||!hooks)return;
    if(key===hooks.jobsKey){
      stampJobs();
      applying=true;
      try{if(hooks.persistJobs)hooks.persistJobs()}finally{applying=false}
    }
    else if(key===hooks.formsKey){
      const forms=hooks.getForms()||{};
      Object.keys(forms).forEach(function(id){enqueueIfChanged(id)});
    }else return;
    if(typeof navigator!=='undefined'&&navigator.onLine===false){state.phase=state.user?'offline':state.phase;paint();return}
    if(state.user)scheduleFlush();
  }
  function afterPhoto(rec){
    if(!armed||applying||!rec||!rec.id)return;
    const len=rec.data?rec.data.byteLength||rec.data.length||0:0;
    if(len&&!photoFits(len)){unsynced.add(rec.id);state.unsyncedPhotos=unsynced.size;paint();return}
    enqueue({op:'photo',id:rec.id});
    if(state.user)scheduleFlush();
  }
  function afterPhotoDelete(id){
    if(!id)return;
    const at=new Date().toISOString();
    const list=tombs().filter(function(t){return !(t.kind==='photo'&&t.id===id)});
    list.push({kind:'photo',id:id,at:at});
    setTombs(list);
    unsynced.delete(id);
    enqueue({op:'tomb',kind:'photo',id:id,at:at});
    if(state.user)scheduleFlush();
  }
  async function beforeClearAll(){
    const at=new Date().toISOString();
    const list=tombs();
    (hooks.getJobs()||[]).forEach(function(j){if(j&&j.id){list.push({kind:'job',id:j.id,at:at});enqueue({op:'tomb',kind:'job',id:j.id,at:at})}});
    try{
      const photos=await hooks.photoAll();
      (photos||[]).forEach(function(p){if(p&&p.id){list.push({kind:'photo',id:p.id,at:at});enqueue({op:'tomb',kind:'photo',id:p.id,at:at})}});
    }catch(e){}
    setTombs(list);
    if(state.user){try{await flush()}catch(e){}}
  }
  async function boot(nextHooks){
    if(booted)return;
    booted=true;
    hooks=nextHooks;
    const cfg=globalThis.CCSA_FIREBASE;
    state.configured=configReady(cfg);
    state.lastSync=(meta().lastSync)||'';
    if(globalThis.CCSA_SYNC_DISABLED){
      state.phase=state.configured?'signed-out':'unconfigured';
      paint();
      return;
    }
    if(!state.configured){state.phase='unconfigured';paint();return}
    state.phase='signed-out';
    state.help=withHref(openingHelp(browserEnv()));
    paint();
    arm();
    try{await loadSdk()}
    catch(e){
      state.phase='offline';
      state.error='Could not reach Firebase. Worksheets on this device were kept.';
      paint();
      return;
    }
    const env=browserEnv();
    const pending=redirectPending();
    try{
      const result=await fb.getRedirectResult(auth);
      clearRedirect();
      const follow=redirectFollowUp({pending:pending,hasUser:!!(result&&result.user),code:'',host:pageHost(),env:env});
      if(follow.error){state.error=follow.error;if(follow.help)state.help=withHref(browserHelp(env));paint()}
    }catch(e){
      clearRedirect();
      const follow=redirectFollowUp({pending:true,hasUser:false,code:(e&&e.code)||'',host:pageHost(),env:env});
      state.error=follow.error;
      if(follow.help)state.help=withHref(browserHelp(env));
      paint();
    }
    fb.onAuthStateChanged(auth,function(user){onUser(user).catch(function(){state.phase='offline';paint()})});
    if(typeof window!=='undefined'){
      window.addEventListener('online',function(){if(state.user)flush().catch(function(){})});
      window.addEventListener('offline',function(){if(state.user){state.phase='offline';paint()}});
    }
  }
  function current(){
    return {configured:state.configured,user:state.user,phase:state.phase,lastSync:state.lastSync,unsyncedPhotos:state.unsyncedPhotos,error:state.error,help:state.help};
  }
  function client(){
    return {auth:auth,db:db,fb:fb,ready:!!(auth&&db&&fb)};
  }
  return {
    configReady:configReady,signInPlan:signInPlan,browserHelp:browserHelp,openingHelp:openingHelp,signInFailure:signInFailure,redirectFollowUp:redirectFollowUp,docId:docId,photoFits:photoFits,statusLabel:statusLabel,panelHTML:panelHTML,
    reconcile:reconcile,queueOp:queueOp,drainOps:drainOps,plain:plain,
    contentSig:contentSig,needsPush:needsPush,isQuotaError:isQuotaError,quotaMessage:quotaMessage,simulateSyncDay:simulateSyncDay,
    boot:boot,signIn:signIn,signOut:signOut,afterSave:afterSave,afterPhoto:afterPhoto,afterPhotoDelete:afterPhotoDelete,beforeClearAll:beforeClearAll,
    client:client,state:current
  };
});
