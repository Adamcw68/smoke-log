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
  function preferRedirect(nav){
    nav=nav||{};
    const ua=String(nav.userAgent||'');
    const ios=/iPad|iPhone|iPod/.test(ua)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
    const standalone=nav.standalone===true||nav.displayMode==='standalone';
    return !!(ios&&standalone);
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
    let buttons='';
    if(state.configured&&state.user)buttons='<button type="button" class="btn" id="syncout">Sign out</button>';
    else if(state.configured)buttons='<button type="button" class="btn pri" id="syncin">Sign in</button>';
    const setup=state.configured?'':'<p class="note">Sync is off until a Firebase web config is saved in firebase-config.js. Jobs on this device are unchanged.</p>';
    return '<section class="f" id="syncpanel" aria-label="Sync"><h2>Sync</h2>'
      +'<p id="syncstatus"><b>'+esc(label)+'</b></p>'
      +(account?'<p class="note" id="syncaccount">'+esc(account)+'</p>':'')
      +(when?'<p class="note" id="synctime">'+esc(when)+'</p>':'')
      +(photoNote?'<p class="note" id="syncphoto">'+esc(photoNote)+'</p>':'')
      +(state.error?'<p class="note">'+esc(state.error)+'</p>':'')
      +setup
      +'<p class="note">Saved PDFs stay on this device. On another device, open the worksheet and tap Make PDF.</p>'
      +buttons+'</section>';
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
  /* Newest worksheet wins. A record that exists on only one side is kept.
     A tombstone removes a record only when the delete is newer than that record. */
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
      const other=remoteJob.get(String(j.id));
      const lt=jobTime(j,merged.forms);
      const rt=other?jobTime(other,remoteForms):0;
      if(!other||lt>rt)pushJobs.push(j.id);
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

  const state={configured:false,user:null,phase:'signed-out',lastSync:'',unsyncedPhotos:0,error:''};
  let hooks=null,booted=false,applying=false,armed=false,db=null,auth=null,fb=null;
  let unsubs=[],flushTimer=null,applyTimer=null,unsynced=new Set();
  const jobSnap=new Map();
  const remote={jobs:[],forms:{},photos:[],tombstones:[]};

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
        enqueue({op:'job',id:j.id});
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
      (result.pushJobs||[]).forEach(function(id){enqueue({op:'job',id:id})});
      (result.pushPhotos||[]).forEach(function(id){enqueue({op:'photo',id:id})});
      arm();
      if(navigator.onLine)await flush();
      else{state.phase='offline';state.error=''}
      if(state.phase!=='offline'){state.phase='synced';state.lastSync=new Date().toISOString();state.error='';const m=meta();m.lastSync=state.lastSync;m.mergedUid=state.user.uid;writeStore(META_KEY,m)}
      state.unsyncedPhotos=unsynced.size;
    }catch(e){
      state.phase=navigator.onLine?'synced':'offline';
      state.error='Sync paused. Worksheets on this device were kept.';
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
  async function uploadJob(id){
    const jobs=hooks.getJobs()||[];
    const job=jobs.find(function(j){return j&&j.id===id});
    if(!job)return;
    const form=(hooks.getForms()||{})[id]||null;
    const updated=new Date(Math.max(timeOf(job.updated),timeOf(form&&form.updated))||Date.now()).toISOString();
    if(!job.updated)job.updated=updated;
    await fb.setDoc(jobRef(id),plain({id:id,job:job,form:form,updated:updated,deleted:false}));
  }
  async function flush(){
    if(!state.user||!db)return;
    if(typeof navigator!=='undefined'&&navigator.onLine===false){state.phase='offline';paint();return}
    const drained=drainOps(outbox(),true);
    if(!drained.send.length){if(state.phase!=='synced'){state.phase='synced';paint()}return}
    state.phase='syncing';paint();
    const failed=[];
    for(let i=0;i<drained.send.length;i++){
      const op=drained.send[i];
      try{
        if(op.op==='job')await uploadJob(op.id);
        else if(op.op==='photo')await uploadPhoto(op.id);
        else if(op.op==='tomb')await fb.setDoc(tombRef(op.kind||'job',op.id),plain({kind:op.kind||'job',id:op.id,at:op.at}));
      }catch(e){failed.push(op)}
    }
    setOutbox(failed.concat(drainOps(outbox(),false).keep.filter(function(op){
      return !drained.send.some(function(sent){return sent.op===op.op&&sent.id===op.id&&sent.kind===op.kind});
    })));
    state.unsyncedPhotos=unsynced.size;
    if(failed.length){state.phase='offline';state.error='Some changes are still only on this device. They will sync when the connection is back.'}
    else{state.phase='synced';state.error='';state.lastSync=new Date().toISOString();const m=meta();m.lastSync=state.lastSync;writeStore(META_KEY,m)}
    paint();
  }
  function scheduleFlush(){
    clearTimeout(flushTimer);
    flushTimer=setTimeout(function(){flush().catch(function(){state.phase='offline';paint()})},400);
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
      state.user=null;
      state.phase='signed-out';
      state.error='';
      paint();
      return;
    }
    state.user={uid:user.uid,email:user.email||''};
    state.phase='syncing';
    state.error='';
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
      doc:storeMod.doc,collection:storeMod.collection,getDocs:storeMod.getDocs,onSnapshot:storeMod.onSnapshot,setDoc:storeMod.setDoc,
      GoogleAuthProvider:authMod.GoogleAuthProvider,signInWithPopup:authMod.signInWithPopup,signInWithRedirect:authMod.signInWithRedirect,getRedirectResult:authMod.getRedirectResult,onAuthStateChanged:authMod.onAuthStateChanged,signOut:authMod.signOut
    };
    return authMod;
  }
  function browserEnv(){
    const nav=typeof navigator!=='undefined'?navigator:{};
    let displayMode='';
    try{displayMode=window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches?'standalone':''}catch(e){}
    return {userAgent:nav.userAgent||'',platform:nav.platform||'',maxTouchPoints:nav.maxTouchPoints||0,standalone:nav.standalone===true,displayMode:displayMode};
  }
  async function signIn(){
    if(!state.configured){state.error="Sync isn't set up yet";paint();return}
    if(!auth){state.error='Sync is not connected yet. Your worksheets on this device were not changed.';paint();return}
    const provider=new fb.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    state.error='';
    try{
      if(preferRedirect(browserEnv()))await fb.signInWithRedirect(auth,provider);
      else await fb.signInWithPopup(auth,provider);
    }catch(e){
      const code=e&&e.code||'';
      if(!preferRedirect(browserEnv())&&(code==='auth/popup-blocked'||code==='auth/operation-not-supported-in-this-environment')){
        try{await fb.signInWithRedirect(auth,provider);return}catch(e2){}
      }
      if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request'){state.error='Sign-in was cancelled. Worksheets on this device were not changed.';paint();return}
      state.error='Sign-in did not finish. Worksheets on this device were not changed.';
      paint();
    }
  }
  async function signOut(){
    if(auth&&fb){try{await fb.signOut(auth)}catch(e){}}
    state.user=null;state.phase='signed-out';state.error='';
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
      Object.keys(forms).forEach(function(id){enqueue({op:'job',id:id})});
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
    paint();
    arm();
    try{await loadSdk()}
    catch(e){
      state.phase='offline';
      state.error='Could not reach Firebase. Worksheets on this device were kept.';
      paint();
      return;
    }
    try{await fb.getRedirectResult(auth)}catch(e){}
    fb.onAuthStateChanged(auth,function(user){onUser(user).catch(function(){state.phase='offline';paint()})});
    if(typeof window!=='undefined'){
      window.addEventListener('online',function(){if(state.user)flush().catch(function(){})});
      window.addEventListener('offline',function(){if(state.user){state.phase='offline';paint()}});
    }
  }
  function current(){
    return {configured:state.configured,user:state.user,phase:state.phase,lastSync:state.lastSync,unsyncedPhotos:state.unsyncedPhotos,error:state.error};
  }
  return {
    configReady:configReady,preferRedirect:preferRedirect,docId:docId,photoFits:photoFits,statusLabel:statusLabel,panelHTML:panelHTML,
    reconcile:reconcile,queueOp:queueOp,drainOps:drainOps,plain:plain,
    boot:boot,signIn:signIn,signOut:signOut,afterSave:afterSave,afterPhoto:afterPhoto,afterPhotoDelete:afterPhotoDelete,beforeClearAll:beforeClearAll,
    state:current
  };
});
