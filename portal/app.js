/* Agency portal. Read-only. One agency per login.
   Demo mode (?demo=1) uses the sample records and does not call Firebase. */
(function(){
  const CDN='https://www.gstatic.com/firebasejs/11.9.1/';
  const appEl=document.getElementById('app');
  let session=null;
  let view={tab:'properties',q:'',filter:'',propertyId:'',certificateId:'',invoiceId:'',invoiceStatus:'',invFrom:'',invTo:'',requestForm:false,inbox:false,notice:''};
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
    if(view.inbox)return 'inbox';
    if(view.requestForm)return 'request';
    if(view.invoiceId)return 'invoice/'+encodeURIComponent(view.invoiceId);
    if(view.certificateId)return 'certificate/'+encodeURIComponent(view.certificateId);
    if(view.propertyId)return 'property/'+encodeURIComponent(view.propertyId);
    return view.tab||'properties';
  }
  function readHash(){
    const raw=decodeURIComponent((location.hash||'').replace(/^#/,''));
    view.inbox=false;view.requestForm=false;
    if(raw==='inbox'){view.inbox=true;view.propertyId='';view.certificateId='';view.invoiceId='';return}
    if(raw==='request'){view.requestForm=true;view.tab='jobs';view.propertyId='';view.certificateId='';view.invoiceId='';return}
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
    const offered=data().agencies();
    const pick=offered.filter(function(a){return a.id===agencyId})[0]||offered[0];
    const bucket=portal.agencies[pick.id]||{id:pick.id,code:pick.code,name:pick.name,jobs:[],certificates:[],properties:[]};
    session={
      mode:'demo',
      today:portal.today,
      agency:{id:bucket.id,code:bucket.code,name:bucket.name},
      jobs:bucket.jobs||[],
      certificates:bucket.certificates||[],
      invoices:window.CCSAInvoice?CCSAInvoice.demoInvoices(bucket,portal.today):[],
      properties:data().rollup(bucket.jobs||[],portal.today,bucket),
      requests:window.CCSARequests?CCSARequests.demoPublic(pick.id):[],
      choices:offered,
      notice:''
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
    return '<div class="demo" role="status">Sample data as at '+esc(data().prettyDate(session.today))+'. Invoice prices in this preview are examples. Your price list, ABN and bank details stay blank until you enter them. This is not a live login and nothing is saved.<label for="demoagency">Sample agency</label><select id="demoagency">'+options+'</select><div class="actions"><button type="button" id="demoinbox">Adam\'s inbox</button></div></div>';
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
  function requestCards(list){
    const api=window.CCSARequests;
    if(!list.length)return '<p class="empty">No requests yet.</p>';
    return list.map(function(row){
      return '<article class="card"><div class="pills"><span class="pill book">'+esc(api?api.statusLabel(row.status):row.status)+'</span></div><h2>'+esc(row.address)+'</h2><p class="meta">'+esc(row.tenancy)+(row.timeframe?' · '+esc(row.timeframe):'')+'</p></article>';
    }).join('');
  }
  function jobsView(){
    const upcoming=session.jobs.filter(function(j){return j.status!=='completed'&&matches(j.address)}).sort(function(a,b){return (a.appointment||'9999')<(b.appointment||'9999')?-1:1});
    const completed=session.jobs.filter(function(j){return j.status==='completed'&&matches(j.address)}).sort(function(a,b){return (a.serviceDate||'')<(b.serviceDate||'')?1:-1});
    const mine=(session.requests||[]).slice().sort(function(a,b){return (a.createdAt||'')<(b.createdAt||'')?1:-1});
    return '<div class="actions"><button type="button" class="pri" id="newjob">New job</button></div>'+(view.notice?'<p class="note" id="reqnote">'+esc(view.notice)+'</p>':'')+'<h2 class="sectionh">Your requests</h2>'+requestCards(mine)+'<h2 class="sectionh">Upcoming</h2>'+jobCards(upcoming,'No upcoming jobs.')+'<h2 class="sectionh">Completed</h2>'+jobCards(completed,'No completed jobs.');
  }
  function certificatesView(){
    const list=(session.certificates||[]).filter(function(c){return matches(c.address+' '+c.ident)}).sort(function(a,b){return a.date<b.date?1:-1});
    if(!list.length)return '<p class="empty">No certificates yet.</p>';
    return list.map(function(c){
      return '<article class="card"><div class="pills"><span class="pill '+(c.result==='fail'?'fail':'ok')+'">'+esc(data().resultLabel(c.result))+'</span></div><h2>'+esc(c.address)+'</h2><p class="meta">'+esc(data().prettyDate(c.date))+' · '+esc(c.agencyCode)+'</p><div class="actions"><button type="button" data-certificate="'+esc(c.id)+'">View</button><button type="button" data-download="'+esc(c.id)+'">Download PDF</button></div></article>';
    }).join('');
  }
  function byNewest(list,field){
    return list.slice().sort(function(a,b){return (a[field]||'')<(b[field]||'')?1:-1});
  }
  function propertyView(){
    const prop=(session.properties||[]).filter(function(p){return p.id===view.propertyId})[0];
    if(!prop)return '<button type="button" class="back" data-tab="properties">Back</button><p class="empty">That property is not in this agency.</p>';
    const jobs=byNewest(session.jobs.filter(function(j){return j.propertyId===prop.id}),'serviceDate');
    const certs=byNewest((session.certificates||[]).filter(function(c){return c.propertyId===prop.id}),'date');
    const requests=byNewest((session.requests||[]).filter(function(r){return r.propertyId===prop.id}),'createdAt');
    const invoices=byNewest((session.invoices||[]).filter(function(row){return row.propertyId===prop.id}),'issueDate');
    const inv=window.CCSAInvoice;
    const reportCards=certs.map(function(c){
      return '<article class="card"><h3>Service report · '+esc(data().prettyDate(c.date))+'</h3><p class="meta">'+esc(data().resultLabel(c.result))+'</p><div class="actions"><button type="button" data-certificate="'+esc(c.id)+'">View</button><button type="button" data-download="'+esc(c.id)+'">Download PDF</button></div></article>';
    }).join('')||'<p class="empty">No service reports yet.</p>';
    const complyCards=certs.map(function(c){
      const model=window.CCSACertificate?CCSACertificate.complianceModel(c,{due:prop.due}):null;
      const until=model&&model.validUntil?'Valid until '+model.validUntil:'Not recorded as compliant';
      return '<article class="card"><h3>Compliance certificate · '+esc(data().prettyDate(c.date))+'</h3><p class="meta">'+esc(until)+'</p><div class="actions"><button type="button" data-compliance="'+esc(c.id)+'">Download PDF</button></div></article>';
    }).join('')||'<p class="empty">No compliance certificate yet.</p>';
    const invoiceCards=invoices.map(function(row){
      const status=inv?inv.displayStatus(row,session.today):row.status;
      return '<article class="card"><h3>'+esc(row.number)+'</h3><p class="meta">'+esc(inv?inv.statusLabel(status):status)+' · '+esc(data().prettyDate(row.issueDate))+'</p><div class="actions"><button type="button" data-invoice="'+esc(row.id)+'">View</button><button type="button" data-invoice-download="'+esc(row.id)+'">Download PDF</button></div></article>';
    }).join('')||'<p class="empty">No invoices yet.</p>';
    return '<button type="button" class="back" data-tab="properties">Back to properties</button><article class="card" id="property"><h2>'+esc(prop.address)+'</h2>'+pills(prop,prop.tenancy)+'<p class="meta">Last service '+(prop.lastService?esc(data().prettyDate(prop.lastService)):'not on file')+' · Due '+(prop.due?esc(data().prettyDate(prop.due)):'not on file')+'</p></article><h2 class="sectionh">Requests</h2>'+requestCards(requests)+'<h2 class="sectionh">Jobs</h2>'+jobCards(jobs,'No visits on file.')+'<h2 class="sectionh">Service reports</h2>'+reportCards+'<h2 class="sectionh">Compliance certificates</h2>'+complyCards+'<h2 class="sectionh">Invoices</h2>'+invoiceCards;
  }
  function requestForm(){
    return '<button type="button" class="back" data-tab="jobs">Back</button><form class="login" id="requestform"><h1>New job</h1><p>Send a service request for one of your properties. The access name and phone go to Adam only. They are not shown here after you send, and they are not printed on certificates, service reports or invoices.</p>'+(view.notice?'<p class="note" id="reqnote">'+esc(view.notice)+'</p>':'')+'<label class="l" for="reqaddr">Property address</label><input class="t" id="reqaddr" required placeholder="18 River Street, Maclean NSW 2463"><label class="l" for="reqten">Tenancy</label><select class="t" id="reqten"><option value="Permanent">Permanent</option><option value="Holiday">Holiday</option></select><label class="l" for="reqname">Access contact name</label><input class="t" id="reqname" required autocomplete="name"><label class="l" for="reqphone">Access phone</label><input class="t" id="reqphone" required inputmode="tel" autocomplete="tel"><label class="l" for="reqtime">Preferred timeframe</label><input class="t" id="reqtime" placeholder="Next fortnight"><label class="l" for="reqnotes">Notes</label><textarea class="t" id="reqnotes" rows="3"></textarea><label class="l" for="reqfile">PDF or photo, optional, under 450 KB</label><input id="reqfile" type="file" accept="application/pdf,image/jpeg,image/png"><div class="actions"><button class="pri" type="submit">Send request</button></div></form><h2 class="sectionh">Or upload a CSV</h2><p class="meta">Up to 40 rows. Download the template, fill it in, and upload it. Access phones in the file are stored for Adam only.</p><div class="actions"><button type="button" id="reqtemplate">Download CSV template</button></div><label class="l" for="reqcsv">CSV file</label><input id="reqcsv" type="file" accept=".csv,text/csv">';
  }
  function inboxView(){
    const api=window.CCSARequests;
    if(!api)return '<p class="empty">Requests did not load.</p>';
    const access=session.mode==='demo'?api.demoAccess(session.agency.id):{};
    const rows=(session.requests||[]).slice().sort(function(a,b){return (a.createdAt||'')<(b.createdAt||'')?1:-1});
    const cards=rows.map(function(row){
      const who=row.status==='completed'?null:access[row.id];
      const buttons=row.status==='new'?'<button type="button" class="pri" data-accept="'+esc(row.id)+'">Accept</button><button type="button" data-status="declined" data-req="'+esc(row.id)+'">Decline</button>':row.status==='accepted'?'<button type="button" data-status="scheduled" data-req="'+esc(row.id)+'">Mark scheduled</button><button type="button" data-calendar="'+esc(row.id)+'">Add to calendar</button>':row.status==='scheduled'?'<button type="button" data-status="completed" data-req="'+esc(row.id)+'">Mark completed</button>':'';
      return '<article class="card"><div class="pills"><span class="pill book">'+esc(api.statusLabel(row.status))+'</span></div><h2>'+esc(row.address)+'</h2><p class="meta">'+esc(row.tenancy)+(row.timeframe?' · '+esc(row.timeframe):'')+'</p>'+(who?'<p class="meta">Access: '+esc(who.contactName)+' · '+esc(who.contactPhone)+'</p>':'')+'<div class="actions">'+buttons+'</div></article>';
    }).join('');
    return '<button type="button" class="back" data-tab="jobs">Back</button><h1 id="inbox">Job requests</h1><p>Adam sees the access phone here. Agencies do not. Completing a request removes that phone from this list.</p>'+(view.notice?'<p class="note">'+esc(view.notice)+'</p>':'')+(cards||'<p class="empty">No requests.</p>');
  }
  function certificateView(){
    const cert=(session.certificates||[]).filter(function(c){return c.id===view.certificateId})[0];
    if(!cert||!window.CCSACertificate)return '<button type="button" class="back" data-tab="certificates">Back</button><p class="empty">That certificate is not in this agency.</p>';
    const model=CCSACertificate.viewModel(cert);
    const rows=model.alarms.map(function(a){
      return '<tr><td data-label="Product">'+esc(a.product)+'</td><td data-label="Location">'+esc(a.location||'')+'</td><td data-label="Expiry">'+esc(a.expiry||'')+'</td><td data-label="Action">'+esc(a.action)+'</td><td data-label="Reason">'+esc(a.reason)+'</td></tr>';
    }).join('');
    const side=[['Job Number',model.jobNumber],['Service Reason',model.serviceReason],['Inspected by',model.inspector],['Last Inspection Date',model.lastInspection]].map(function(pair){
      return '<div class="reportsideitem"><span>'+esc(pair[0])+'</span><b>'+esc(pair[1]||'')+'</b></div>';
    }).join('');
    const laws=model.laws.map(function(law){return '<li>'+esc(law)+'</li>'}).join('');
    const lead=model.compliant?model.complianceLead:model.failLead;
    return '<button type="button" class="back" data-tab="certificates">Back</button><article class="report" id="certificate"><header class="reporthead"><img class="reportlogo" src="../icon-192.png" alt=""><div><div class="reporttitle">'+esc(model.title)+'</div><div class="reportbrand">'+esc(model.brand)+'</div><div class="reportphone">'+esc(model.phone)+'</div></div></header><div class="reporttop"><div><div>'+esc(model.attention)+'</div>'+model.postal.map(function(line){return '<div>'+esc(line)+'</div>'}).join('')+'</div><div>Report Date: <b>'+esc(model.reportDate||'')+'</b></div></div><div class="reportdetail"><div class="reportmain"><div class="reportline"><span class="reportlabel">SERVICE DETAILS</span><span class="reportaddr">'+esc(model.serviceAddress)+'</span></div><div class="complybox">'+(model.compliant?'<span class="tick" aria-hidden="true">✓</span>':'')+'<div><p>'+esc(lead)+'</p><ul>'+laws+'</ul><p>'+esc(model.batteryNote)+'</p></div></div></div><div class="reportside">'+side+'</div></div><table class="reporttable"><thead><tr><th>Product Description</th><th>Location</th><th>Expiry Date</th><th>Action</th><th>Reason</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No alarms were recorded.</td></tr>')+'</tbody></table><p class="legend">'+esc(model.legend)+'</p><p class="foot">'+esc(model.footer)+'</p><div class="actions"><button type="button" class="pri" data-download="'+esc(cert.id)+'">Download service report</button><button type="button" data-compliance="'+esc(cert.id)+'">Download compliance certificate</button></div></article>';
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
    if(view.inbox)body=inboxView();
    else if(view.requestForm)body=requestForm();
    else if(view.invoiceId)body=invoiceView();
    else if(view.certificateId)body=certificateView();
    else if(view.propertyId)body=propertyView();
    else if(view.tab==='jobs')body=jobsView();
    else if(view.tab==='certificates')body=certificatesView();
    else if(view.tab==='invoices')body=invoicesView();
    else body=propertyCards();
    const showTools=!view.propertyId&&!view.certificateId&&!view.invoiceId&&!view.requestForm&&!view.inbox;
    const foot=view.inbox?'Access phones are on this inbox only. They are removed when a request is completed, and they are not shown to the agency.':'Portal for '+esc(session.agency.name)+'. Tenant names, phone numbers and email addresses are not shown.';
    return header()+'<main>'+demoBar()+(showTools?stats()+tabs():'')+body+'<p class="foot">'+foot+'</p></main>';
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
  function dueFor(cert){
    const prop=(session.properties||[]).filter(function(p){return p.id===cert.propertyId})[0];
    return prop&&prop.due||'';
  }
  function downloadCompliance(id){
    const cert=(session.certificates||[]).filter(function(c){return c.id===id})[0];
    if(!cert||!window.CCSACertificate)return;
    const bytes=CCSACertificate.buildCompliancePdf(cert,{due:dueFor(cert)});
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    const url=URL.createObjectURL(blob);
    a.href=url;a.download=CCSACertificate.complianceFileName(cert);
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},4000);
  }
  function readFile(file){
    return new Promise(function(resolve,reject){
      if(!file){resolve(null);return}
      if(file.size>450000){reject(new Error('That file is over 450 KB. Choose a smaller PDF or photo. Nothing was sent.'));return}
      const reader=new FileReader();
      reader.onload=function(){
        const raw=String(reader.result||'');
        const comma=raw.indexOf(',');
        resolve({fileName:file.name,fileType:file.type,fileData:comma>=0?raw.slice(comma+1):raw});
      };
      reader.onerror=function(){reject(new Error('That file could not be read. Nothing was sent.'))};
      reader.readAsDataURL(file);
    });
  }
  async function sendBuilt(items){
    if(session.mode==='demo'){
      items.forEach(function(item){session.requests.unshift(item.request)});
      view.notice='Sent '+items.length+' request'+(items.length===1?'':'s')+'. The access phone stays with Adam and is not shown here.';
      view.requestForm=false;
      view.tab='jobs';
      go({requestForm:false,tab:'jobs',notice:view.notice});
      return;
    }
    if(!authBits){view.notice='Sign in again before sending.';paint();return}
    const store=authBits.storeMod;
    for(let i=0;i<items.length;i++){
      const item=items[i];
      await store.setDoc(store.doc(authBits.db,'portal',item.request.agencyId,'requests',item.request.id),item.request);
      await store.setDoc(store.doc(authBits.db,'portal',item.access.agencyId,'access',item.access.id),item.access);
      session.requests.unshift(item.request);
    }
    view.notice='Sent '+items.length+' request'+(items.length===1?'':'s')+'. The access phone stays with Adam and is not shown here.';
    go({requestForm:false,tab:'jobs',notice:view.notice});
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
    if(demo)demo.onchange=function(){loadDemo(demo.value);view.propertyId='';view.certificateId='';view.invoiceId='';view.requestForm=false;view.inbox=false;view.filter='';view.notice='';paint()};
    const reqForm=document.getElementById('requestform');
    if(reqForm)reqForm.onsubmit=function(e){
      e.preventDefault();
      const file=document.getElementById('reqfile').files[0];
      readFile(file).then(function(attached){
        const built=window.CCSARequests.buildOne(session.agency,{
          address:document.getElementById('reqaddr').value,
          tenancy:document.getElementById('reqten').value,
          contactName:document.getElementById('reqname').value,
          contactPhone:document.getElementById('reqphone').value,
          timeframe:document.getElementById('reqtime').value,
          notes:document.getElementById('reqnotes').value,
          fileName:attached&&attached.fileName,
          fileType:attached&&attached.fileType,
          fileData:attached&&attached.fileData
        },new Date().toISOString());
        if(!built.ok){view.notice=built.error;paint();return}
        return sendBuilt([built]);
      }).catch(function(err){view.notice=err.message;paint()});
    };
    const csv=document.getElementById('reqcsv');
    if(csv)csv.onchange=function(){
      const file=csv.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=function(){
        const parsed=CCSARequests.parseCsv(String(reader.result||''));
        if(!parsed.ok){view.notice=parsed.error;paint();return}
        const many=CCSARequests.buildMany(session.agency,parsed.rows,new Date().toISOString());
        if(!many.ok){view.notice=many.error;paint();return}
        sendBuilt(many.items).catch(function(err){view.notice=err.message||'That upload did not finish.';paint()});
      };
      reader.readAsText(file);
    };
    appEl.onclick=function(e){
      const b=e.target.closest?e.target.closest('button'):null;
      if(!b||!appEl.contains(b))return;
      if(b.id==='newjob')go({requestForm:true,inbox:false,propertyId:'',certificateId:'',invoiceId:'',tab:'jobs'});
      if(b.id==='demoinbox')go({inbox:true,requestForm:false,propertyId:'',certificateId:'',invoiceId:''});
      if(b.id==='reqtemplate'){
        const blob=new Blob([CCSARequests.csvTemplate()],{type:'text/csv'});
        const a=document.createElement('a');
        const url=URL.createObjectURL(blob);
        a.href=url;a.download='ccsa-job-requests.csv';
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(url)},4000);
      }
      if(b.dataset.accept||b.dataset.req){
        const id=b.dataset.accept||b.dataset.req;
        const status=b.dataset.accept?'accepted':b.dataset.status;
        const row=(session.requests||[]).filter(function(item){return item.id===id})[0];
        const access=window.CCSARequests.demoAccess(session.agency.id)[id]||null;
        const moved=CCSARequests.applyStatus(row,access,status);
        if(!moved.ok){view.notice=moved.error;paint();return}
        const at=session.requests.findIndex(function(item){return item.id===id});
        if(at>=0)session.requests[at]=moved.request;
        view.notice=status==='completed'?'Completed. The access phone was removed.':CCSARequests.statusLabel(status)+'.';
        paint();
      }
      if(b.dataset.calendar){view.notice='Calendar events are added from Adam\'s app, and only when he taps Add to calendar. Nothing was sent.';paint()}
      if(b.dataset.tab)go({tab:b.dataset.tab,propertyId:'',certificateId:'',invoiceId:'',requestForm:false,inbox:false,filter:view.filter});
      if(b.dataset.filter!=null&&b.classList.contains('stat'))go({filter:view.filter===b.dataset.filter?'':b.dataset.filter,tab:'properties',propertyId:'',certificateId:'',invoiceId:''});
      if(b.dataset.property)go({propertyId:b.dataset.property,certificateId:'',invoiceId:'',tab:'properties'});
      if(b.dataset.certificate)go({certificateId:b.dataset.certificate,propertyId:'',invoiceId:''});
      if(b.dataset.invoice)go({invoiceId:b.dataset.invoice,certificateId:'',propertyId:'',tab:'invoices'});
      if(b.dataset.download)download(b.dataset.download);
      if(b.dataset.compliance)downloadCompliance(b.dataset.compliance);
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
    let requests=[];
    try{invoices=await read('invoices')}catch(e){invoices=[]}
    try{requests=await read('requests')}catch(e){requests=[]}
    const today=data().sydneyToday();
    session={mode:'live',today:today,agency:agency,jobs:jobs,certificates:certificates,invoices:invoices,requests:requests,properties:data().rollup(jobs,today,agency),choices:[],notice:''};
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
    session=null;view={tab:'properties',q:'',filter:'',propertyId:'',certificateId:'',invoiceId:'',invoiceStatus:'',invFrom:'',invTo:'',requestForm:false,inbox:false,notice:''};
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
