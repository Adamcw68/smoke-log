/* Agency job requests.
   The request the agency can read has the address and the status.
   The access name and phone are a separate record for Adam, and they are
   removed when the request is completed. Nothing here writes to Google Calendar. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSARequests=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const REQUEST_KEYS=['id','agencyId','agencyCode','propertyId','address','ident','tenancy','timeframe','notes','status','createdAt','fileName','fileType','fileData'];
  const ACCESS_KEYS=['id','agencyId','requestId','contactName','contactPhone','createdAt'];
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
    const digits=s.replace(/\D/g,'');
    if(digits.length===10&&digits.charAt(0)==='0')return s;
    if(digits.length===11&&digits.slice(0,2)==='61')return '0'+digits.slice(2);
    return '';
  }
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
    const address=plain(input.address,200);
    if(!address)return {ok:false,error:'Enter the property address. Do not put a phone number in the address.'};
    const tenancy=tenancyOf(input.tenancy);
    if(!tenancy)return {ok:false,error:'Choose Permanent or Holiday.'};
    const contactName=plain(input.contactName,80);
    if(!contactName)return {ok:false,error:'Enter the contact name for access. Do not put a phone number in the name.'};
    const contactPhone=phoneOf(input.contactPhone);
    if(!contactPhone)return {ok:false,error:'Enter a phone number for access, such as 0412 000 000.'};
    const timeframe=plain(input.timeframe,80);
    const notes=plain(input.notes,400);
    if(clean(input.notes)&&!notes)return {ok:false,error:'Keep phone numbers and email addresses out of the notes. Use the access phone field.'};
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
      fileData:file.fileData
    };
    const access={
      id:id,
      agencyId:request.agencyId,
      requestId:id,
      contactName:contactName,
      contactPhone:contactPhone,
      createdAt:request.createdAt
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
    const want=['address','tenancy','contact name','contact phone','timeframe','notes'];
    for(let i=0;i<want.length;i++){
      if(header.indexOf(want[i])<0)return {ok:false,error:'The header must include: '+want.join(', ')+'.'};
    }
    const rows=[];
    for(let r=1;r<lines.length;r++){
      const cells=splitCsvLine(lines[r]);
      const row={};
      header.forEach(function(name,i){row[name]=cells[i]||''});
      rows.push({
        address:row.address,
        tenancy:row.tenancy,
        contactName:row['contact name'],
        contactPhone:row['contact phone'],
        timeframe:row.timeframe,
        notes:row.notes,
        line:r+1
      });
    }
    return {ok:true,rows:rows};
  }
  function csvTemplate(){
    return 'address,tenancy,contact name,contact phone,timeframe,notes\n"18 Example Street, Maclean NSW 2463",Permanent,Alex Owner,0412000111,Next fortnight,Two alarms\n';
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
      notes:[request.timeframe,request.notes].filter(Boolean).join(' · '),
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
    publicRequest:publicRequest,
    localJob:localJob,
    applyStatus:applyStatus,
    demoPublic:demoPublic,
    demoAccess:demoAccess,
    phoneOf:phoneOf
  };
});
