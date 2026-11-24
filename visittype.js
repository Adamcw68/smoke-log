/* Off-annual visits sit beside the annual inspection.
   Copying the last alarms does not copy photos, answers, or the old worksheet.
   The 12-month date moves only when every alarm on the off-annual visit is tested and passes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSAVisit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ANNUAL='annual';
  const OFF='off';
  const REASONS=[
    {id:'callout',label:'Callout / Beeping / Faulty alarm'},
    {id:'replacement',label:'Alarm replacement'},
    {id:'tenancy',label:'Change of tenancy'},
    {id:'reattend',label:'Re-attend'},
    {id:'other',label:'Other'}
  ];

  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function kindOf(form){return form&&form.visitKind==='off'?OFF:ANNUAL}
  function reasonId(form){
    const id=clean(form&&form.visitReason);
    return REASONS.some(function(row){return row.id===id})?id:'';
  }
  function reasonLabel(form){
    if(kindOf(form)!==OFF)return '';
    const id=reasonId(form)||'callout';
    if(id==='other'){
      const typed=clean(form.visitOther);
      return typed?typed.slice(0,80):'Other';
    }
    const row=REASONS.filter(function(item){return item.id===id})[0];
    return row?row.label:'';
  }
  function describe(form){
    const kind=kindOf(form);
    if(kind!==OFF)return {kind:ANNUAL,reason:'',label:'Annual service',line:''};
    const reason=reasonLabel(form);
    return {kind:OFF,reason:reason,label:'Off-annual service visit',line:'Off-annual service'+(reason?' · '+reason:'')};
  }
  function portal(){
    if(typeof CCSAPortalData!=='undefined'&&CCSAPortalData.serviceResult)return CCSAPortalData;
    if(typeof require==='function'){try{return require('./portaldata.js')}catch(e){return null}}
    return null;
  }
  /* Pass or replace on every listed alarm. A blank check is not a pass. */
  function resetsCompliance(form){
    if(kindOf(form)!==OFF)return true;
    const lib=portal();
    const result=lib&&lib.serviceResult?lib.serviceResult(form):'';
    return result==='pass'||result==='replace';
  }
  function copyAlarm(alarm){
    alarm=alarm||{};
    return {
      isNew:false,
      newAns:'No',
      mount:clean(alarm.mount),
      room:clean(alarm.room),
      bedno:clean(alarm.bedno),
      other:clean(alarm.other),
      adjacent:clean(alarm.adjacent),
      power:Array.isArray(alarm.power)?alarm.power.slice():[],
      sensor:Array.isArray(alarm.sensor)?alarm.sensor.slice():[],
      manufacturer:clean(alarm.manufacturer),
      model:clean(alarm.model),
      db:'',
      expiry:clean(alarm.expiry),
      mfd:clean(alarm.mfd),
      yn:{},
      photos:[]
    };
  }
  function offAnnualVisit(job,form,opts){
    job=job||{};
    form=form||{};
    opts=opts||{};
    const today=clean(opts.today);
    const n=Math.max(1,+form.alarms||((form.al||[]).length)||+job.alarms||1);
    const alarms=(form.al||[]).slice(0,n).map(copyAlarm);
    while(alarms.length<n)alarms.push(copyAlarm({}));
    const stamp=clean(opts.stamp)||String(Date.now());
    let id=String(job.id||'job')+'#off-'+today.replace(/-/g,'')+'-'+stamp.slice(-6);
    const prior=clean(opts.priorDue);
    return {
      job:{
        id:id,
        row:(job.row||0)+1,
        section:job.section||'',
        agent:job.agent||'',
        tech:job.tech||'',
        last:clean(form.date)||clean(job.last)||'',
        due:'',
        ident:job.ident||'',
        street:job.street||'',
        town:job.town||'',
        addr:job.addr||form.addr||'',
        directions:job.directions||'',
        contact:job.contact||'',
        p1:job.p1||'',
        p2:job.p2||'',
        ptype:job.ptype||'',
        beds:job.beds,
        alarms:n,
        ladder:job.ladder||'',
        exp:(job.exp||[]).slice(),
        ic:'',
        notes:'',
        extra:[],
        svc:today?today+'T09:00:00':'',
        order:null,
        arch:null,
        src:'Off-annual'
      },
      form:{
        tech:clean(form.tech||job.tech||''),
        date:today,
        ident:clean(form.ident||job.ident||''),
        agent:clean(form.agent||job.agent||''),
        agentSet:!!(form.agentSet||form.agent||job.agent),
        tenancy:clean(form.tenancy||job.section||''),
        tenancySet:!!(form.tenancySet||form.tenancy||job.section),
        addr:clean(form.addr||job.addr||''),
        ptype:form.ptype||'',
        ptypeOther:form.ptypeOther||'',
        levels:form.levels||'',
        beds:form.beds||job.beds||'',
        alarms:n,
        ladder:form.ladder||job.ladder||'',
        asPrev:true,
        asPhotos:false,
        asPhotosSet:true,
        photos:[],
        comments:'',
        done:false,
        updated:null,
        al:alarms,
        visitKind:OFF,
        visitReason:REASONS.some(function(row){return row.id===clean(opts.reason)})?clean(opts.reason):'callout',
        visitOther:'',
        priorDue:/^\d{4}-\d{2}-\d{2}$/.test(prior)?prior:''
      }
    };
  }
  return {
    ANNUAL:ANNUAL,
    OFF:OFF,
    REASONS:REASONS,
    kindOf:kindOf,
    reasonId:reasonId,
    reasonLabel:reasonLabel,
    describe:describe,
    resetsCompliance:resetsCompliance,
    copyAlarm:copyAlarm,
    offAnnualVisit:offAnnualVisit
  };
});
