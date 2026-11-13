/* Agency portal. Read-only. One agency per login.
   Demo mode (?demo=1) uses the sample records and does not call Firebase. */
(function(){
  const CDN='https://www.gstatic.com/firebasejs/11.9.1/';
  const appEl=document.getElementById('app');
  let session=null;
  let view={tab:'properties',q:'',filter:'',propertyId:'',certificateId:'',invoiceId:'',invoiceStatus:'',invFrom:'',invTo:''};
  let authBits=null;
  let loginError='';
  let painting=false;

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function data(){return window.CCSAPortalData}
  function pills(property,tenancy){
    const comp=property&&property.compliance;
    const cls=comp==='compliant'?'ok':comp==='due soon'?'soon':comp==='overdue'?'bad':comp==='failed'?'fail':'';
    const ten=tenancy==='Holiday'?'<span class="pill hol">Holiday</span>':tenancy==='Permanent'?'<span class="pill perm">Permanent</span>':'';
    return '<div class="pills">'+(comp?'<span class="pill '+cls+'">'+esc(data().complianceLabel(comp))+'</span>':'')+ten+'</div>';
  }
  function propertyMap(){
    const map={};
    (session.properties||[]).forEach(function(p){map[p.id]=p});
    return map;
  }
  function matches(text){
    const q=(view.q||'').trim().toLowerCase();
    if(!q)return true;
    return String(text||'').toLowerCase().indexOf(q)>=0;
  }
  function whenJob(job){
    if(job.status==='completed')return data().prettyDate(job.serviceDate)||'Completed';
    if(job.appointment)return data().prettyDate(job.appointment)+(job.appointmentTime?', '+data().prettyTime(job.appointmentTime):'');
    return 'Date to be booked';
  }
  function certFor(job){
    return (session.certificates||[]).filter(function(c){return c.jobId===job.id||c.id===job.id})[0]||null;
  }
  function hashFor(){
    if(view.invoiceId)return 'invoice/'+encodeURIComponent(view.invoiceId);
    if(view.certificateId)return 'certificate/'+encodeURIComponent(view.certificateId);
    if(view.propertyId)return 'property/'+encodeURIComponent(view.propertyId);
    return view.tab||'properties';
  }
  function readHash(){
    const raw=decodeURIComponent((location.hash||'').replace(/^#/,''));
    if(raw.indexOf('invoice/')===0){view.invoiceId=raw.slice(8);view.certificateId='';view.propertyId='';view.tab='invoices';return}
    if(raw.indexOf('certificate/')===0){view.certificateId=raw.slice(12);view.propertyId='';view.invoiceId='';return}
    if(raw.indexOf('property/')===0){view.propertyId=raw.slice(9);view.certificateId='';view.invoiceId='';view.tab='properties';return}
    view.propertyId='';view.certificateId='';view.invoiceId='';
    view.tab=raw==='jobs'||raw==='certificates'||raw==='invoices'||raw==='properties'?raw:'properties';
  }
  function go(next){
    view=Object.assign({},view,next);
    const hash='#'+hashFor();
    if(location.hash!==hash)location.hash=hash;
    else paint();
  }
  function loadDemo(agencyId){
    const portal=data().demoPortal();
    const id=portal.agencies[agencyId]?agencyId:'rwm';
    const bucket=portal.agencies[id];
    session={
      mode:'demo',
      today:portal.today,
      agency:{id:bucket.id,code:bucket.code,name:bucket.name},
      jobs:bucket.jobs,
      certificates:bucket.certificates,
      invoices:window.CCSAInvoice?CCSAInvoice.demoInvoices(bucket,portal.today):[],
      properties:data().rollup(bucket.jobs,portal.today,bucket),
      choices:Object.keys(portal.agencies).map(function(key){return portal.agencies[key]})
    };
  }
  function header(){
    const who=session?esc(session.agency.name):'Sign in';
    const action=session?'<button type="button" class="out" id="signout">'+(session.mode==='demo'?'Leave sample':'Sign out')+'</button>':'';
    return '<header><img src="../icon-192.png" alt=""><div class="brand"><b>Clarence Coast Smoke Alarms</b><span>Agency portal · '+who+'</span></div>'+action+'</header>';
  }
  function loginView(){
    return header()+'<main><form class="login" id="loginform"><h1>Agency portal</h1><p>Sign in to see your agency\'s properties, jobs, compliance certificates and invoices. The portal is read-only, and it does not show tenant names or contact details.</p><label class="l" for="email">Email</label><input class="t" id="email" name="email" type="email" autocomplete="username" required><label class="l" for="password">Password</label><input class="t" id="password" name="password" type="password" autocomplete="current-password" required><div class="actions"><button class="pri" type="submit">Sign in</button></div>'+(loginError?'<div class="err" role="alert">'+esc(loginError)+'</div>':'')+'<p class="meta"><a href="?demo=1">Preview with sample data</a></p></form></main>';
  }
  function stats(){
    const counts=data().counts(session.properties);
    const items=[
      ['','Properties',counts.properties],
      ['compliant','Compliant',counts.compliant],
      ['due soon','Due soon',counts['due soon']],
      ['overdue','Overdue',counts.overdue],
      ['failed','Failed',counts.failed]
    ];
    return '<div class="stats">'+items.map(function(item){
      const on=view.filter===item[0]?' on':'';
      return '<button type="button" class="stat'+on+'" data-filter="'+esc(item[0])+'"><b>'+item[2]+'</b><span>'+esc(item[1])+'</span></button>';
    }).join('')+'</div>';
  }
  function tabs(){
    return '<div class="tabs" role="tablist">'+['properties','jobs','certificates','invoices'].map(function(tab){
      const label=tab==='properties'?'Properties':tab==='jobs'?'Jobs':tab==='certificates'?'Certificates':'Invoices';
      return '<button type="button" role="tab" aria-selected="'+(view.tab===tab?'true':'false')+'" class="'+(view.tab===tab?'on':'')+'" data-tab="'+tab+'">'+label+'</button>';
    }).join('')+'</div><input class="search" id="q" type="search" placeholder="Search address" value="'+esc(view.q)+'" aria-label="Search address">';
  }
  function demoBar(){
    if(session.mode!=='demo')return '';
    const options=session.choices.map(function(a){
      return '<option value="'+esc(a.id)+'"'+(a.id===session.agency.id?' selected':'')+'>'+esc(a.name)+'</option>';
    }).join('');
    return '<div class="demo" role="status">Sample data as at '+esc(data().prettyDate(session.today))+'. Invoice prices in this preview are examples. Your price list, ABN and bank details stay blank until you enter them. This is not a live login and nothing is saved.<label for="demoagency">Sample agency</label><select id="demoagency">'+options+'</select></div>';
  }
  function propertyCards(){
    let list=session.properties.filter(function(p){return matches(p.address+' '+p.ident+' '+p.town)&&( !view.filter||p.compliance===view.filter)});
    if(!list.length)return '<p class="empty">No properties to show.</p>';
    return list.map(function(p){
      const last=p.lastService?data().prettyDate(p.lastService):'No service on file';
      const due=p.due?data().prettyDate(p.due):'No due date';
      return '<article class="card"><h2>'+esc(p.address)+'</h2>'+pills(p,p.tenancy)+'<p class="meta">Last service '+esc(last)+' · Due '+esc(due)+(p.alarmCount?' · '+p.alarmCount+' alarm'+(p.alarmCount===1?'':'s'):'')+'</p><div class="actions"><button type="button" data-property="'+esc(p.id)+'">History</button></div></article>';
    }).join('');
  }
  function jobCards(list,empty){
    if(!list.length)return '<p class="empty">'+esc(empty)+'</p>';
    const props=propertyMap();
    return list.map(function(job){
      const prop=props[job.propertyId];
      const cert=certFor(job);
      const statusCls=job.status==='completed'?'done':job.status==='booked'?'book':'soon';
      return '<article class="card"><div class="pills"><span class="pill '+statusCls+'">'+esc(data().statusLabel(job.status))+'</span>'+(job.status==='completed'&&job.result?'<span class="pill '+(job.result==='fail'?'fail':'ok')+'">'+esc(data().resultLabel(job.result))+'</span>':'')+'</div><h2>'+esc(job.address)+'</h2>'+pills(prop,job.tenancy)+'<p class="meta">'+esc(whenJob(job))+(prop&&prop.lastService&&job.status!=='completed'?' · Last service '+esc(data().prettyDate(prop.lastService)):'')+'</p><div class="actions">'+(cert?'<button type="button" data-certificate="'+esc(cert.id)+'">Certificate</button>':'')+'<button type="button" data-property="'+esc(job.propertyId)+'">Property</button></div></article>';
    }).join('');
  }
  function jobsView(){
    const upcoming=session.jobs.filter(function(j){return j.status!=='completed'&&matches(j.address)}).sort(function(a,b){return (a.appointment||'9999')<(b.appointment||'9999')?-1:1});
    const completed=session.jobs.filter(function(j){return j.status==='completed'&&matches(j.address)}).sort(function(a,b){return (a.serviceDate||'')<(b.serviceDate||'')?1:-1});
    return '<h2 class="sectionh">Upcoming</h2>'+jobCards(upcoming,'No upcoming jobs.')+'<h2 class="sectionh">Completed</h2>'+jobCards(completed,'No completed jobs.');
  }
  function certificatesView(){
    const list=(session.certificates||[]).filter(function(c){return matches(c.address+' '+c.ident)}).sort(function(a,b){return a.date<b.date?1:-1});
    if(!list.length)return '<p class="empty">No certificates yet.</p>';
    return list.map(function(c){
      return '<article class="card"><div class="pills"><span class="pill '+(c.result==='fail'?'fail':'ok')+'">'+esc(data().resultLabel(c.result))+'</span></div><h2>'+esc(c.address)+'</h2><p class="meta">'+esc(data().prettyDate(c.date))+' · '+esc(c.agencyCode)+'</p><div class="actions"><button type="button" data-certificate="'+esc(c.id)+'">View</button><button type="button" data-download="'+esc(c.id)+'">Download PDF</button></div></article>';
    }).join('');
  }
  function propertyView(){
    const prop=(session.properties||[]).filter(function(p){return p.id===view.propertyId})[0];
    if(!prop)return '<button type="button" class="back" data-tab="properties">Back</button><p class="empty">That property is not in this agency.</p>';
    const jobs=session.jobs.filter(function(j){return j.propertyId===prop.id}).sort(function(a,b){return (a.serviceDate||a.appointment||'')<(b.serviceDate||b.appointment||'')?1:-1});
    const certs=(session.certificates||[]).filter(function(c){return c.propertyId===prop.id});
    return '<button type="button" class="back" data-tab="properties">Back to properties</button><article class="card"><h2>'+esc(prop.address)+'</h2>'+pills(prop,prop.tenancy)+'<p class="meta">Last service '+(prop.lastService?esc(data().prettyDate(prop.lastService)):'not on file')+' · Due '+(prop.due?esc(data().prettyDate(prop.due)):'not on file')+'</p></article><h2 class="sectionh">History</h2>'+jobCards(jobs,'No visits on file.')+(certs.length?'<h2 class="sectionh">Certificates</h2>'+certs.map(function(c){return '<article class="card"><h3>'+esc(data().prettyDate(c.date))+' · '+esc(data().resultLabel(c.result))+'</h3><div class="actions"><button type="button" data-certificate="'+esc(c.id)+'">View</button><button type="button" data-download="'+esc(c.id)+'">Download PDF</button></div></article>'}).join(''):'');
  }
  function certificateView(){
    const cert=(session.certificates||[]).filter(function(c){return c.id===view.certificateId})[0];
    if(!cert)return '<button type="button" class="back" data-tab="certificates">Back</button><p class="empty">That certificate is not in this agency.</p>';
    const model=window.CCSACertificate.viewModel(cert);
    const rows=model.alarms.map(function(a){
      return '<tr><td data-label="#">'+esc(a.n)+'</td><td data-label="Location">'+esc(a.location||'—')+'</td><td data-label="Type">'+esc(a.type||'—')+'</td><td data-label="Power">'+esc(a.power||'—')+'</td><td data-label="Expiry">'+esc(a.expiry||'—')+'</td><td data-label="Result">'+esc(a.result||'—')+'</td></tr>';
    }).join('');
    return '<button type="button" class="back" data-tab="certificates">Back</button><article class="cert" id="certificate"><div class="certhead"><div class="kicker">'+esc(model.brand)+'</div><h1>'+esc(model.title)+'</h1></div><div class="certbody"><p class="meta">Property</p><h2>'+esc(model.address)+'</h2>'+(model.ident?'<p class="meta">'+esc(model.ident)+'</p>':'')+'<div class="facts"><div><span>Service date</span><b>'+esc(model.date||'—')+'</b></div><div><span>Agency</span><b>'+esc(model.agency||'—')+'</b></div><div><span>Tenancy</span><b>'+esc(model.tenancy||'—')+'</b></div><div><span>Result</span><b>'+esc(model.result||'—')+'</b></div></div><h3>Alarms tested</h3><table><thead><tr><th>#</th><th>Location</th><th>Type</th><th>Power</th><th>Expiry</th><th>Result</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No alarms were recorded.</td></tr>')+'</tbody></table><div class="statement"><b>Technician statement</b><p>'+esc(model.statement)+'</p><p class="meta">'+esc(model.tech)+'</p></div><p class="foot">'+esc(model.footer)+'</p><div class="actions"><button type="button" class="pri" data-download="'+esc(cert.id)+'">Download PDF</button></div></div></article>';
  }
  function invoiceRows(){
    const inv=window.CCSAInvoice;
    const today=session.today;
    const rows=(session.invoices||[]).map(function(row){return Object.assign({today:today},row)});
    if(!inv)return [];
    return inv.filterInvoices(rows,{status:view.invoiceStatus,from:view.invFrom,to:view.invTo,today:today,q:view.q,agencyId:session.agency.id});
  }
  function invoicesView(){
    const inv=window.CCSAInvoice;
    const list=invoiceRows();
    const filters='<div class="filters"><select id="invstatus" aria-label="Invoice status"><option value="">All statuses</option><option value="unpaid"'+(view.invoiceStatus==='unpaid'?' selected':'')+'>Unpaid</option><option value="paid"'+(view.invoiceStatus==='paid'?' selected':'')+'>Paid</option><option value="overdue"'+(view.invoiceStatus==='overdue'?' selected':'')+'>Overdue</option></select><input id="invfrom" type="date" aria-label="Issued from" value="'+esc(view.invFrom)+'"><input id="invto" type="date" aria-label="Issued to" value="'+esc(view.invTo)+'"></div>';
    if(!list.length)return filters+'<p class="empty">No invoices to show.</p>';
    return filters+list.map(function(row){
      const status=inv.displayStatus(row,session.today);
      const cls=status==='paid'?'ok':status==='overdue'?'bad':'soon';
      return '<article class="card"><div class="pills"><span class="pill '+cls+'">'+esc(inv.statusLabel(status))+'</span><span class="pill perm">'+esc(row.number)+'</span></div><h2>'+esc(row.address)+'</h2><p class="meta">'+esc(data().prettyDate(row.issueDate))+' · Due '+esc(data().prettyDate(row.dueDate))+' · '+esc(inv.money(row.totalCents))+'</p><div class="actions"><button type="button" data-invoice="'+esc(row.id)+'">View</button><button type="button" data-invoice-download="'+esc(row.id)+'">Download PDF</button></div></article>';
    }).join('');
  }
  function invoiceView(){
    const row=(session.invoices||[]).filter(function(item){return item.id===view.invoiceId})[0];
    if(!row||!window.CCSAInvoice)return '<button type="button" class="back" data-tab="invoices">Back</button><p class="empty">That invoice is not in this agency.</p>';
    const model=CCSAInvoice.viewModel(Object.assign({today:session.today},row));
    const lines=model.lines.map(function(line){
      return '<tr><td data-label="Description">'+esc(line.description)+'</td><td data-label="Qty">'+esc(line.qty)+'</td><td data-label="Price">'+esc(line.unit)+'</td><td data-label="Amount">'+esc(line.amount)+'</td></tr>';
    }).join('');
    const pay=model.bsb||model.accountNumber?(model.bankName?'<p>'+esc(model.bankName)+'</p>':'')+(model.accountName?'<p>Account name '+esc(model.accountName)+'</p>':'')+(model.bsb?'<p>BSB '+esc(model.bsb)+'</p>':'')+(model.accountNumber?'<p>Account '+esc(model.accountNumber)+'</p>':'') : '<p>Bank details have not been added.</p>';
    const biz=[model.businessAddress,model.businessPhone,model.businessEmail].filter(Boolean).map(function(line){return '<p class="meta">'+esc(line)+'</p>'}).join('');
    return '<button type="button" class="back" data-tab="invoices">Back</button><article class="cert" id="invoice"><div class="certhead"><div class="kicker">'+esc(model.business)+'</div><h1>'+esc(model.title)+'</h1></div><div class="certbody">'+biz+'<div class="facts"><div><span>Invoice</span><b>'+esc(model.number)+'</b></div><div><span>Issued</span><b>'+esc(model.issue||'—')+'</b></div><div><span>Due</span><b>'+esc(model.due||'—')+'</b></div><div><span>Status</span><b>'+esc(model.status)+'</b></div></div>'+(model.abn?'<p class="meta">ABN '+esc(model.abn)+'</p>':'')+'<p class="meta">Bill to</p><h2>'+esc(model.billTo||session.agency.name)+'</h2><p class="meta">Property</p><h2>'+esc(model.address)+'</h2><table><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>'+lines+'</tbody></table><p class="meta">Subtotal '+esc(model.ex)+(model.showGst?' · GST 10% '+esc(model.gst):'')+'</p><h3>Total '+esc(model.total)+'</h3><h3>Payment</h3>'+pay+(model.terms?'<p>'+esc(model.terms)+'</p>':'')+'<p class="foot">'+esc(model.note)+'</p><div class="actions"><button type="button" class="pri" data-invoice-download="'+esc(row.id)+'">Download PDF</button></div></div></article>';
  }
  function mainView(){
    let body='';
    if(view.invoiceId)body=invoiceView();
    else if(view.certificateId)body=certificateView();
    else if(view.propertyId)body=propertyView();
    else if(view.tab==='jobs')body=jobsView();
    else if(view.tab==='certificates')body=certificatesView();
    else if(view.tab==='invoices')body=invoicesView();
    else body=propertyCards();
    const showTools=!view.propertyId&&!view.certificateId&&!view.invoiceId;
    return header()+'<main>'+demoBar()+(showTools?stats()+tabs():'')+body+'<p class="foot">Read-only portal for '+esc(session.agency.name)+'. Tenant names, phone numbers and email addresses are not shown.</p></main>';
  }
  function paint(){
    if(painting)return;
    painting=true;
    appEl.innerHTML=session?mainView():loginView();
    bind();
    painting=false;
  }
  function downloadInvoice(id){
    const row=(session.invoices||[]).filter(function(item){return item.id===id})[0];
    if(!row||!window.CCSAInvoice)return;
    const bytes=CCSAInvoice.buildInvoicePdf(Object.assign({today:session.today},row));
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    const url=URL.createObjectURL(blob);
    a.href=url;a.download=CCSAInvoice.fileName(row);
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},4000);
  }
  function download(id){
    const cert=(session.certificates||[]).filter(function(c){return c.id===id})[0];
    if(!cert||!window.CCSACertificate)return;
    const bytes=CCSACertificate.buildCertificatePdf(cert);
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    const url=URL.createObjectURL(blob);
    a.href=url;a.download=CCSACertificate.fileName(cert);
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},4000);
  }
  function bind(){
    const out=document.getElementById('signout');
    if(out)out.onclick=function(){signOut()};
    const form=document.getElementById('loginform');
    if(form)form.onsubmit=function(e){e.preventDefault();signIn(form.email.value,form.password.value)};
    const q=document.getElementById('q');
    if(q)q.oninput=function(){view.q=q.value;const pos=q.selectionStart;paint();const again=document.getElementById('q');if(again){again.focus();again.setSelectionRange(pos,pos)}};
    const invStatus=document.getElementById('invstatus');
    if(invStatus)invStatus.onchange=function(){view.invoiceStatus=invStatus.value;paint()};
    const invFrom=document.getElementById('invfrom');
    if(invFrom)invFrom.onchange=function(){view.invFrom=invFrom.value;paint()};
    const invTo=document.getElementById('invto');
    if(invTo)invTo.onchange=function(){view.invTo=invTo.value;paint()};
    const demo=document.getElementById('demoagency');
    if(demo)demo.onchange=function(){loadDemo(demo.value);view.propertyId='';view.certificateId='';view.invoiceId='';view.filter='';paint()};
    appEl.onclick=function(e){
      const b=e.target.closest?e.target.closest('button'):null;
      if(!b||!appEl.contains(b))return;
      if(b.dataset.tab)go({tab:b.dataset.tab,propertyId:'',certificateId:'',invoiceId:'',filter:view.filter});
      if(b.dataset.filter!=null&&b.classList.contains('stat'))go({filter:view.filter===b.dataset.filter?'':b.dataset.filter,tab:'properties',propertyId:'',certificateId:'',invoiceId:''});
      if(b.dataset.property)go({propertyId:b.dataset.property,certificateId:'',invoiceId:'',tab:'properties'});
      if(b.dataset.certificate)go({certificateId:b.dataset.certificate,propertyId:'',invoiceId:''});
      if(b.dataset.invoice)go({invoiceId:b.dataset.invoice,certificateId:'',propertyId:'',tab:'invoices'});
      if(b.dataset.download)download(b.dataset.download);
      if(b.dataset.invoiceDownload)downloadInvoice(b.dataset.invoiceDownload);
    };
  }
  async function connect(){
    const cfg=window.CCSA_FIREBASE;
    if(!cfg||/YOUR_/i.test(JSON.stringify(cfg)))throw new Error('unconfigured');
    const appMod=await import(CDN+'firebase-app.js');
    const authMod=await import(CDN+'firebase-auth.js');
    const storeMod=await import(CDN+'firebase-firestore.js');
    let app;
    try{app=appMod.getApp('ccsa-portal')}catch(e){app=appMod.initializeApp(cfg,'ccsa-portal')}
    const auth=authMod.getAuth(app);
    const db=storeMod.getFirestore(app);
    authBits={auth:auth,db:db,authMod:authMod,storeMod:storeMod};
    return auth;
  }
  async function loadLive(user){
    const store=authBits.storeMod;
    const snap=await store.getDoc(store.doc(authBits.db,'agencyUsers',user.uid));
    if(!snap.exists()){
      loginError='This login is not linked to an agency.';
      await authBits.authMod.signOut(authBits.auth);
      session=null;paint();return;
    }
    const row=snap.data()||{};
    if(row.disabled||row.role!=='agent'||!row.agencyId){
      loginError=row.disabled?'This login has been turned off.':'This login is not linked to an agency.';
      await authBits.authMod.signOut(authBits.auth);
      session=null;paint();return;
    }
    const agency=data().agencyFromCode(row.agencyCode||row.agencyId)||{id:row.agencyId,code:row.agencyCode||'',name:row.agencyCode||row.agencyId};
    async function read(kind){
      const got=await store.getDocs(store.collection(authBits.db,'portal',row.agencyId,kind));
      const list=[];
      got.forEach(function(d){list.push(d.data())});
      return list;
    }
    const jobs=await read('jobs');
    const certificates=await read('certificates');
    let invoices=[];
    try{invoices=await read('invoices')}catch(e){invoices=[]}
    const today=data().sydneyToday();
    session={mode:'live',today:today,agency:agency,jobs:jobs,certificates:certificates,invoices:invoices,properties:data().rollup(jobs,today,agency),choices:[]};
    loginError='';
    paint();
  }
  async function signIn(email,password){
    loginError='';
    paint();
    try{
      await connect();
      const cred=await authBits.authMod.signInWithEmailAndPassword(authBits.auth,email,password);
      await loadLive(cred.user);
    }catch(e){
      loginError=data().authError(e&&e.code,location.hostname);
      session=null;
      paint();
    }
  }
  async function signOut(){
    session=null;view={tab:'properties',q:'',filter:'',propertyId:'',certificateId:'',invoiceId:'',invoiceStatus:'',invFrom:'',invTo:''};
    if(authBits){try{await authBits.authMod.signOut(authBits.auth)}catch(e){}}
    if(/[?&]demo=1/.test(location.search))location.href=location.pathname;
    else paint();
  }
  async function start(){
    if(!window.CCSAPortalData||!window.CCSACertificate){
      appEl.textContent='The portal files did not load.';
      return;
    }
    const demo=/[?&]demo=1(?:&|$)/.test(location.search);
    if(demo){
      loadDemo('rwm');
      readHash();
      paint();
      window.addEventListener('hashchange',function(){readHash();paint()});
      return;
    }
    window.addEventListener('hashchange',function(){readHash();paint()});
    readHash();
    paint();
    try{
      const auth=await connect();
      authBits.authMod.onAuthStateChanged(auth,function(user){
        if(user)loadLive(user);
      });
    }catch(e){
      if(String(e&&e.message)==='unconfigured')loginError='The portal is not connected to Firebase yet.';
    }
  }
  start();
})();
