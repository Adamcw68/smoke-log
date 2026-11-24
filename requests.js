/* Agency job requests.
   The request the agency can read has the address and the status.
   The access name and phone are a separate record for Adam, and they are
   removed when the request is completed. Nothing here writes to Google Calendar. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSARequests=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const REQUEST_KEYS=['id','agencyId','agencyCode','propertyId','address','ident','tenancy','timeframe','notes','status','createdAt','fileName','fileType','fileData','vacant','preferredDate'];
  const ACCESS_KEYS=['id','agencyId','requestId','contactName','contactPhone','createdAt','tenancy','tenantEmail','accessNotes','accessSms'];
  const STATUSES=['new','accepted','scheduled','completed','declined'];
  const FILE_TYPES=['','application/pdf','image/jpeg','image/png'];
  const MAX_FILE=450000;
  const MAX_ROWS=40;
  const NEXT={
    new:['accepted','scheduled','declined'],
    accepted:['scheduled','completed','declined'],
    scheduled:['completed','declined'],
    completed:[],
    declined:[]
  };

  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function slug(v){
    return clean(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  }
  function looksPrivate(s){
    const text=String(s||'');
    if(/@/.test(text))return true;
    if(/(?:\+?61|0)[ \-]*[2-478](?:[ \-]*\d){8}\b/.test(text))return true;
    if(/\d{8,}/.test(text))return true;
    return false;
  }
  function plain(v,max){
    const s=clean(v);
    if(s.length>=max)return '';
    if(looksPrivate(s))return '';
    return s;
  }
  function phoneOf(v){
    const s=clean(v);
    if(!s)return '';
    let digits=s.replace(/\D/g,'');
    if(digits.length===11&&digits.slice(0,2)==='61')digits='0'+digits.slice(2);
    else if(digits.length===9&&digits.charAt(0)==='4')digits='0'+digits;
    if(!(digits.length===10&&digits.charAt(0)==='0'))return '';
    if(/^04\d{8}$/.test(digits))return digits.slice(0,4)+' '+digits.slice(4,7)+' '+digits.slice(7);
    if(/^0[2378]\d{8}$/.test(digits))return digits.slice(0,2)+' '+digits.slice(2,6)+' '+digits.slice(6);
    return '';
  }
  function emailOf(v){
    const s=clean(v);
    if(!s)return '';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)||s.length>=80)return null;
    return s;
  }
  function vacantOf(v){
    const k=clean(v).toLowerCase();
    if(!k)return 'no';
    if(k==='yes'||k==='y'||k==='vacant'||k==='changeover'||k==='change over'||k==='change-over')return 'yes';
    if(k==='no'||k==='n')return 'no';
    return null;
  }
  function dateOf(v){
    const s=clean(v);
    if(!s)return '';
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return s;
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!m)return null;
    const day=m[1].padStart(2,'0'),month=m[2].padStart(2,'0'),year=m[3];
    const dt=new Date(Date.UTC(+year,+month-1,+day));
    if(dt.getUTCFullYear()!==+year||dt.getUTCMonth()!==+month-1||dt.getUTCDate()!==+day)return null;
    return year+'-'+month+'-'+day;
  }
  function accessSmsFor(tenancy){return tenancy!=='Holiday'}
  function tenancyOf(v){
    const k=clean(v).toLowerCase();
    if(k==='perm'||k==='permanent')return 'Permanent';
    if(k==='hol'||k==='holiday')return 'Holiday';
    return '';
  }
  function statusLabel(v){
    if(v==='new')return 'New';
    if(v==='accepted')return 'Accepted';
    if(v==='scheduled')return 'Scheduled';
    if(v==='completed')return 'Completed';
    if(v==='declined')return 'Declined';
    return '';
  }
  function canMove(from,to){
    return !!(NEXT[from]&&NEXT[from].indexOf(to)>=0);
  }
  function fileOf(input){
    input=input||{};
    const name=plain(input.fileName,80);
    const type=FILE_TYPES.indexOf(input.fileType)>=0?input.fileType:'';
    const data=typeof input.fileData==='string'?input.fileData:'';
    if(!name&&!data)return {ok:true,fileName:'',fileType:'',fileData:''};
    if(!type)return {ok:false,error:'Attach a PDF, JPEG or PNG, or leave the file off.'};
    if(!/^[A-Za-z0-9+/=]+$/.test(data))return {ok:false,error:'That file could not be read. Nothing was sent.'};
    const bytes=Math.floor(data.length*3/4);
    if(bytes>MAX_FILE||data.length>=620000)return {ok:false,error:'That file is over 450 KB. Choose a smaller PDF or photo. Nothing was sent.'};
    return {ok:true,fileName:name||'attachment',fileType:type,fileData:data};
  }
  function buildOne(agency,input,now){
    input=input||{};
    agency=agency||{};
    const address=plain(input.address||input.propertyAddress,200);
    if(!address)return {ok:false,error:'Enter the property address. Do not put a phone number in the address.'};
    const tenancy=tenancyOf(input.tenancy);
    if(!tenancy)return {ok:false,error:'Choose Permanent or Holiday.'};
    const vacant=vacantOf(input.vacant);
    if(vacant==null)return {ok:false,error:'Vacant / changeover must be yes or no.'};
    const contactName=plain(input.contactName||input.tenantName,80)||(vacant==='yes'?'Vacant':'');
    if(!contactName)return {ok:false,error:'Enter the tenant name. Do not put a phone number in the name.'};
    const contactPhone=phoneOf(input.contactPhone||input.tenantPhone);
    if(!contactPhone)return {ok:false,error:'Enter the tenant phone as 0### ### ###, such as 0412 000 111.'};
    const tenantEmail=emailOf(input.tenantEmail);
    if(tenantEmail==null)return {ok:false,error:'The tenant email is not a valid email address.'};
    const accessNotes=plain(input.accessNotes,200);
    if(clean(input.accessNotes)&&!accessNotes)return {ok:false,error:'Keep phone numbers and email addresses out of the keys / access notes.'};
    const preferredDate=dateOf(input.preferredDate);
    if(preferredDate==null)return {ok:false,error:'Preferred date must be DD/MM/YYYY or YYYY-MM-DD.'};
    const timeframe=plain(input.timeframe,80)||preferredDate;
    const notes=plain(input.notes,400);
    if(clean(input.notes)&&!notes)return {ok:false,error:'Keep phone numbers and email addresses out of the notes. Use the tenant phone and email fields.'};
    if(clean(input.timeframe)&&!timeframe)return {ok:false,error:'The timeframe cannot contain a phone number or email address.'};
    const file=fileOf(input);
    if(!file.ok)return file;
    const createdAt=clean(now)||new Date().toISOString();
    const propertyId=slug(address)||'property';
    const id=slug('req-'+propertyId+'-'+createdAt.replace(/[^0-9]/g,'').slice(0,14))||('req-'+propertyId);
    const request={
      id:id,
      agencyId:agency.id||'',
      agencyCode:agency.code||agency.name||'',
      propertyId:propertyId,
      address:address,
      ident:plain(input.ident,80),
      tenancy:tenancy,
      timeframe:timeframe,
      notes:notes,
      status:'new',
      createdAt:createdAt.slice(0,30),
      fileName:file.fileName,
      fileType:file.fileType,
      fileData:file.fileData,
      vacant:vacant,
      preferredDate:preferredDate
    };
    const access={
      id:id,
      agencyId:request.agencyId,
      requestId:id,
      contactName:contactName,
      contactPhone:contactPhone,
      createdAt:request.createdAt,
      tenancy:tenancy,
      tenantEmail:tenantEmail,
      accessNotes:accessNotes,
      accessSms:tenancy==='Holiday'?false:accessSmsFor(tenancy)
    };
    return {ok:true,request:request,access:access};
  }
  function publicRequest(request){
    const out={};
    REQUEST_KEYS.forEach(function(key){out[key]=request&&request[key]!=null?request[key]:''});
    delete out.contactName;
    delete out.contactPhone;
    delete out.contact;
    return out;
  }
  function splitCsvLine(line){
    const out=[];
    let cur='';
    let quote=false;
    for(let i=0;i<line.length;i++){
      const ch=line.charAt(i);
      if(quote){
        if(ch==='"'&&line.charAt(i+1)==='"'){cur+='"';i++}
        else if(ch==='"')quote=false;
        else cur+=ch;
      }else if(ch==='"')quote=true;
      else if(ch===','){out.push(cur);cur=''}
      else cur+=ch;
    }
    out.push(cur);
    return out.map(function(cell){return cell.trim()});
  }
  function parseCsv(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(function(line){return clean(line)});
    if(lines.length<2)return {ok:false,error:'The CSV needs a header and at least one property.'};
    if(lines.length-1>MAX_ROWS)return {ok:false,error:'Upload at most '+MAX_ROWS+' properties at a time.'};
    const header=splitCsvLine(lines[0]).map(function(cell){return cell.toLowerCase()});
    const alias={
      'address':'address','property address':'address',
      'tenancy':'tenancy','perm or holiday':'tenancy',
      'contact name':'contactName','tenant name':'contactName',
      'contact phone':'contactPhone','tenant phone':'contactPhone',
      'timeframe':'timeframe','preferred date':'preferredDate','preferred date or due date':'preferredDate','due date':'preferredDate',
      'notes':'notes',
      'tenant email':'tenantEmail',
      'keys/access notes':'accessNotes','keys':'accessNotes','access notes':'accessNotes',
      'vacant/changeover':'vacant','vacant/changeover flag':'vacant','vacant':'vacant','changeover':'vacant'
    };
    const hasAddress=header.indexOf('address')>=0||header.indexOf('property address')>=0;
    const hasTenancy=header.indexOf('tenancy')>=0||header.indexOf('perm or holiday')>=0;
    if(!hasAddress||!hasTenancy)return {ok:false,error:'The header must include property address and Perm or Holiday.'};
    const rows=[];
    for(let r=1;r<lines.length;r++){
      const cells=splitCsvLine(lines[r]);
      const row={line:r+1};
      header.forEach(function(name,i){
        const key=alias[name];
        if(key)row[key]=cells[i]||'';
      });
      rows.push(row);
    }
    return {ok:true,rows:rows};
  }
  function csvTemplate(){
    return 'address,tenancy,contact name,contact phone,timeframe,notes\n"18 Example Street, Maclean NSW 2463",Permanent,Alex Owner,0412000111,Next fortnight,Two alarms\n';
  }
  function submissionTemplate(){
    return 'property address,Perm or Holiday,tenant name,tenant phone,tenant email,keys/access notes,vacant/changeover flag,preferred date,notes\n"18 Example Street, Maclean NSW 2463",Perm,Alex Tenant,0412 000 111,alex@example.com,Key safe 1234,no,24/12/2026,Two alarms\n"4 Holiday Street, Yamba NSW 2464",Holiday,Office,0412 000 222,,Changeover clean,yes,01/01/2027,No access SMS\n';
  }
  function previewRows(agency,rows,now){
    return (rows||[]).map(function(row,i){
      const stamp=clean(now)||new Date().toISOString();
      const when=stamp.replace(/\.\d+Z$/,'Z').replace(/Z$/,'.'+String(i).padStart(3,'0')+'Z');
      const one=buildOne(agency,row,when);
      return {line:row.line||i+2,ok:!!one.ok,error:one.ok?'':one.error,item:one.ok?one:null,address:clean(row.address||''),tenancy:clean(row.tenancy||'')};
    });
  }
  function queueLimit(n){
    return +n===3?3:4;
  }
  function agentQueue(requests,limit){
    const cap=queueLimit(limit);
    const open=(requests||[]).filter(function(row){return row&&(row.status==='new'||row.status==='accepted')});
    const groups={};
    open.forEach(function(row){
      const id=row.agencyId||'';
      if(!groups[id])groups[id]=[];
      groups[id].push(row);
    });
    const visible=[];
    const queued={};
    Object.keys(groups).sort().forEach(function(id){
      const rows=groups[id].slice().sort(function(a,b){return (a.createdAt||'')<(b.createdAt||'')?-1:(a.createdAt||'')>(b.createdAt||'')?1:0});
      rows.slice(0,cap).forEach(function(row){visible.push(row)});
      queued[id]=Math.max(0,rows.length-cap);
    });
    return {limit:cap,visible:visible,queued:queued};
  }
  function buildMany(agency,rows,now){
    const built=[];
    const errors=[];
    (rows||[]).forEach(function(row,i){
      const stamp=clean(now)||new Date().toISOString();
      const when=stamp.replace(/\.\d+Z$/,'Z').replace(/Z$/,'.'+String(i).padStart(3,'0')+'Z');
      const one=buildOne(agency,row,when);
      if(!one.ok)errors.push('Row '+(row.line||i+1)+': '+one.error);
      else built.push(one);
    });
    if(errors.length)return {ok:false,error:errors[0],errors:errors};
    return {ok:true,items:built};
  }
  function localJob(request,access){
    request=request||{};
    access=access||{};
    return {
      id:request.id||slug(request.address),
      row:9000,
      section:request.tenancy||'',
      agent:request.agencyCode||'',
      tech:'',
      last:'',
      due:'',
      ident:request.ident||'',
      street:String(request.address||'').split(',')[0],
      town:'',
      addr:request.address||'',
      directions:'',
      contact:access.contactName||'',
      p1:access.contactPhone||'',
      p2:'',
      ptype:'',
      beds:null,
      alarms:1,
      ladder:'',
      exp:[],
      ic:'',
      notes:[request.timeframe,request.vacant==='yes'?'Vacant / changeover':'',access.tenancy==='Holiday'||access.accessSms===false?'No access SMS':'',request.notes].filter(Boolean).join(' · '),
      directions:access.accessNotes||'',
      extra:[],
      svc:'',
      order:null,
      arch:null,
      src:'Portal request'
    };
  }
  function applyStatus(request,access,status){
    if(!canMove(request&&request.status,status))return {ok:false,error:'That status change is not available.'};
    const next=publicRequest(Object.assign({},request,{status:status}));
    const kept=status==='completed'?null:access||null;
    return {ok:true,request:next,access:kept};
  }
  function demoPublic(agencyId){
    const agency={id:agencyId||'rwm',code:'Ray White Maclean/Yamba',name:'Ray White Maclean/Yamba'};
    const first=buildOne(agency,{address:'12 Request Lane, Maclean NSW 2463',tenancy:'Permanent',contactName:'Sam Resident',contactPhone:'0412 555 019',timeframe:'Next fortnight',notes:'Please book a service'},'2026-11-14T01:00:00.000Z');
    const second=buildOne(agency,{address:'4 Booked Street, Maclean NSW 2463',tenancy:'Holiday',contactName:'Sam Resident',contactPhone:'0412 555 019',timeframe:'This month',notes:'Already accepted'},'2026-11-10T01:00:00.000Z');
    if(!first.ok||!second.ok)return [];
    second.request.status='accepted';
    return [publicRequest(first.request),publicRequest(second.request)];
  }
  function demoAccess(agencyId){
    const agency={id:agencyId||'rwm',code:'Ray White Maclean/Yamba'};
    const first=buildOne(agency,{address:'12 Request Lane, Maclean NSW 2463',tenancy:'Permanent',contactName:'Sam Resident',contactPhone:'0412 555 019',timeframe:'Next fortnight',notes:'Please book a service'},'2026-11-14T01:00:00.000Z');
    const second=buildOne(agency,{address:'4 Booked Street, Maclean NSW 2463',tenancy:'Holiday',contactName:'Sam Resident',contactPhone:'0412 555 019',timeframe:'This month',notes:'Already accepted'},'2026-11-10T01:00:00.000Z');
    const map={};
    if(first.ok)map[first.access.id]=first.access;
    if(second.ok)map[second.access.id]=second.access;
    return map;
  }

  return {
    REQUEST_KEYS:REQUEST_KEYS,
    ACCESS_KEYS:ACCESS_KEYS,
    STATUSES:STATUSES,
    MAX_FILE:MAX_FILE,
    MAX_ROWS:MAX_ROWS,
    statusLabel:statusLabel,
    canMove:canMove,
    buildOne:buildOne,
    buildMany:buildMany,
    parseCsv:parseCsv,
    csvTemplate:csvTemplate,
    submissionTemplate:submissionTemplate,
    previewRows:previewRows,
    queueLimit:queueLimit,
    agentQueue:agentQueue,
    accessSmsFor:accessSmsFor,
    publicRequest:publicRequest,
    localJob:localJob,
    applyStatus:applyStatus,
    demoPublic:demoPublic,
    demoAccess:demoAccess,
    phoneOf:phoneOf
  };
});
