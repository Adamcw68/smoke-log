/* Move worksheets between this phone and another browser.
   The file is a copy. Nothing is emailed or uploaded here.
   A merge adds jobs and keeps the newer worksheet. It does not delete local data. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSATransfer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function timeOf(v){const t=Date.parse(v||'');return isNaN(t)?0:t}
  function jobKey(addr,ident){return (String(addr||'')+'|'+String(ident||'')).toLowerCase().replace(/[^a-z0-9|]+/g,'')}
  function dateKey(j){return (j&&(j.due||String(j.svc||'').slice(0,10)||j.last))||''}
  function dupKey(j){return jobKey(j&&j.addr,j&&j.ident)+'|'+dateKey(j)}
  function copyJob(j){return Object.assign({},j||{})}
  function fillBlanks(local,incoming){
    ['agent','section','contact','p1','p2','notes','directions','ident','street','town','ptype'].forEach(function(k){
      if(!clean(local[k])&&clean(incoming[k]))local[k]=incoming[k];
    });
    if(!local.svc&&incoming.svc)local.svc=incoming.svc;
  }
  /* local and incoming are {jobs, forms, photos, pdfs}. Photos and PDFs already here are not removed. */
  function mergeWorksheets(local,incoming){
    local=local||{};incoming=incoming||{};
    const jobs=(local.jobs||[]).map(copyJob);
    const forms=Object.assign({},local.forms||{});
    const byId=new Map();
    const byDup=new Map();
    jobs.forEach(function(j){if(j&&j.id)byId.set(String(j.id),j);byDup.set(dupKey(j),j)});
    const report={added:[],newer:[],kept:[],photos:0,pdfs:0};
    const photos=[];
    const pdfs=[];
    (incoming.jobs||[]).forEach(function(raw){
      if(!raw)return;
      const inc=copyJob(raw);
      const cur=byId.get(String(inc.id||''))||byDup.get(dupKey(inc));
      const incForm=(incoming.forms||{})[inc.id];
      if(!cur){
        let id=String(inc.id||dupKey(inc)||('job-'+jobs.length));
        if(byId.has(id))id=id+'#'+(jobs.length+2);
        inc.id=id;
        jobs.push(inc);
        byId.set(id,inc);
        byDup.set(dupKey(inc),inc);
        if(incForm)forms[id]=incForm;
        report.added.push(inc.addr||id);
        return;
      }
      const localForm=forms[cur.id];
      const localT=timeOf(localForm&&localForm.updated);
      const incT=timeOf(incForm&&incForm.updated);
      if(incForm&&incT>localT){
        forms[cur.id]=incForm;
        if(clean(incForm.agent))cur.agent=incForm.agent;
        if(clean(incForm.tenancy))cur.section=incForm.tenancy;
        fillBlanks(cur,inc);
        report.newer.push(cur.addr||cur.id);
      }else{
        fillBlanks(cur,inc);
        report.kept.push(cur.addr||cur.id);
      }
    });
    const havePhoto=new Map((local.photos||[]).map(function(p){return [p&&p.id,p]}));
    (incoming.photos||[]).forEach(function(p){
      if(!p||!p.id)return;
      const old=havePhoto.get(p.id);
      if(old&&timeOf(old.ts)>=timeOf(p.ts))return;
      photos.push(p);
      report.photos++;
    });
    const havePdf=new Map((local.pdfs||[]).map(function(p){return [p&&p.id,p]}));
    (incoming.pdfs||[]).forEach(function(p){
      if(!p||!p.id)return;
      const old=havePdf.get(p.id);
      if(old&&timeOf(old.made)>=timeOf(p.made))return;
      pdfs.push(p);
      report.pdfs++;
    });
    return {jobs:jobs,forms:forms,photos:photos,pdfs:pdfs,report:report};
  }
  function mergeMessage(report){
    report=report||{added:[],newer:[],kept:[]};
    const bits=[];
    bits.push('Added '+report.added.length+' job'+(report.added.length===1?'':'s')+'.');
    bits.push('Updated '+report.newer.length+' newer worksheet'+(report.newer.length===1?'':'s')+'.');
    if(report.kept.length)bits.push(report.kept.length+' already here kept its worksheet, because it was newer or the same.');
    bits.push('Nothing already on this device was deleted.');
    return bits.join(' ');
  }
  function alarmRow(job,form,alarm,index){
    alarm=alarm||{};
    const yn=alarm.yn||{};
    return {
      Address:job.addr||'',
      Agent:clean(form.agent)||clean(job.agent),
      Tenancy:clean(form.tenancy)||clean(job.section),
      Phone:job.p1||'',
      'Service date':form.date||'',
      Technician:form.tech||'',
      Alarm:index+1,
      Mount:alarm.mount||'',
      Room:alarm.room||'',
      Power:(alarm.power||[]).join(', '),
      Sensor:(alarm.sensor||[]).join(', '),
      Manufacturer:alarm.manufacturer||'',
      Model:alarm.model||'',
      'Sound dB':alarm.db||'',
      Expiry:alarm.expiry||'',
      New:alarm.isNew?'Yes':(alarm.newAns||''),
      Cleaned:yn.cleaned||'',
      Battery:yn.battery||'',
      Comments:form.comments||''
    };
  }
  function sheetRows(jobs,forms){
    const rows=[];
    (jobs||[]).forEach(function(job){
      const form=(forms||{})[job.id]||{};
      const list=form.al||[];
      const n=Math.max(form.alarms||0,list.length,1);
      for(let i=0;i<n;i++)rows.push(alarmRow(job,form,list[i],i));
    });
    return rows;
  }
  function isWorksheetPack(data){
    if(!data||typeof data!=='object'||Array.isArray(data))return false;
    if(Array.isArray(data.events)||Array.isArray(data.items))return false;
    return !!(data.forms||data.photos||data.pdfs||data.version>=4);
  }
  return {mergeWorksheets:mergeWorksheets,mergeMessage:mergeMessage,sheetRows:sheetRows,isWorksheetPack:isWorksheetPack,dupKey:dupKey};
});
