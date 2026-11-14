/* Per-agency portal records.
   Agency is the access key. A portal record has the property address, the
   service, and the alarm results. It never has a tenant name, phone, email,
   or contact block. Completed visits are kept when a later booking is published. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSAPortalData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DUE_SOON_DAYS=30;
  const AGENCIES=[
    {id:'rwm',code:'Ray White Maclean/Yamba',name:'Ray White Maclean/Yamba'},
    {id:'lifestyle',code:'Lifestyle Maclean/Yamba',name:'Lifestyle Maclean/Yamba'},
    {id:'rh',code:'Raine & Horne Maclean/Yamba',name:'Raine & Horne Maclean/Yamba'},
    {id:'ljh',code:'LJH Iluka',name:'LJH Iluka'},
    {id:'mckimms',code:'McKimms Grafton',name:'McKimms Grafton'},
    {id:'rwg',code:'Ray White Grafton',name:'Ray White Grafton'},
    {id:'dougherty',code:'Dougherty Property Grafton',name:'Dougherty Property Grafton'},
    {id:'elders',code:'Elders Real Estate Clarence Valley',name:'Elders Real Estate Clarence Valley'},
    {id:'yamba-valley',code:'Yamba Valley Real Estate',name:'Yamba Valley Real Estate'}
  ];
  const TYPES=['Ionization','Photo-Electric','Heat'];
  const POWERS=['9v','240v','Ni-Mh','Lithium'];
  const RESULTS=['','pass','replace','fail','incomplete'];
  const STATUSES=['upcoming','booked','completed'];
  const COMPLIANCE=['compliant','due soon','overdue','failed'];
  const PROPERTY_KEYS=['id','agencyId','agencyCode','address','street','town','ident','tenancy','compliance','lastService','due','alarmCount','publishedAt'];
  const JOB_KEYS=['id','propertyId','agencyId','agencyCode','address','street','town','ident','tenancy','status','serviceDate','appointment','appointmentTime','lastService','due','result','alarmCount','priorDate','priorResult','publishedAt'];
  const CERT_KEYS=['id','propertyId','jobId','agencyId','agencyCode','address','ident','tenancy','date','lastInspection','tech','statement','result','alarms','publishedAt'];
  const ALARM_KEYS=['n','location','type','power','expiry','result'];
  const FORBIDDEN=['contact','p1','p2','phone','phoneLine','email','tenant','tenantName','tenantPhone','tenantEmail','mobile','directions','notes','comments'];
  const SAMPLE_TENANT={name:'Jane Tenant',phone:'0400 111 222',phone2:'02 6645 1234',email:'jane.tenant@example.com'};

  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function pad2(n){return String(n).padStart(2,'0')}
  function sheets(){
    if(typeof SheetFill!=='undefined'&&SheetFill.agencyFields)return SheetFill;
    if(typeof require==='function'){
      try{return require('./sheetfill.js')}catch(e){return null}
    }
    return null;
  }
  function slug(v){
    return clean(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  }
  function agencies(){return AGENCIES.map(function(a){return {id:a.id,code:a.code,name:a.name}})}
  function agencyFromCode(raw){
    const lib=sheets();
    const code=lib?lib.agencyFields(raw).agent:clean(raw);
    if(!code)return null;
    if((lib&&lib.isPrivateOwner&&lib.isPrivateOwner(code))||code==='Private Owner')return {id:'',code:'Private Owner',name:'',privateOwner:true};
    const known=AGENCIES.filter(function(a){return a.code===code||a.id===code})[0];
    if(known)return {id:known.id,code:known.code,name:known.name};
    const id=slug(code);
    if(!id)return null;
    return {id:id,code:code,name:code};
  }
  function tenancyOf(job,form){
    const lib=sheets();
    const name=lib?lib.tenancyForForm(form||{},job||{},{}):'';
    if(name==='Holiday'||name==='Permanent')return name;
    const raw=clean((form&&form.tenancy)||(job&&job.section)||'');
    if(/^hol/i.test(raw))return 'Holiday';
    if(/^perm/i.test(raw))return 'Permanent';
    return '';
  }
  function ymd(v){
    const s=clean(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
  }
  function dayNumber(v){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd(v));
    if(!m)return NaN;
    return Date.UTC(+m[1],+m[2]-1,+m[3])/86400000;
  }
  function daysUntil(today,due){return dayNumber(due)-dayNumber(today)}
  function addDays(v,n){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd(v));
    if(!m)return '';
    const dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+(+n||0)));
    return dt.getUTCFullYear()+'-'+pad2(dt.getUTCMonth()+1)+'-'+pad2(dt.getUTCDate());
  }
  function sydneyParts(ms){
    const fmt=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(function(x){return [x.type,x.value]}));
    if(p.hour==='24')p.hour='00';
    return p;
  }
  function sydneyToday(now){
    const ms=now==null?Date.now():(now instanceof Date?now.getTime():+now);
    const p=sydneyParts(ms);
    return p.year+'-'+p.month+'-'+p.day;
  }
  function appointmentOf(svc){
    if(!svc)return {date:'',time:''};
    const s=clean(svc);
    if(ymd(s))return {date:s,time:''};
    const t=Date.parse(s);
    if(isNaN(t))return {date:'',time:''};
    const p=sydneyParts(t);
    return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};
  }
  function prettyDate(v){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd(v));
    if(!m)return '';
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return (+m[3])+' '+months[+m[2]-1]+' '+m[1];
  }
  function prettyTime(v){
    const m=/^(\d{2}):(\d{2})$/.exec(clean(v));
    if(!m)return '';
    let h=+m[1];
    const ap=h>=12?'pm':'am';
    h=h%12;if(h===0)h=12;
    return h+':'+m[2]+' '+ap;
  }
  function scrubString(v){
    return clean(String(v)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'')
      .replace(/(?:\+?61|0)[ \-]*[2-478](?:[ \-]*\d){8}\b/g,''));
  }
  function phoneOrEmail(v){
    const s=String(v==null?'':v);
    if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s))return true;
    if(/(?:\+?61|0)[ \-]*[2-478](?:[ \-]*\d){8}\b/.test(s))return true;
    return false;
  }
  function walk(value,path,hits){
    if(Array.isArray(value)){
      value.forEach(function(item,i){walk(item,path+'['+i+']',hits)});
      return;
    }
    if(value&&typeof value==='object'){
      Object.keys(value).forEach(function(key){
        if(FORBIDDEN.indexOf(key)>=0)hits.push(path+'.'+key);
        walk(value[key],path+'.'+key,hits);
      });
      return;
    }
    if(typeof value==='string'&&phoneOrEmail(value))hits.push(path);
  }
  function tenantHits(value){
    const hits=[];
    walk(value,'portal',hits);
    return hits;
  }
  function addressOf(job,form){return scrubString((form&&form.addr)||(job&&job.addr)||'')}
  function portalStatus(job,form){
    if((form&&form.done)||(job&&job.arch))return 'completed';
    if(job&&job.svc)return 'booked';
    return 'upcoming';
  }
  function pickList(list,allowed){
    const want=allowed.map(function(x){return x.toLowerCase()});
    const out=[];
    (list||[]).forEach(function(item){
      const i=want.indexOf(clean(item).toLowerCase());
      if(i>=0&&out.indexOf(allowed[i])<0)out.push(allowed[i]);
    });
    return out.join(', ');
  }
  function expiryOf(v){
    const s=clean(v);
    let m=s.match(/^(\d{1,2})\/(\d{4})$/);
    if(m){
      const month=+m[1];
      if(month>=1&&month<=12)return pad2(month)+'/'+m[2];
    }
    m=s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
    if(m){
      const month=+m[2];
      if(month>=1&&month<=12)return pad2(month)+'/'+m[1];
    }
    return '';
  }
  function alarmLocation(a){
    a=a||{};
    let room='';
    if(a.room==='Bedroom'&&clean(a.bedno))room='Bedroom '+clean(a.bedno);
    else if(a.room==='Other')room=clean(a.other)||'Other';
    else room=clean(a.room);
    const parts=[];
    if(clean(a.mount))parts.push(clean(a.mount));
    if(room)parts.push(room);
    if(clean(a.adjacent))parts.push('near '+clean(a.adjacent));
    return scrubString(parts.join(', '));
  }
  function alarmResult(a){
    a=a||{};
    const yn=a.yn||{};
    const critical=['comply','located','button','affixed'];
    if(critical.some(function(k){return yn[k]==='No'}))return 'fail';
    const replaced=!!(a.isNew||a.newAns==='Yes');
    if(critical.some(function(k){return yn[k]!=='Yes'}))return 'incomplete';
    return replaced?'replace':'pass';
  }
  function serviceResult(form){
    if(!form)return '';
    const n=+form.alarms||0;
    if(!n)return '';
    const list=(form.al||[]).slice(0,n);
    if(!list.length)return '';
    let replace=false,fail=false,incomplete=false;
    list.forEach(function(a){
      const result=alarmResult(a);
      if(result==='fail')fail=true;
      else if(result==='incomplete')incomplete=true;
      else if(result==='replace')replace=true;
    });
    if(fail)return 'fail';
    if(incomplete)return 'incomplete';
    if(replace)return 'replace';
    return 'pass';
  }
  function priorOf(job,form){
    const tested=serviceResult(form);
    const completed=portalStatus(job,form)==='completed';
    if(completed&&tested)return {date:ymd(form&&form.date)||appointmentOf(job&&job.svc).date||ymd(job&&job.last),result:tested};
    const ic=clean(job&&job.ic).toLowerCase();
    if(/fail|not compliant/.test(ic))return {date:ymd(job&&job.last),result:'fail'};
    if(ymd(job&&job.last))return {date:ymd(job.last),result:'pass'};
    return {date:'',result:''};
  }
  function dueOf(job,form,serviceDate){
    if(ymd(job&&job.due))return ymd(job.due);
    const base=serviceDate||ymd(job&&job.last);
    return base?addDays(base,365):'';
  }
  function complianceStatus(spec){
    spec=spec||{};
    const today=ymd(spec.today);
    const due=ymd(spec.due);
    const result=RESULTS.indexOf(spec.result)>=0?spec.result:'';
    if(result==='fail')return 'failed';
    if(due&&today&&due<today)return 'overdue';
    if(due&&today&&daysUntil(today,due)<=DUE_SOON_DAYS)return 'due soon';
    if(result==='pass'||result==='replace')return 'compliant';
    if(due&&today&&due>=today)return 'due soon';
    return 'overdue';
  }
  function resultLabel(result){
    if(result==='pass')return 'Pass';
    if(result==='replace')return 'Replace';
    if(result==='fail')return 'Fail';
    if(result==='incomplete')return 'Incomplete';
    return '';
  }
  function statusLabel(status){
    if(status==='booked')return 'Booked';
    if(status==='completed')return 'Completed';
    return 'Upcoming';
  }
  function complianceLabel(v){
    if(v==='compliant')return 'Compliant';
    if(v==='due soon')return 'Due soon';
    if(v==='overdue')return 'Overdue';
    if(v==='failed')return 'Failed';
    return '';
  }
  function statementFor(tech,date){
    const who=scrubString(tech)||'The technician';
    const when=prettyDate(date);
    return who+' inspected the smoke alarms at this property'+(when?' on '+when:'')+' for Clarence Coast Smoke Alarms. Each alarm listed was tested. Pass means the recorded checks were met. Replace means the alarm was replaced and the new alarm passed those checks. Fail means a recorded check was not met. This certificate is for the property manager and does not include tenant names, phone numbers or email addresses.';
  }
  function alarmsOf(form){
    const n=+form.alarms||0;
    return (form.al||[]).slice(0,n).map(function(a,i){
      return {
        n:i+1,
        location:alarmLocation(a),
        type:pickList(a&&a.sensor,TYPES),
        power:pickList(a&&a.power,POWERS),
        expiry:expiryOf(a&&a.expiry),
        result:alarmResult(a)
      };
    });
  }
  function propertyKey(addr){return slug(addr)||'property'}
  function mapOne(job,form,publishedAt){
    if(!job)return null;
    const agency=agencyFromCode((form&&form.agentSet&&form.agent)||(form&&form.agent)||job.agent||'');
    if(!agency||agency.privateOwner||!agency.id)return null;
    const address=addressOf(job,form);
    if(!address)return null;
    const status=portalStatus(job,form);
    const appt=appointmentOf(job.svc);
    const serviceDate=status==='completed'?(ymd(form&&form.date)||appt.date||ymd(job.last)):'';
    const prior=priorOf(job,form);
    const due=dueOf(job,form,serviceDate||prior.date);
    const propertyId=propertyKey(address);
    const id=status==='completed'
      ?propertyId+'-'+(serviceDate||'undated')
      :propertyId+'-'+status+'-'+(appt.date||'open');
    const tenancy=tenancyOf(job,form);
    const alarmCount=form&&+form.alarms?+form.alarms:(+job.alarms||0);
    const row={
      id:id,
      propertyId:propertyId,
      agencyId:agency.id,
      agencyCode:agency.code,
      address:address,
      street:scrubString(job.street||''),
      town:scrubString(job.town||''),
      ident:scrubString((form&&form.ident)||job.ident||''),
      tenancy:tenancy,
      status:status,
      serviceDate:serviceDate,
      appointment:status==='completed'?'':appt.date,
      appointmentTime:status==='completed'?'':appt.time,
      lastService:serviceDate||prior.date,
      due:due,
      result:status==='completed'?serviceResult(form):'',
      alarmCount:alarmCount>0?alarmCount:0,
      priorDate:status==='completed'?'':prior.date,
      priorResult:status==='completed'?'':prior.result,
      publishedAt:publishedAt||''
    };
    let certificate=null;
    let retract='';
    if(status==='completed'&&form&&alarmCount>0&&serviceDate){
      const result=row.result||'incomplete';
      certificate={
        id:propertyId+'-'+serviceDate,
        propertyId:propertyId,
        jobId:row.id,
        agencyId:agency.id,
        agencyCode:agency.code,
        address:address,
        ident:row.ident,
        tenancy:tenancy,
        date:serviceDate,
        lastInspection:(function(){const last=ymd(job.last);return last&&last!==serviceDate?last:''})(),
        tech:scrubString((form&&form.tech)||job.tech||'')||'Adam Westerman',
        statement:'',
        result:result,
        alarms:alarmsOf(form),
        publishedAt:publishedAt||''
      };
      certificate.statement=statementFor(certificate.tech,certificate.date);
    }else if(form&&ymd(form.date)){
      retract=propertyId+'-'+ymd(form.date);
    }
    return {agency:agency,job:row,certificate:certificate,retract:retract};
  }
  function byDateDesc(list,field){
    return list.slice().sort(function(a,b){
      const av=a[field]||'';
      const bv=b[field]||'';
      if(av===bv)return (a.id||'').localeCompare(b.id||'');
      return av<bv?1:-1;
    });
  }
  function rollup(jobs,today,agency){
    agency=agency||{};
    const groups=new Map();
    (jobs||[]).forEach(function(job){
      if(!job||!job.propertyId)return;
      if(!groups.has(job.propertyId))groups.set(job.propertyId,[]);
      groups.get(job.propertyId).push(job);
    });
    const properties=[];
    groups.forEach(function(list,propertyId){
      const completed=byDateDesc(list.filter(function(j){return j.status==='completed'&&j.serviceDate}),'serviceDate');
      const latest=completed[0]||byDateDesc(list,'lastService')[0]||list[0];
      const prior=list.filter(function(j){return j.priorDate&&(j.priorResult==='pass'||j.priorResult==='replace'||j.priorResult==='fail')}).sort(function(a,b){return a.priorDate<b.priorDate?1:-1})[0];
      const result=completed.length?(completed[0].result||''):(prior?prior.priorResult:'');
      const lastService=completed.length?completed[0].serviceDate:(prior?prior.priorDate:(latest.lastService||''));
      const due=(completed.length&&completed[0].due)||(latest&&latest.due)||(lastService?addDays(lastService,365):'');
      const alarmCount=completed.length?completed[0].alarmCount:(latest.alarmCount||0);
      properties.push({
        id:propertyId,
        agencyId:latest.agencyId||agency.id||'',
        agencyCode:latest.agencyCode||agency.code||'',
        address:latest.address||'',
        street:latest.street||'',
        town:latest.town||'',
        ident:latest.ident||'',
        tenancy:latest.tenancy||'',
        compliance:complianceStatus({result:result,due:due,today:today}),
        lastService:lastService||'',
        due:due||'',
        alarmCount:alarmCount||0,
        publishedAt:latest.publishedAt||''
      });
    });
    const rank={failed:0,overdue:1,'due soon':2,compliant:3};
    properties.sort(function(a,b){
      const d=(rank[a.compliance]??9)-(rank[b.compliance]??9);
      if(d)return d;
      return (a.address||'').localeCompare(b.address||'');
    });
    return properties;
  }
  function buildPortal(jobs,forms,today,now){
    const day=ymd(today)||sydneyToday();
    const publishedAt=now||day;
    const agencies={};
    (jobs||[]).forEach(function(job){
      if(!job)return;
      const form=forms&&job.id!=null?forms[job.id]:null;
      const mapped=mapOne(job,form,publishedAt);
      if(!mapped)return;
      const bucket=agencies[mapped.agency.id]||(agencies[mapped.agency.id]={
        id:mapped.agency.id,code:mapped.agency.code,name:mapped.agency.name,
        jobs:[],certificates:[],retractCertificates:[],properties:[],seen:{}
      });
      if(bucket.seen[mapped.job.id])return;
      bucket.seen[mapped.job.id]=true;
      bucket.jobs.push(mapped.job);
      if(mapped.certificate)bucket.certificates.push(mapped.certificate);
      if(mapped.retract)bucket.retractCertificates.push(mapped.retract);
    });
    Object.keys(agencies).forEach(function(id){
      const bucket=agencies[id];
      delete bucket.seen;
      bucket.properties=rollup(bucket.jobs,day,bucket);
      bucket.properties.forEach(function(p){p.publishedAt=publishedAt});
    });
    return {today:day,publishedAt:publishedAt,agencies:agencies};
  }
  function planWrites(localAgency,remoteJobs,today){
    localAgency=localAgency||{id:'',jobs:[],certificates:[],retractCertificates:[]};
    const remote=(remoteJobs||[]).filter(function(j){return j&&j.agencyId===localAgency.id});
    const localIds={};
    (localAgency.jobs||[]).forEach(function(j){if(j&&j.id)localIds[j.id]=j});
    const combined=[];
    remote.forEach(function(j){
      if(j.status==='completed'&&j.id&&!localIds[j.id])combined.push(j);
    });
    (localAgency.jobs||[]).forEach(function(j){combined.push(j)});
    const retract={};
    (localAgency.retractCertificates||[]).forEach(function(id){if(id)retract[id]=true});
    (localAgency.certificates||[]).forEach(function(cert){if(cert&&cert.id)delete retract[cert.id]});
    const properties=rollup(combined,today||sydneyToday(),localAgency);
    const stamp=(localAgency.jobs&&localAgency.jobs[0]&&localAgency.jobs[0].publishedAt)||'';
    if(stamp)properties.forEach(function(p){p.publishedAt=stamp});
    return {
      jobs:localAgency.jobs||[],
      properties:properties,
      certificates:localAgency.certificates||[],
      deleteJobIds:remote.filter(function(j){return (j.status==='upcoming'||j.status==='booked')&&!localIds[j.id]}).map(function(j){return j.id}),
      deleteCertificateIds:Object.keys(retract)
    };
  }
  function counts(properties){
    const out={properties:(properties||[]).length,compliant:0,'due soon':0,overdue:0,failed:0};
    (properties||[]).forEach(function(p){if(out[p.compliance]!=null)out[p.compliance]++});
    return out;
  }
  function sameKeys(value,keys){
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const got=Object.keys(value).sort();
    const want=keys.slice().sort();
    if(got.length!==want.length)return false;
    return got.every(function(key,i){return key===want[i]});
  }
  function alarmKeysOk(alarms){
    return Array.isArray(alarms)&&alarms.every(function(a){return sameKeys(a,ALARM_KEYS)&&['pass','replace','fail','incomplete'].indexOf(a.result)>=0});
  }
  function bundleClean(bundle){
    const hits=tenantHits(bundle);
    const agencies=bundle&&bundle.agencies||{};
    Object.keys(agencies).forEach(function(id){
      const bucket=agencies[id];
      (bucket.properties||[]).forEach(function(p){if(!sameKeys(p,PROPERTY_KEYS))hits.push('property keys '+id)});
      (bucket.jobs||[]).forEach(function(j){if(!sameKeys(j,JOB_KEYS))hits.push('job keys '+j.id)});
      (bucket.certificates||[]).forEach(function(c){
        if(!sameKeys(c,CERT_KEYS))hits.push('certificate keys '+c.id);
        if(!alarmKeysOk(c.alarms))hits.push('alarm keys '+c.id);
      });
    });
    return hits;
  }
  function demoInput(){
    const passYn={comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes',cleaned:'Yes',battery:'Yes'};
    function alarm(over){
      return Object.assign({isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],expiry:'08/2031',yn:Object.assign({},passYn)},over||{});
    }
    const jobs=[
      {id:'river',agent:'RWM',section:'Permanent',addr:'18 River Street, Maclean NSW 2463',street:'18 River Street',town:'Maclean',ident:'',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,p2:SAMPLE_TENANT.phone2,notes:'Tenant email '+SAMPLE_TENANT.email,due:'2027-08-12',last:'2025-08-12',alarms:2,arch:'2026-08-12T02:00:00.000Z',tech:'Adam Westerman'},
      {id:'wharf-done',agent:'Ray White Maclean',section:'Holiday',addr:'6 Wharf Street, Maclean NSW 2463',street:'6 Wharf Street',town:'Maclean',ident:'Unit 2',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,due:'2026-11-20',last:'2024-11-20',alarms:1,arch:'2025-11-20T01:00:00.000Z',tech:'Adam Westerman'},
      {id:'wharf-next',agent:'RWM',section:'Holiday',addr:'6 Wharf Street, Maclean NSW 2463',street:'6 Wharf Street',town:'Maclean',ident:'Unit 2',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,p2:'',due:'2026-11-20',last:'2025-11-20',svc:'2026-11-20T09:30:00+11:00',alarms:1,arch:null},
      {id:'cameron',agent:'RWM',section:'Permanent',addr:'42 Cameron Street, Maclean NSW 2463',street:'42 Cameron Street',town:'Maclean',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,due:'2026-09-01',last:'2025-09-01',alarms:1,arch:null},
      {id:'church',agent:'RWM',section:'Permanent',addr:'9 Church Street, Maclean NSW 2463',street:'9 Church Street',town:'Maclean',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,due:'2027-10-02',last:'2025-10-02',alarms:2,arch:'2026-10-02T03:00:00.000Z',tech:'Adam Westerman'},
      {id:'short',agent:'RWM',section:'Holiday',addr:'15 Short Street, Townsend NSW 2463',street:'15 Short Street',town:'Townsend',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,due:'2027-07-01',last:'2025-07-01',alarms:1,arch:'2026-07-01T00:30:00.000Z',tech:'Adam Westerman'},
      {id:'union',agent:'RWM',section:'Permanent',addr:'3 Union Street, Maclean NSW 2463',street:'3 Union Street',town:'Maclean',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,due:'2027-06-01',last:'2026-06-01',svc:'2026-12-02T11:00:00+11:00',alarms:1,arch:null},
      {id:'yamba',agent:'Lifestyle',section:'Permanent',addr:'21 Yamba Street, Yamba NSW 2464',street:'21 Yamba Street',town:'Yamba',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,notes:SAMPLE_TENANT.email,due:'2027-05-04',last:'2026-05-04',alarms:1,arch:'2026-05-04T01:00:00.000Z',tech:'Adam Westerman'},
      {id:'rh-job',agent:'R&H',section:'Holiday',addr:'4 Clarence Street, Maclean NSW 2463',street:'4 Clarence Street',town:'Maclean',contact:SAMPLE_TENANT.name,p1:SAMPLE_TENANT.phone,due:'2027-04-01',last:'2026-04-01',alarms:1,arch:'2026-04-01T01:00:00.000Z',tech:'Adam Westerman'}
    ];
    const forms={
      river:{agent:'RWM',agentSet:true,tenancy:'Permanent',tenancySet:true,addr:'18 River Street, Maclean NSW 2463',ident:'',phoneLine:SAMPLE_TENANT.phone+' / '+SAMPLE_TENANT.phone2,comments:'Call '+SAMPLE_TENANT.name+' on '+SAMPLE_TENANT.phone+' '+SAMPLE_TENANT.email,tech:'Adam Westerman',date:'2026-08-12',done:true,alarms:2,al:[alarm({room:'Hallway'}),alarm({room:'Bedroom',bedno:'1',power:['Lithium'],sensor:['Photo-Electric'],expiry:'08/2031'})]},
      'wharf-done':{agent:'RWM',tenancy:'Holiday',addr:'6 Wharf Street, Maclean NSW 2463',ident:'Unit 2',phoneLine:SAMPLE_TENANT.phone,tech:'Adam Westerman',date:'2025-11-20',done:true,alarms:1,al:[alarm({room:'Hallway',expiry:'11/2030'})]},
      'wharf-next':{agent:'RWM',tenancy:'Holiday',addr:'6 Wharf Street, Maclean NSW 2463',ident:'Unit 2',phoneLine:SAMPLE_TENANT.phone,date:'',done:false,alarms:1,al:[alarm()]},
      church:{agent:'RWM',tenancy:'Permanent',addr:'9 Church Street, Maclean NSW 2463',tech:'Adam Westerman',date:'2026-10-02',done:true,alarms:2,al:[alarm({room:'Entryway',expiry:'10/2031'}),alarm({room:'Lounge',power:['9v'],expiry:'10/2026',yn:{comply:'Yes',located:'Yes',button:'No',affixed:'Yes',cleaned:'Yes',battery:'Yes'}})]},
      short:{agent:'RWM',tenancy:'Holiday',addr:'15 Short Street, Townsend NSW 2463',tech:'Adam Westerman',date:'2026-07-01',done:true,alarms:1,al:[alarm({isNew:true,newAns:'Yes',room:'Hallway',power:['240v'],expiry:'07/2036'})]},
      yamba:{agent:'LIFE',agentSet:true,tenancy:'Permanent',addr:'21 Yamba Street, Yamba NSW 2464',tech:'Adam Westerman',date:'2026-05-04',done:true,alarms:1,al:[alarm({room:'Hallway',expiry:'05/2036'})]},
      'rh-job':{agent:'Raine & Horne',agentSet:true,tenancy:'Holiday',addr:'4 Clarence Street, Maclean NSW 2463',tech:'Adam Westerman',date:'2026-04-01',done:true,alarms:1,al:[alarm({room:'Hallway',expiry:'04/2036'})]}
    };
    return {jobs:jobs,forms:forms,today:'2026-11-13',now:'2026-11-13T00:00:00.000Z',tenant:SAMPLE_TENANT};
  }
  function demoPortal(){
    const sample=demoInput();
    return buildPortal(sample.jobs,sample.forms,sample.today,sample.now);
  }
  function demoView(agencyId){
    const portal=demoPortal();
    return portal.agencies[agencyId]||null;
  }
  function authError(code,host){
    const site=host||'this site';
    if(code==='auth/unauthorized-domain')return 'Sign-in is blocked for '+site+'. In Firebase Authentication, open Settings, then Authorized domains, and add '+site+'.';
    if(code==='auth/operation-not-allowed'||code==='auth/admin-restricted-operation')return 'Email and password sign-in is turned off. In Firebase Authentication, open Sign-in method and enable Email/Password.';
    if(code==='auth/email-already-in-use')return 'That email already has a login.';
    if(code==='auth/invalid-email')return 'Enter a valid email address.';
    if(code==='auth/weak-password'||code==='auth/password-does-not-meet-requirements')return 'Use a password of at least 6 characters.';
    if(code==='auth/wrong-password'||code==='auth/invalid-credential'||code==='auth/user-not-found'||code==='auth/invalid-login-credentials')return 'That email or password was not accepted.';
    if(code==='auth/too-many-requests')return 'Too many attempts. Wait a moment and try again.';
    if(code==='auth/network-request-failed')return 'The network could not reach Firebase. Nothing was changed.';
    if(code==='auth/popup-closed-by-user')return 'Sign-in was cancelled.';
    return 'That did not finish. Nothing on this phone was cleared.';
  }
  function setupSteps(uid,host){
    const id=uid||'(the uid shown after Sync sign-in)';
    const site=host||'adamcw68.github.io';
    return [
      'Firebase project: ccsa-smoke-log. These steps are done in the Firebase console. This app does not change the live project by itself.',
      '1. Build > Firestore Database. Create the database if it does not exist. The portal uses Firestore only. Storage is not used.',
      '2. Authentication > Sign-in method. Enable Email/Password. Agency logins use email and a password. Google stays the technician Sync sign-in.',
      '3. Authentication > Settings > Authorized domains. Add '+site+'. It is not there yet. Add localhost too if you preview the portal on this computer. Without that domain, agency sign-in is blocked.',
      '4. Firestore > Data. Start a collection named admins. The document ID is your Sync uid: '+id+'. Add field email (string) set to your sign-in email, and field since (string) set to today. The console can write this first document. The rules do not let the app create it.',
      '5. From this project folder, deploy the rules and nothing else: npx firebase deploy --only firestore:rules --project ccsa-smoke-log',
      '6. Sign in to Sync in this app, create an agency login, and publish. Publishing copies addresses, dates, alarm results and certificates. It does not copy tenant names, phone numbers or email addresses, and it does not write to Google Calendar.'
    ].join('\n');
  }
  function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function eyeIcon(shown){
    const slash=shown?'<path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2"/>':'';
    return '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>'+slash+'</svg>';
  }
  /* A password field stays type=password until the eye is tapped. The button is type=button so Enter still submits the form. */
  function passwordField(opts){
    opts=opts||{};
    const id=escHtml(opts.id||'password');
    const auto=escHtml(opts.autocomplete||'current-password');
    let html='<div class="pw"><input class="t" id="'+id+'" type="password" autocomplete="'+auto+'"';
    if(opts.name)html+=' name="'+escHtml(opts.name)+'"';
    if(opts.required)html+=' required';
    if(opts.value!=null)html+=' value="'+escHtml(opts.value)+'"';
    html+='>'+'<button type="button" class="pweye" aria-label="Show password" aria-pressed="false">'+eyeIcon(false)+'</button></div>';
    return html;
  }
  function bindPasswordEyes(root){
    const el=root&&root.addEventListener?root:(typeof document!=='undefined'?document:null);
    if(!el||el.__pweyes)return;
    el.__pweyes=true;
    el.addEventListener('click',function(e){
      const b=e.target&&e.target.closest?e.target.closest('.pweye'):null;
      if(!b||!el.contains(b))return;
      const input=b.parentNode&&b.parentNode.querySelector('input');
      if(!input)return;
      const show=input.type==='password';
      const val=input.value;
      input.type=show?'text':'password';
      if(input.value!==val)input.value=val;
      b.setAttribute('aria-label',show?'Hide password':'Show password');
      b.setAttribute('aria-pressed',show?'true':'false');
      b.innerHTML=eyeIcon(show);
    });
  }
  function visibleAgency(portal,agencyId){
    const bucket=portal&&portal.agencies&&portal.agencies[agencyId];
    if(!bucket)return {id:agencyId||'',jobs:[],certificates:[],properties:[]};
    return {id:bucket.id,code:bucket.code,name:bucket.name,jobs:bucket.jobs,certificates:bucket.certificates,properties:bucket.properties};
  }

  return {
    DUE_SOON_DAYS:DUE_SOON_DAYS,
    PROPERTY_KEYS:PROPERTY_KEYS,
    JOB_KEYS:JOB_KEYS,
    CERT_KEYS:CERT_KEYS,
    ALARM_KEYS:ALARM_KEYS,
    COMPLIANCE:COMPLIANCE,
    STATUSES:STATUSES,
    RESULTS:RESULTS,
    SAMPLE_TENANT:SAMPLE_TENANT,
    agencies:agencies,
    agencyFromCode:agencyFromCode,
    complianceStatus:complianceStatus,
    complianceLabel:complianceLabel,
    resultLabel:resultLabel,
    statusLabel:statusLabel,
    prettyDate:prettyDate,
    prettyTime:prettyTime,
    sydneyToday:sydneyToday,
    alarmResult:alarmResult,
    serviceResult:serviceResult,
    expiryOf:expiryOf,
    buildPortal:buildPortal,
    rollup:rollup,
    planWrites:planWrites,
    counts:counts,
    tenantHits:tenantHits,
    bundleClean:bundleClean,
    sameKeys:sameKeys,
    demoInput:demoInput,
    demoPortal:demoPortal,
    demoView:demoView,
    visibleAgency:visibleAgency,
    authError:authError,
    setupSteps:setupSteps,
    statementFor:statementFor,
    passwordField:passwordField,
    bindPasswordEyes:bindPasswordEyes
  };
});
