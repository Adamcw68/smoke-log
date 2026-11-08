/* PDF library for one service day.
   A worksheet PDF is listed only when its bytes were saved on this phone.
   This file does not build, email, or upload a PDF. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSAPdf=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_TECH='Adam Westerman';
  const HELP='Saved PDFs stay on this phone after you tap Make PDF. The day is the date of service on the worksheet, or the appointment day in Sydney time when there is no worksheet. Share day opens the share sheet: you choose who receives the files and tap Send. This app does not email or upload them. A job is left out when its PDF was never saved, the worksheet changed after saving, or cleaning is not recorded.';
  function pad2(n){return String(n).padStart(2,'0')}
  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function plain(s){return String(s??'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,'?')}
  function isYMD(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s||''))}
  function sydneyParts(ms){
    const fmt=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(function(x){return [x.type,x.value]}));
    if(p.hour==='24')p.hour='00';
    return p;
  }
  function sydneyDayFromMs(ms){
    if(ms==null||isNaN(ms))return '';
    const p=sydneyParts(ms);
    return p.year+'-'+p.month+'-'+p.day;
  }
  function sydneyToday(now){
    const ms=now==null?Date.now():(now instanceof Date?now.getTime():+now);
    return sydneyDayFromMs(ms);
  }
  /* A date-only value is that service day. An instant is the Sydney calendar day. */
  function sydneyDay(value){
    if(value==null||value==='')return '';
    if(typeof value==='number')return sydneyDayFromMs(value);
    const s=String(value).trim();
    if(isYMD(s))return s;
    if(/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10))&&!/[T ]\d{2}:\d{2}/.test(s))return s.slice(0,10);
    const t=Date.parse(s);
    if(isNaN(t))return isYMD(s.slice(0,10))?s.slice(0,10):'';
    return sydneyDayFromMs(t);
  }
  function sydneyClock(value){
    const t=typeof value==='number'?value:Date.parse(value);
    if(isNaN(t))return '';
    const p=sydneyParts(t);
    return p.hour+':'+p.minute;
  }
  function addDays(ymd,n){
    const m=String(ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '';
    const dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+(+n||0)));
    return dt.getUTCFullYear()+'-'+pad2(dt.getUTCMonth()+1)+'-'+pad2(dt.getUTCDate());
  }
  function fmtDay(ymd){
    const m=String(ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '';
    const dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
    return new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(dt);
  }
  function fileBase(street,addr,date){
    const day=String(date||'').slice(0,10);
    const d=isYMD(day)?day:'undated';
    const short=String(street||addr||'job').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return d+'_'+(short||'job');
  }
  /* Walk the job list in its current order. The name is the service date plus the street, with no time. */
  function pdfFileName(jobs,job,date,dateOf){
    dateOf=dateOf||function(){return ''};
    const b=fileBase(job&&(job.street||job.addr),job&&job.addr,date);
    let n=0;
    const list=jobs||[];
    for(let i=0;i<list.length;i++){
      const x=list[i];
      const d=x&&job&&x.id===job.id?date:dateOf(x);
      if(fileBase(x&&(x.street||x.addr),x&&x.addr,d)===b)n++;
      if(x&&job&&x.id===job.id)break;
    }
    return b+(n>1?'-'+n:'')+'.pdf';
  }
  function alarmStamp(a){
    a=a||{};
    const yn=a.yn||{};
    return {
      isNew:!!a.isNew,newAns:a.newAns||'',mount:a.mount||'',room:a.room||'',bedno:clean(a.bedno),other:clean(a.other),adjacent:clean(a.adjacent),
      power:(a.power||[]).slice(),sensor:(a.sensor||[]).slice(),
      manufacturer:clean(a.manufacturer),model:clean(a.model),db:clean(a.db),expiry:clean(a.expiry),
      yn:{comply:yn.comply||'',battery:yn.battery||'',located:yn.located||'',button:yn.button||'',affixed:yn.affixed||'',cleaned:yn.cleaned||''},
      photos:(a.photos||[]).slice()
    };
  }
  function photoCount(form){
    if(!form)return 0;
    const n=form.alarms||0;
    let c=(form.photos||[]).length;
    for(let i=0;i<n;i++)c+=(((form.al||[])[i]||{}).photos||[]).length;
    return c;
  }
  function asPhotosOnPdf(form){
    if(!form)return false;
    return form.asPhotosSet?!!form.asPhotos:(!!form.asPhotos||photoCount(form)>0);
  }
  function worksheetStamp(form){
    if(!form)return '';
    const n=form.alarms||0;
    return JSON.stringify({
      date:isYMD(String(form.date||'').slice(0,10))?String(form.date).slice(0,10):'',
      ident:clean(form.ident),agent:(typeof SheetFill!=='undefined'&&SheetFill.print)?SheetFill.print(form.agent):clean(form.agent),addr:clean(form.addr),
      marks:'smoke-strike-yn,insect-strike-yn',
      tech:clean(form.tech)||DEFAULT_TECH,
      ptype:form.ptype||'',ptypeOther:clean(form.ptypeOther),levels:form.levels||'',beds:form.beds||'',
      alarms:n,ladder:form.ladder||'',asPrev:!!form.asPrev,asPhotos:asPhotosOnPdf(form),
      comments:form.comments||'',photos:(form.photos||[]).slice(),
      al:(form.al||[]).slice(0,n).map(alarmStamp)
    });
  }
  function cleaningMissing(form){
    if(!form)return [];
    const n=form.alarms||0,out=[];
    for(let i=0;i<n;i++){
      const a=(form.al||[])[i]||{};
      if(a.isNew)continue;
      if(!(a.yn&&a.yn.cleaned))out.push(i);
    }
    return out;
  }
  /* Worksheet date wins. Otherwise the appointment's Sydney day. Never invents a form. */
  function serviceDay(job,form){
    const d=form&&form.date?String(form.date).slice(0,10):'';
    if(isYMD(d))return d;
    if(job&&job.svc)return sydneyDay(job.svc);
    return '';
  }
  function sortValue(job){
    let time='1|~';
    if(job&&job.svc){
      const t=Date.parse(job.svc);
      if(!isNaN(t))time='0|'+String(t).padStart(16,'0');
    }
    const order=job&&job.order!=null?String(job.order).padStart(6,'0'):'~';
    const addr=String((job&&(job.addr||job.street))||'').toLowerCase().replace(/\|/g,'/');
    const id=String((job&&job.id)||'');
    return time+'|'+order+'|'+addr+'|'+id;
  }
  function hasBytes(record){
    return !!(record&&record.bytes&&record.bytes.byteLength);
  }
  const LABEL={ready:'Saved PDF',stale:'Worksheet changed',missing:'PDF not saved',incomplete:'Cleaning not recorded',noworksheet:'No worksheet'};
  function statusOf(job,form,record){
    const miss=cleaningMissing(form);
    const saved=hasBytes(record);
    if(!form&&!saved)return {status:'noworksheet',label:LABEL.noworksheet,reason:'No worksheet and no PDF saved on this phone.',include:false,stale:false,missingClean:[]};
    if(saved&&!form){
      if(!job)return {status:'ready',label:LABEL.ready,reason:'Saved PDF kept on this phone. The job is no longer on the list.',include:true,stale:false,missingClean:[]};
      return {status:'stale',label:LABEL.stale,reason:'The worksheet is not on this phone. This saved PDF was not rebuilt.',include:false,stale:true,missingClean:[]};
    }
    if(saved){
      const stamp=worksheetStamp(form);
      if(!record.stamp||record.stamp!==stamp)return {status:'stale',label:LABEL.stale,reason:'The worksheet changed after this PDF was saved. It was not rebuilt.',include:false,stale:true,missingClean:miss};
      if(miss.length)return {status:'incomplete',label:LABEL.incomplete,reason:'Cleaning is not recorded. This saved PDF is left out of the day group.',include:false,stale:false,missingClean:miss};
      return {status:'ready',label:LABEL.ready,reason:'Saved on this phone and matches the worksheet.',include:true,stale:false,missingClean:[]};
    }
    if(miss.length)return {status:'incomplete',label:LABEL.incomplete,reason:'Cleaning is not recorded, so no PDF was made.',include:false,stale:false,missingClean:miss};
    return {status:'missing',label:LABEL.missing,reason:'Worksheet is on this phone. The PDF has not been saved, so it was not generated.',include:false,stale:false,missingClean:[]};
  }
  function rowFor(job,form,record){
    const st=statusOf(job,form,record);
    const name=(record&&record.name)||'';
    return {
      id:job&&job.id?String(job.id):(record&&record.id?String(record.id):''),
      addr:(form&&form.addr)||(job&&job.addr)||(record&&record.addr)||'',
      street:(job&&job.street)||(record&&record.street)||'',
      when:job&&job.svc?sydneyClock(job.svc):'',
      name:name,
      status:st.status,
      label:st.label,
      reason:st.reason,
      include:!!st.include,
      saved:hasBytes(record),
      stale:!!st.stale,
      missingClean:st.missingClean.slice(),
      sort:job?sortValue(job):'z|'+(name||'')+'|'+(record&&record.id||''),
      record:record||null
    };
  }
  function dayPlan(jobs,forms,records,day){
    const want=isYMD(day)?day:'';
    const recs=new Map();
    (records||[]).forEach(function(r){if(r&&r.id)recs.set(String(r.id),r)});
    const used=new Set();
    const rows=[];
    (jobs||[]).forEach(function(job){
      if(!job||job.id==null)return;
      const form=forms&&Object.prototype.hasOwnProperty.call(forms,job.id)?forms[job.id]:null;
      if(serviceDay(job,form)!==want)return;
      used.add(String(job.id));
      rows.push(rowFor(job,form,recs.get(String(job.id))||null));
    });
    (records||[]).forEach(function(record){
      if(!record||!record.id||used.has(String(record.id)))return;
      if((record.day||'')!==want)return;
      const job=(jobs||[]).find(function(j){return j&&String(j.id)===String(record.id)})||null;
      if(job)return;
      rows.push(rowFor(null,null,record));
    });
    rows.sort(function(a,b){return a.sort<b.sort?-1:a.sort>b.sort?1:0});
    const included=rows.filter(function(r){return r.include});
    const excluded=rows.filter(function(r){return !r.include});
    return {day:want,rows:rows,included:included,excluded:excluded};
  }
  function summarise(plan){
    const rows=(plan&&plan.rows)||[];
    const count=function(s){return rows.filter(function(r){return r.status===s}).length};
    return {included:(plan&&plan.included||[]).length,excluded:(plan&&plan.excluded||[]).length,ready:count('ready'),stale:count('stale'),missing:count('missing'),incomplete:count('incomplete'),noworksheet:count('noworksheet')};
  }
  function contentsLines(plan){
    plan=plan||{day:'',included:[],excluded:[]};
    const lines=['CCSA worksheets '+plan.day,'This page is a list only. It is not a worksheet.','','Included in this pack:'];
    if(!(plan.included||[]).length)lines.push('(none)');
    (plan.included||[]).forEach(function(r,i){lines.push((i+1)+'. '+plain(r.name||r.addr||r.id))});
    lines.push('','Left out:');
    if(!(plan.excluded||[]).length)lines.push('(none)');
    (plan.excluded||[]).forEach(function(r){lines.push('- '+plain(r.addr||r.name||r.id)+' - '+plain(r.label)+'. '+plain(r.reason))});
    lines.push('','Nothing in this pack was emailed or uploaded by the app.');
    return lines;
  }
  function dayNotes(plan){return contentsLines(plan).join('\n')}
  function uniqueFileNames(names){
    const used=new Set();
    return (names||[]).map(function(name){
      let n=String(name||'worksheet.pdf');
      if(!used.has(n)){used.add(n);return n}
      const base=n.replace(/\.pdf$/i,'');
      let i=2;
      while(used.has(base+'-'+i+'.pdf'))i++;
      n=base+'-'+i+'.pdf';
      used.add(n);
      return n;
    });
  }
  function zipName(name){
    const n=String(name||'file.pdf').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
    return n||'file.pdf';
  }
  const CRC=(function(){
    const t=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
      t[n]=c>>>0;
    }
    return t;
  })();
  function crc32(bytes){
    let c=0xffffffff;
    for(let i=0;i<bytes.length;i++)c=CRC[(c^bytes[i])&0xff]^(c>>>8);
    return (c^0xffffffff)>>>0;
  }
  function u16(n){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b}
  function u32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,true);return b}
  function concat(list){
    let n=0;
    for(let i=0;i<list.length;i++)n+=list[i].length;
    const o=new Uint8Array(n);
    let p=0;
    for(let i=0;i<list.length;i++){o.set(list[i],p);p+=list[i].length}
    return o;
  }
  /* Stored ZIP, no compression, so the PDF bytes inside are the saved bytes. */
  function zipStore(entries){
    const files=(entries||[]).map(function(e){
      const name=new TextEncoder().encode(zipName(e.name));
      const data=e.data instanceof Uint8Array?e.data:new Uint8Array(e.data||new ArrayBuffer(0));
      return {name:name,data:data,crc:crc32(data)};
    });
    const parts=[],central=[];
    let offset=0;
    files.forEach(function(f){
      const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(f.crc),u32(f.data.length),u32(f.data.length),u16(f.name.length),u16(0),f.name,f.data]);
      parts.push(local);
      central.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(f.crc),u32(f.data.length),u32(f.data.length),u16(f.name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),f.name]));
      offset+=local.length;
    });
    const cd=concat(central);
    const end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(offset),u16(0)]);
    return concat(parts.concat([cd,end]));
  }
  function unzipStore(bytes){
    const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||new ArrayBuffer(0));
    const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
    const out=[];
    let p=0;
    while(p+4<=b.length){
      const sig=v.getUint32(p,true);
      if(sig!==0x04034b50)break;
      const method=v.getUint16(p+8,true);
      const crc=v.getUint32(p+14,true);
      const comp=v.getUint32(p+18,true);
      const uncomp=v.getUint32(p+22,true);
      const nlen=v.getUint16(p+26,true);
      const elen=v.getUint16(p+28,true);
      const name=new TextDecoder().decode(b.subarray(p+30,p+30+nlen));
      const start=p+30+nlen+elen;
      const data=b.slice(start,start+comp);
      if(method!==0)throw new Error('Only stored ZIP files can be read here');
      if(data.length!==uncomp)throw new Error('ZIP size mismatch for '+name);
      if(crc32(data)!==crc)throw new Error('ZIP check failed for '+name);
      out.push({name:name,data:data});
      p=start+comp;
    }
    return out;
  }
  function packFiles(plan){
    const rows=(plan&&plan.included)||[];
    const names=uniqueFileNames(rows.map(function(r){return r.name||'worksheet.pdf'}));
    const pdfs=[];
    const notes=new TextEncoder().encode(dayNotes(plan));
    for(let i=0;i<rows.length;i++){
      const rec=rows[i].record;
      if(!rec||!hasBytes(rec))continue;
      const data=rec.bytes instanceof Uint8Array?rec.bytes:new Uint8Array(rec.bytes);
      pdfs.push({name:names[i],data:data});
    }
    if(!pdfs.length)return {ok:false,reason:'Nothing saved is ready to pack.',pdfs:[],files:[],zip:null};
    const files=pdfs.concat([{name:'day-notes.txt',data:notes}]);
    return {ok:true,pdfs:pdfs,files:files,zip:zipStore(files),notes:notes};
  }
  function shareChoice(o){
    o=o||{};
    const n=o.count|0;
    if(!n)return {mode:'none',message:'Nothing is ready to send for this day.'};
    if(o.canShareSet)return {mode:'files',message:'Opens the share sheet with each saved PDF. You choose who receives them and tap Send. Nothing is sent until then.'};
    if(o.canShareOne)return {mode:'one',message:'This browser can share one file at a time. Share the combined PDF or the ZIP, or download them. You still choose the recipient and tap Send.'};
    return {mode:'download',message:'This browser cannot share files. Download the ZIP or the combined PDF. Nothing is emailed.'};
  }
  function shareResult(err){
    if(!err)return {status:'sent',message:'The share sheet finished. Files went only to the app you chose.'};
    const name=String(err.name||'');
    if(name==='AbortError')return {status:'cancelled',message:'Share cancelled. Nothing was sent.'};
    return {status:'failed',message:'Share failed. Nothing was sent. Use the ZIP or the combined PDF.'};
  }
  function pdfMagic(bytes){
    return !!(bytes&&bytes.byteLength>=5&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46);
  }
  function retainRecord(input){
    input=input||{};
    if(!input.id)return {ok:false,reason:'Missing job. PDF was not saved.'};
    const bytes=input.bytes instanceof Uint8Array?input.bytes.slice():(input.bytes?new Uint8Array(input.bytes):new Uint8Array());
    if(!bytes.byteLength)return {ok:false,reason:'Empty PDF was not saved.'};
    if(!pdfMagic(bytes))return {ok:false,reason:'That file is not a PDF. Nothing was saved.'};
    if(!input.stamp)return {ok:false,reason:'Worksheet stamp missing. PDF was not saved.'};
    const day=String(input.day||'').slice(0,10);
    if(!isYMD(day))return {ok:false,reason:'Service day missing. PDF was not saved.'};
    let name=String(input.name||fileBase(input.street,input.addr,day)+'.pdf');
    if(/[T ]\d{2}:\d{2}/.test(name)||/\d{2}:\d{2}/.test(name))return {ok:false,reason:'Filename must not include a time. PDF was not saved.'};
    return {ok:true,record:{
      id:String(input.id),name:name,day:day,addr:clean(input.addr),street:clean(input.street),
      stamp:String(input.stamp),made:input.made?String(input.made):'',incomplete:!!input.incomplete,bytes:bytes
    }};
  }
  function wrapLine(line,width){
    const text=plain(line),max=width||90;
    if(text.length<=max)return [text];
    const words=text.split(' '),out=[];
    let cur='';
    words.forEach(function(w){
      const t=cur?cur+' '+w:w;
      if(t.length<=max)cur=t;
      else{if(cur)out.push(cur);cur=w}
    });
    if(cur)out.push(cur);
    return out.length?out:[''];
  }
  return {
    DEFAULT_TECH:DEFAULT_TECH,HELP:HELP,LABEL:LABEL,
    isYMD:isYMD,sydneyDay:sydneyDay,sydneyToday:sydneyToday,sydneyClock:sydneyClock,addDays:addDays,fmtDay:fmtDay,
    fileBase:fileBase,pdfFileName:pdfFileName,worksheetStamp:worksheetStamp,cleaningMissing:cleaningMissing,
    serviceDay:serviceDay,sortValue:sortValue,statusOf:statusOf,dayPlan:dayPlan,summarise:summarise,
    contentsLines:contentsLines,dayNotes:dayNotes,uniqueFileNames:uniqueFileNames,
    crc32:crc32,zipStore:zipStore,unzipStore:unzipStore,packFiles:packFiles,
    shareChoice:shareChoice,shareResult:shareResult,retainRecord:retainRecord,pdfMagic:pdfMagic,wrapLine:wrapLine,plain:plain
  };
});
