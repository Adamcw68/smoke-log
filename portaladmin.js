/* Agency logins and publishing, from the technician app.
   Writes go to portal/{agency}. The worksheet store on this phone is not cleared.
   Nothing here calls Google Calendar. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSAPortal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const data=function(){
    if(typeof CCSAPortalData!=='undefined')return CCSAPortalData;
    if(typeof require==='function'){try{return require('./portaldata.js')}catch(e){return null}}
    return null;
  };
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function tempPassword(){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes=new Uint8Array(10);
    if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    let out='';
    for(let i=0;i<bytes.length;i++)out+=alphabet[bytes[i]%alphabet.length];
    return out;
  }
  const state={
    configured:false,signedIn:false,email:'',uid:'',isAdmin:false,adminChecked:false,
    draftEmail:'',agencyCode:'Ray White Maclean/Yamba',password:'',logins:[],auto:true,
    message:'',busy:false,showOnce:null
  };
  let hooks=null,pending=false;

  function portalUrl(){
    try{return new URL('portal/',location.href).href}catch(e){return 'portal/'}
  }
  function client(){
    if(!hooks||!hooks.client)return {ready:false};
    try{return hooks.client()||{ready:false}}catch(e){return {ready:false}}
  }
  function lib(){return data()}
  function panelHTML(){
    const portal=lib();
    if(!portal)return '<section class="f" id="portalpanel"><h2>Agency portal</h2><p class="note">Portal scripts did not load. Jobs on this phone were not changed.</p></section>';
    const agencies=portal.agencies();
    const options=agencies.map(function(a){return '<option value="'+esc(a.code)+'"'+(state.agencyCode===a.code?' selected':'')+'>'+esc(a.name)+'</option>'}).join('');
    const logins=state.logins.length?state.logins.map(function(row){
      return '<div class="row" data-login="'+esc(row.uid)+'"><span class="note" style="flex:2">'+esc(row.email)+' · '+esc(row.agencyCode)+(row.disabled?' · off':'')+'</span>'+(row.disabled?'<button type="button" data-portal-enable="'+esc(row.uid)+'">Turn on</button>':'<button type="button" data-portal-disable="'+esc(row.uid)+'">Turn off</button>')+'</div>';
    }).join(''):'<p class="note">No agency logins yet.</p>';
    const once=state.showOnce?'<div class="note" id="portalonce"><b>Give this to the agency once.</b> It is not stored.<br>'+esc(state.showOnce.agency)+'<br>'+esc(state.showOnce.email)+'<br>Password: '+esc(state.showOnce.password)+'<br>'+esc(state.showOnce.url)+'<br><button type="button" id="portalcopy">Copy password</button> <button type="button" id="portalreset">Email password reset</button></div>':'';
    const host=typeof location!=='undefined'?location.hostname:'adamcw68.github.io';
    const steps=portal.setupSteps(state.uid||'',host);
    const admin=state.signedIn&&state.isAdmin;
    const tools=admin?`<details open><summary>Create an agency login</summary>
      <label class="l" for="portalagency">Agency</label><select class="t" id="portalagency">${options}</select>
      <label class="l" for="portalemail">Email</label><input class="t" id="portalemail" type="email" autocomplete="off" value="${esc(state.draftEmail)}">
      <label class="l" for="portalpass">Temporary password</label><input class="t" id="portalpass" type="text" autocomplete="off" value="${esc(state.password)}">
      <p class="note">Shown so you can pass it on. It is not saved in the portal.</p>
      <div class="row"><button type="button" id="portalnewpass">New password</button><button type="button" class="pri" id="portalcreate" ${state.busy?'disabled':''}>Create login</button></div>
      ${once}
      </details>
      <h2>Logins</h2>${logins}
      <label class="tog"><span>Publish when a job is archived or marked done</span><input type="checkbox" id="portalauto" ${state.auto?'checked':''}></label>
      <button type="button" class="btn pri" id="portalpub" ${state.busy?'disabled':''}>Publish to portal</button>`:'';
    const signed=state.signedIn?`<p class="note" id="portalaccount">${esc(state.email)} · uid ${esc(state.uid)}${state.isAdmin?' · admin':''}</p>`:'<p class="note">Sign in with Sync before creating a login or publishing. Worksheets on this phone stay here.</p>';
    return `<section class="f" id="portalpanel" aria-label="Agency portal"><h2>Agency portal</h2>
      <p class="note">Each agency signs in at its own portal and sees only its properties. Tenant names, phone numbers and email addresses are not published.</p>
      <p><a class="btn" href="portal/">Open agency portal</a> <a class="btn" href="#invoices">Invoice settings</a></p>
      ${signed}
      ${tools}
      ${state.message?'<p class="note" id="portalmsg">'+esc(state.message)+'</p>':''}
      <details><summary>Firebase setup</summary><p class="note" id="portalsteps" style="white-space:pre-wrap">${esc(steps)}</p></details>
      </section>`;
  }
  function repaint(){
    const el=typeof document!=='undefined'?document.getElementById('portalpanel'):null;
    if(!el)return;
    el.outerHTML=panelHTML();
    bind(document.getElementById('portalpanel'));
  }
  function say(message){
    state.message=message||'';
    if(hooks&&hooks.toast&&message)hooks.toast(message);
    repaint();
  }
  async function refreshLogins(){
    const c=client();
    if(!c.ready)return;
    const snap=await c.fb.getDocs(c.fb.collection(c.db,'agencyUsers'));
    const rows=[];
    snap.forEach(function(d){
      const item=d.data()||{};
      rows.push({uid:d.id,email:item.email||'',agencyCode:item.agencyCode||item.agencyId||'',disabled:!!item.disabled});
    });
    rows.sort(function(a,b){return a.email<b.email?-1:a.email>b.email?1:0});
    state.logins=rows;
  }
  async function refreshAdmin(){
    const c=client();
    if(!c.ready||!c.auth||!c.auth.currentUser){
      state.isAdmin=false;state.adminChecked=true;state.logins=[];return;
    }
    const uid=c.auth.currentUser.uid;
    const snap=await c.fb.getDoc(c.fb.doc(c.db,'admins',uid));
    state.isAdmin=snap.exists();
    state.adminChecked=true;
    if(state.isAdmin)await refreshLogins();
    else state.logins=[];
  }
  function onSync(){
    const c=client();
    const user=c.auth&&c.auth.currentUser;
    const uid=user?user.uid:'';
    const email=user?(user.email||''):'';
    if(uid===state.uid&&state.adminChecked)return;
    state.uid=uid;state.email=email;state.signedIn=!!uid;
    if(!uid){state.isAdmin=false;state.adminChecked=true;state.logins=[];repaint();return}
    state.adminChecked=false;
    refreshAdmin().then(repaint).catch(function(){
      state.adminChecked=true;state.isAdmin=false;
      state.message='Could not check the admin record. Jobs on this phone were not changed.';
      repaint();
    });
  }
  async function fetchJobs(c,agencyId){
    const snap=await c.fb.getDocs(c.fb.collection(c.db,'portal',agencyId,'jobs'));
    const list=[];
    snap.forEach(function(d){list.push(d.data())});
    return list;
  }
  async function commitPlan(c,agencyId,plan){
    const ops=[];
    (plan.properties||[]).forEach(function(row){ops.push({type:'set',ref:c.fb.doc(c.db,'portal',agencyId,'properties',row.id),data:row})});
    (plan.jobs||[]).forEach(function(row){ops.push({type:'set',ref:c.fb.doc(c.db,'portal',agencyId,'jobs',row.id),data:row})});
    (plan.certificates||[]).forEach(function(row){ops.push({type:'set',ref:c.fb.doc(c.db,'portal',agencyId,'certificates',row.id),data:row})});
    (plan.invoices||[]).forEach(function(row){ops.push({type:'set',ref:c.fb.doc(c.db,'portal',agencyId,'invoices',row.id),data:row})});
    (plan.deleteJobIds||[]).forEach(function(id){ops.push({type:'del',ref:c.fb.doc(c.db,'portal',agencyId,'jobs',id)})});
    (plan.deleteCertificateIds||[]).forEach(function(id){ops.push({type:'del',ref:c.fb.doc(c.db,'portal',agencyId,'certificates',id)})});
    let batch=c.fb.writeBatch(c.db),n=0;
    for(let i=0;i<ops.length;i++){
      if(ops[i].type==='set')batch.set(ops[i].ref,ops[i].data);
      else batch.delete(ops[i].ref);
      n++;
      if(n===400){await batch.commit();batch=c.fb.writeBatch(c.db);n=0}
    }
    if(n)await batch.commit();
  }
  async function publishAll(opts){
    if(state.busy){pending=true;return}
    const quiet=!!(opts&&opts.quiet);
    const portal=lib();
    const c=client();
    function note(message,force){
      state.message=message||'';
      if((!quiet||force)&&hooks&&hooks.toast&&message)hooks.toast(message);
      repaint();
    }
    if(!portal){note('Portal scripts did not load. Nothing was published.');return}
    if(!c.ready||!c.auth||!c.auth.currentUser){note('Sign in with Sync before publishing. Jobs on this phone were not changed.');return}
    if(!state.isAdmin){note('This Google account is not a portal admin yet. The steps are under Firebase setup. Nothing was published.');return}
    state.busy=true;state.message='Publishing…';repaint();
    try{
      const today=portal.sydneyToday();
      const now=new Date().toISOString();
      const built=portal.buildPortal(hooks.getJobs?hooks.getJobs():[],hooks.getForms?hooks.getForms():{},today,now);
      const hits=portal.bundleClean(built);
      if(hits.length)throw new Error('Publish stopped because tenant contact details were still in the portal data.');
      const ids=Object.keys(built.agencies);
      if(!ids.length){note('No jobs have an agency, so nothing was published.');return}
      let properties=0,certificates=0,visits=0,invoices=0;
      if(window.CCSAInvoice&&CCSAInvoice.syncDrafts)CCSAInvoice.syncDrafts();
      for(let i=0;i<ids.length;i++){
        const agency=built.agencies[ids[i]];
        const remote=await fetchJobs(c,ids[i]);
        const plan=portal.planWrites(agency,remote,today);
        if(portal.tenantHits(plan).length)throw new Error('Publish stopped because tenant contact details were still in the portal data.');
        plan.invoices=window.CCSAInvoice?CCSAInvoice.portalCopies(agency.id,today,now):[];
        if(window.CCSAInvoice&&CCSAInvoice.tenantHits(plan.invoices).length)throw new Error('Publish stopped because an invoice still had tenant contact details.');
        await commitPlan(c,ids[i],plan);
        properties+=plan.properties.length;certificates+=plan.certificates.length;visits+=plan.jobs.length;invoices+=plan.invoices.length;
      }
      note('Published '+visits+' visit'+(visits===1?'':'s')+', '+properties+' propert'+(properties===1?'y':'ies')+', '+certificates+' certificate'+(certificates===1?'':'s')+' and '+invoices+' invoice'+(invoices===1?'':'s')+'. Tenant contact details were left out. Draft invoices were not sent. Google Calendar was not changed.',true);
    }catch(e){
      const code=e&&e.code||'';
      if(code==='permission-denied')note('Firestore refused the publish. This account needs an admins document, and the latest rules need to be deployed. Jobs on this phone were not changed.',true);
      else note((e&&e.message)||'The portal was not updated. Jobs on this phone were not changed.',true);
    }finally{
      state.busy=false;repaint();
      if(pending){pending=false;publishAll()}
    }
  }
  function onArchived(){
    if(!state.auto)return;
    publishAll({quiet:true});
  }
  function secondaryAuth(c){
    const cfg=hooks.config?hooks.config():(typeof CCSA_FIREBASE!=='undefined'?CCSA_FIREBASE:null);
    let secondary;
    try{secondary=c.fb.getApp('agency-login')}catch(e){secondary=c.fb.initializeApp(cfg,'agency-login')}
    return c.fb.getAuth(secondary);
  }
  async function createLogin(){
    const portal=lib();
    const c=client();
    if(!c.ready||!state.isAdmin){say('Sign in as the portal admin before creating a login.');return}
    const code=state.agencyCode;
    const agency=portal.agencyFromCode(code);
    const email=String(state.draftEmail||'').trim();
    if(!agency){say('Choose an agency.');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){say('Enter a valid email address.');return}
    if(!state.password||state.password.length<6){say('Use a password of at least 6 characters.');return}
    state.busy=true;repaint();
    try{
      const auth2=secondaryAuth(c);
      const cred=await c.fb.createUserWithEmailAndPassword(auth2,email,state.password);
      const uid=cred.user.uid;
      try{await c.fb.signOut(auth2)}catch(e){}
      await c.fb.setDoc(c.fb.doc(c.db,'agencyUsers',uid),{
        agencyId:agency.id,agencyCode:agency.code,email:email,role:'agent',createdAt:new Date().toISOString(),disabled:false
      });
      state.showOnce={email:email,password:state.password,agency:agency.name,url:portalUrl()};
      state.password=tempPassword();
      state.draftEmail='';
      state.message='Login created for '+agency.name+'. Pass on the password now. It is not stored.';
      await refreshLogins();
    }catch(e){
      state.message=portal.authError(e&&e.code,typeof location!=='undefined'?location.hostname:'');
    }finally{state.busy=false;repaint()}
  }
  async function setDisabled(uid,disabled){
    const c=client();
    if(!c.ready||!state.isAdmin)return;
    const row=state.logins.filter(function(item){return item.uid===uid})[0];
    if(!row)return;
    try{
      await c.fb.setDoc(c.fb.doc(c.db,'agencyUsers',uid),{disabled:!!disabled},{merge:true});
      await refreshLogins();
      state.message=disabled?'That login is turned off.':'That login is turned on.';
    }catch(e){state.message='The login was not changed.'}
    repaint();
  }
  async function sendReset(){
    const c=client();
    const email=state.showOnce&&state.showOnce.email;
    if(!c.ready||!email)return;
    try{
      await c.fb.sendPasswordResetEmail(secondaryAuth(c),email);
      state.message='Password reset email sent to '+email+'.';
    }catch(e){
      state.message=lib().authError(e&&e.code,typeof location!=='undefined'?location.hostname:'');
    }
    repaint();
  }
  function copyPassword(){
    const password=state.showOnce&&state.showOnce.password;
    if(!password)return;
    const done=function(){state.message='Password copied.';repaint()};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(password).then(done).catch(function(){state.message='Copy was blocked. The password is still on screen.';repaint()});
    else{state.message='Copy is not available in this browser. The password is still on screen.';repaint()}
  }
  function bind(root){
    const box=root&&root.id==='portalpanel'?root:(root&&root.querySelector?root.querySelector('#portalpanel'):null);
    if(!box)return;
    box.oninput=function(e){
      if(e.target.id==='portalemail')state.draftEmail=e.target.value;
      if(e.target.id==='portalpass')state.password=e.target.value;
    };
    box.onchange=function(e){
      if(e.target.id==='portalagency'){state.agencyCode=e.target.value;repaint()}
      if(e.target.id==='portalauto'){
        state.auto=!!e.target.checked;
        try{hooks.storage.setItem('ccsa.portal.auto',state.auto?'1':'0')}catch(err){}
      }
    };
    box.onclick=function(e){
      const b=e.target.closest?e.target.closest('button'):null;
      if(!b||!box.contains(b))return;
      if(b.id==='portalnewpass'){state.password=tempPassword();state.showOnce=null;repaint()}
      if(b.id==='portalcreate')createLogin();
      if(b.id==='portalpub'){
        const n=hooks&&hooks.getJobs?hooks.getJobs().length:0;
        if(typeof confirm==='function'&&!confirm('Publish '+n+' job'+(n===1?'':'s')+' to the agency portal?\n\nAddresses, service dates, alarm results and certificates are sent. Tenant names, phone numbers and email addresses are left out. Google Calendar is not changed.'))return;
        publishAll();
      }
      if(b.id==='portalcopy')copyPassword();
      if(b.id==='portalreset')sendReset();
      if(b.dataset.portalDisable)setDisabled(b.dataset.portalDisable,true);
      if(b.dataset.portalEnable)setDisabled(b.dataset.portalEnable,false);
    };
  }
  function boot(next){
    hooks=next||{};
    state.password=state.password||tempPassword();
    try{state.auto=!hooks.storage||hooks.storage.getItem('ccsa.portal.auto')!=='0'}catch(e){state.auto=true}
    const cfg=hooks.config?hooks.config():null;
    state.configured=!!(cfg&&cfg.apiKey&&!/YOUR_/i.test(JSON.stringify(cfg)));
  }
  function current(){
    return {configured:state.configured,signedIn:state.signedIn,email:state.email,uid:state.uid,isAdmin:state.isAdmin,auto:state.auto,message:state.message};
  }

  return {boot:boot,panelHTML:panelHTML,bind:bind,onSync:onSync,onArchived:onArchived,publishAll:publishAll,state:current,tempPassword:tempPassword};
});
