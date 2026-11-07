/* Read one job's appointment from its calendar event. Never writes to the calendar.
   Alarm inventory in the event text can fill empty worksheet fields. A different
   value already entered stays until it is confirmed. Old Passed/test/battery
   results are not this visit. Photos, notes, archive and completion stay. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.JobRefresh=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function dayOf(iso){const m=String(iso||'').match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:''}
  function labeled(description,name){
    const re=new RegExp('^'+name+'\\s*:\\s*(.+)$','im');
    const m=String(description||'').match(re);
    return m?clean(m[1]):''}
  function sameId(a,b){return String(a||'')!==''&&String(a)===String(b)}
  /* Stored event id wins. Without one, only a single address match is safe. */
  function resolveRefreshTarget(job,events,matches){
    matches=matches||function(){return false};
    if(!job)return {ok:false,status:'absent',message:'This worksheet was not changed.'};
    if(job.calEventId)return {ok:true,status:'id',eventId:String(job.calEventId),writes:false};
    const hits=(events||[]).filter(function(ev){return ev&&ev.id&&String(ev.status||'confirmed').toLowerCase()!=='cancelled'&&matches(job,ev)});
    if(hits.length===1)return {ok:true,status:'unique',event:hits[0],eventId:String(hits[0].id),writes:false};
    if(!hits.length)return {ok:false,status:'absent',message:'No single calendar event is linked to this job. This worksheet was not changed.',writes:false};
    return {ok:false,status:'ambiguous',count:hits.length,message:'More than one calendar event matches this address. This worksheet was not changed.',writes:false}}
  function classifyRemote(data,eventId){
    if(!data)return {ok:false,status:'missing',message:'That calendar event was not found. This worksheet was not changed.',writes:false};
    const status=String(data.status||'confirmed').toLowerCase();
    if(status==='cancelled')return {ok:false,status:'cancelled',message:'That calendar event was cancelled. This worksheet was not changed.',writes:false};
    if(data.id&&eventId&&String(data.id)!==String(eventId))return {ok:false,status:'mismatch',message:'The calendar returned a different event. This worksheet was not changed.',writes:false};
    return {ok:true,status:'ready',writes:false}}
  function failureMessage(kind){
    if(kind==='offline')return 'You are offline. This worksheet was not changed.';
    if(kind==='permission')return 'Google did not allow this calendar to be read. This worksheet was not changed.';
    if(kind==='auth')return 'Google sign-in expired. This worksheet was not changed.';
    return 'The calendar could not be read. This worksheet was not changed.'}
  /* Copy appointment fields only. Historical Passed notes and inspection data are not inputs. */
  function appointmentPatch(job,form,event,opts){
    opts=opts||{};
    const j=Object.assign({},job||{});
    const f=form||{};
    const formPatch={};
    const changes=[];
    const oldDay=dayOf(j.svc);
    if(event.iso&&event.iso!==j.svc){j.svc=event.iso;changes.push('time');if(!f.date||f.date===oldDay)formPatch.date=dayOf(event.iso)}
    if(event.id)j.calEventId=String(event.id);
    if(opts.calendarId)j.calCalendarId=opts.calendarId;
    const loc=clean(event.location);
    if(loc&&loc!==j.addr&&(!f.addr||f.addr===job.addr)){j.addr=loc;formPatch.addr=loc;changes.push('address')}
    const access=labeled(event.description,'Access');
    if(access&&access!==j.directions){j.directions=access;changes.push('access')}
    const agent=labeled(event.description,'Agent');
    if(agent&&agent!==j.agent&&(!f.agent||f.agent===job.agent)){j.agent=agent;formPatch.agent=agent;changes.push('agent')}
    if(!j.arch){
      const contact=labeled(event.description,'Contact');
      const phone=labeled(event.description,'Phone');
      if(contact&&contact!==j.contact){j.contact=contact;changes.push('contact')}
      if(phone&&phone!==j.p1){j.p1=phone;changes.push('phone')}}
    const msg=changes.length?(changes.indexOf('time')>=0?'Appointment time updated from the calendar. Inspection answers were kept.':'Appointment details updated from the calendar. Inspection answers were kept.'):'This appointment already matches the calendar. Inspection answers were kept.';
    return {ok:true,status:changes.length?'updated':'current',job:j,formPatch:formPatch,changes:changes,message:msg,writes:false,
      preserved:{done:!!f.done,comments:f.comments||'',arch:job.arch||null,notes:job.notes||'',last:job.last||'',alarms:f.al||null,photos:f.photos||null}}}
  const ROOMS=[['entryway','Entryway'],['hallway','Hallway'],['bedroom','Bedroom'],['lounge','Lounge'],['dining','Dining'],['laundry','Laundry'],['entry','Entryway'],['hall','Hallway']];
  const BRANDS=[['clipsal','Clipsal'],['brooks','Brooks'],['kidde','Kidde'],['cavius','Cavius'],['quell','Quell'],['hpm','HPM'],['arlec','Arlec']];
  const FIELD_LABEL={room:'Location',mount:'Mounted on',bedno:'Bedroom no.',other:'Other location',adjacent:'Adjacent',power:'Power',sensor:'Sensor',manufacturer:'Manufacturer',model:'Model',db:'Decibels',expiry:'Expiry',mfd:'Made',calRef:'Calendar text',new:'New alarm',ladder:'Ladder',beds:'Bedrooms',levels:'Levels',ptype:'Property type'};
  function labelRead(){const g=typeof globalThis!=='undefined'?globalThis:null;return g&&g.LabelRead?g.LabelRead:null}
  function cloneAlarm(a){
    const b=Object.assign({isNew:false,newAns:'',mount:'',room:'',bedno:'',other:'',adjacent:'',manufacturer:'',model:'',db:'',expiry:'',mfd:'',calRef:''},a||{});
    b.power=(a&&a.power?a.power:[]).slice();
    b.sensor=(a&&a.sensor?a.sensor:[]).slice();
    b.yn=Object.assign({},a&&a.yn||{});
    b.photos=(a&&a.photos?a.photos:[]).slice();
    return b}
  function sameList(a,b){
    const x=(a||[]).slice().sort().join('|'),y=(b||[]).slice().sort().join('|');
    return x===y}
  function emptyValue(v){return Array.isArray(v)?v.length===0:clean(v)===''}
  function skipLine(line){
    return /^(?:visit|archived|technician|notes|worksheet date|last visit|contact|phone|mobile|e-?mail|access|agent|warning|warn|tenant|occupant|resident|guest|name)\b/i.test(line)
      || /^\d+\s+(?:new\s+)?alarms?\b/i.test(line)
      || /^(?:not yes|recorded checks|no inspection|no worksheet)\b/i.test(line)}
  function splitVisits(description){
    const text=String(description||'').replace(/\r\n/g,'\n');
    const visits=[];
    const standing=text.replace(/\[CCSA visit\][\s\S]*?\[\/CCSA visit\]/gi,function(block){
      visits.push(block.replace(/\[\/?CCSA visit\]/gi,'').trim());
      return '\n'});
    return {standing:standing,visits:visits}}
  function explode(text){
    const marked=String(text||'').replace(/\s+(?=(?:alarm|a)\s*#?\s*\d{1,2}\b)/gi,'\n');
    return marked.split(/\n|;/).map(function(s){return s.trim()}).filter(Boolean)}
  function alarmHead(piece){
    const m=piece.match(/^(?:alarm|alm|a)\s*#?\s*(\d{1,2})\b[\s:.\-–)]*(.*)$/i);
    if(!m)return null;
    const n=+m[1];
    if(n<1||n>12)return null;
    return {index:n-1,body:m[2]||'',raw:piece}}
  function parseClause(raw,nowYear){
    const body=String(raw||'');
    const fields={};
    let work=body.replace(/\bnew\s+batter(?:y|ies)\b/ig,' ').replace(/\bbatter(?:y|ies)\s+(?:changed|replaced|installed)\b/ig,' ').replace(/\btest(?:ed)?\s+button\b/ig,' ');
    const roomHit=ROOMS.find(function(pair){return new RegExp('\\b'+pair[0]+'\\b','i').test(work)});
    if(roomHit)fields.room=roomHit[1];
    const bed=work.match(/\bbed(?:room)?\s*(?:no\.?|number|#)?\s*(\d+)\b/i);
    if(bed){fields.bedno=String(+bed[1]);fields.room='Bedroom'}
    if(/\bceiling\b/i.test(work))fields.mount='Ceiling';
    else if(/\bwall\b/i.test(work))fields.mount='Wall';
    const power=[];
    if(/\b240\s*v(?:olts?)?\b|\bmains\b/i.test(work))power.push('240v');
    if(/\b9\s*v(?:olts?)?\b/i.test(work))power.push('9v');
    if(/\bni[\s-]?mh\b/i.test(work))power.push('Ni-Mh');
    if(/\blithium\b/i.test(work))power.push('Lithium');
    const sensor=[];
    if(/\bphoto(?:\s*|-)?electric\b|\bphotoelectric\b|\bphoto\b/i.test(work)&&!/\bphotos\b/i.test(work))sensor.push('Photo-Electric');
    if(/\bion(?:isation|ization)?\b/i.test(work))sensor.push('Ionization');
    if(/\bheat\b/i.test(work))sensor.push('Heat');
    const brand=BRANDS.find(function(pair){return new RegExp('\\b'+pair[0]+'\\b','i').test(work)});
    if(brand)fields.manufacturer=brand[1];
    const lr=labelRead();
    if(lr&&lr.readModel){const model=lr.readModel(work);if(model)fields.model=model}
    else{const sm=work.match(/\bsma\s*-?\s*4\b/i);if(sm)fields.model='SMA4'}
    if(fields.model==='SMA4'&&!fields.manufacturer&&/\bclipsal\b/i.test(work))fields.manufacturer='Clipsal';
    const db=work.match(/\b(\d{2,3})\s*db\b/i);
    if(db)fields.db=String(+db[1]);
    const adj=work.match(/\badj(?:acent)?(?:\s+to)?\s*[:\-]?\s*([^,;]+)/i);
    if(adj&&clean(adj[1])&&!/^(?:alarm|a)\s*\d/i.test(adj[1]))fields.adjacent=clean(adj[1]);
    if(/\bnew\b/i.test(work))fields.isNew=true;
    let expiry='',mfd='',dateUnclear=false;
    const dateToken='(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{4}|\\d{1,2}[\\/\\-.]\\d{4})';
    const asMonth=function(raw){if(lr&&lr.normalizeExpiry){const n=lr.normalizeExpiry(raw);return n?n.display:''}return monthYear(raw)};
    const expWord=work.match(new RegExp('\\b(?:rep(?:lace(?:ment)?)?|exp(?:iry|ires)?)\\s*[:\\-]?\\s*'+dateToken,'i'));
    const madeWord=work.match(new RegExp('\\b(?:made|mfd|mfg|manufactured)\\s*[:\\-]?\\s*'+dateToken,'i'));
    if(expWord)expiry=asMonth(expWord[1]);
    if(madeWord)mfd=asMonth(madeWord[1]);
    if(lr&&lr.handwrittenExpiry&&!expiry){
      const hand=lr.handwrittenExpiry(work,nowYear);
      if(hand&&hand.conflict)dateUnclear=true;
      else if(hand&&hand.expiry)expiry=hand.expiry.display}
    if(lr&&lr.clipsalFactoryExpiry&&(!expiry||!mfd)){
      const factory=lr.clipsalFactoryExpiry(work,{nowYear:nowYear,explicitExpiry:!!expiry||dateUnclear});
      if(factory&&factory.manufacture&&!mfd)mfd=factory.manufacture.display;
      if(factory&&factory.expiry&&!expiry&&!dateUnclear)expiry=factory.expiry.display}
    if(expiry)fields.expiry=expiry;
    if(mfd)fields.mfd=mfd;
    const sma=lr&&lr.isClipsalSma4?lr.isClipsalSma4(fields.manufacturer,fields.model):fields.model==='SMA4';
    if(sma){
      if(power.indexOf('240v')<0)power.push('240v');
      const order=['9v','240v','Ni-Mh','Lithium'];
      fields.power=order.filter(function(p){return power.indexOf(p)>=0})}
    else if(power.length)fields.power=power;
    if(sensor.length)fields.sensor=sensor.filter(function(s,i){return sensor.indexOf(s)===i});
    const rest=leftover(work);
    return {fields:fields,uncertain:!!rest||dateUnclear,rest:rest}}
  function monthYear(s){
    const t=String(s||'').trim();
    let m=t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if(m){const mo=+m[2],y=+m[3];if(mo>=1&&mo<=12&&y>=1990&&y<=2100)return String(mo).padStart(2,'0')+'/'+y;return ''}
    m=t.match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if(m){const mo=+m[1],y=+m[2];if(mo>=1&&mo<=12&&y>=1990&&y<=2100)return String(mo).padStart(2,'0')+'/'+y}
    return ''}
  function leftover(work){
    let s=' '+String(work||'').toLowerCase()+' ';
    ['photo-electric','photoelectric','photo electric','ionization','ionisation','entryway','hallway','bedroom','laundry','dining','lounge','clipsal','brooks','kidde','cavius','quell','arlec','ceiling','lithium','backup','mains','replace','replacement','expiry','expires','manufactured','manufacturer','model','alarm','photo','electric','heat','ion','hall','entry','wall','hpm','sma-4','sma4','nimh','ni-mh','new','rep','exp','made','mfd','mfg','type','volt','volts','adjacent','adj','bed','no','number','db'].forEach(function(w){
      s=s.replace(new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','g'),' ')});
    s=s.replace(/\b\d+\s*v\b/g,' ');
    s=s.replace(/\b\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}\b/g,' ');
    s=s.replace(/\b\d{1,2}\s*[\/\-.]\s*\d{2,4}\b/g,' ');
    s=s.replace(/\b\d+\b/g,' ');
    s=s.replace(/\bv\b/g,' ');
    s=s.replace(/[^a-z]+/g,' ').trim();
    return s}
  function parseInventoryText(text,nowYear){
    const alarms=[];
    explode(text).forEach(function(piece){
      if(skipLine(piece))return;
      const head=alarmHead(piece);
      if(!head)return;
      const parsed=parseClause(head.body||head.raw,nowYear);
      alarms.push({index:head.index,raw:head.raw,fields:parsed.fields,uncertain:parsed.uncertain||Object.keys(parsed.fields).length===0,rest:parsed.rest})});
    return alarms}
  function parseProperty(standing){
    const out={};
    String(standing||'').split('\n').forEach(function(line){
      let m=line.match(/^ladder\s*:\s*(sm|med|lg|xl)\b/i);
      if(m){const k=m[1].toLowerCase();out.ladder=k==='sm'?'Sm':k==='med'?'Med':k==='xl'?'XL':'Lg';return}
      m=line.match(/^bedrooms?\s*:\s*(\d+)\b/i);
      if(m){out.beds=+m[1];return}
      m=line.match(/^levels?\s*:\s*(\d+)\b/i);
      if(m){out.levels=+m[1];return}
      m=line.match(/^property type\s*:\s*(house|unit|townhouse|duplex|villa|other)\b/i);
      if(m)out.ptype=m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase()});
    return out}
  function parseAlarmSources(description,nowYear){
    const parts=splitVisits(description);
    let alarms=parseInventoryText(parts.standing,nowYear);
    let fromVisit=false;
    if(!alarms.length&&parts.visits.length){
      alarms=parseInventoryText(parts.visits[parts.visits.length-1],nowYear);
      fromVisit=!!alarms.length}
    const seen={};
    alarms=alarms.filter(function(item){if(seen[item.index])return false;seen[item.index]=true;return true});
    return {alarms:alarms,property:parseProperty(parts.standing),fromVisit:fromVisit}}
  function consider(conflicts,filled,local,source,meta){
    if(source==null||emptyValue(source))return;
    const same=Array.isArray(source)?sameList(local,source):clean(local)===clean(source)||(meta.field==='expiry'||meta.field==='mfd')&&monthYear(local)===source;
    if(same)return;
    if(emptyValue(local)){filled.push(Object.assign({value:source},meta));return}
    conflicts.push({index:meta.index,field:meta.field,label:FIELD_LABEL[meta.field]||meta.field,local:Array.isArray(local)?local.slice():local,source:Array.isArray(source)?source.slice():source})}
  function applyAlarmInventory(form,description,opts){
    opts=opts||{};
    const nowYear=opts.nowYear||new Date().getFullYear();
    const src=parseAlarmSources(description,nowYear);
    const f=form||{};
    const alarms=(f.al||[]).map(cloneAlarm);
    const conflicts=[];
    const filled=[];
    const reference=[];
    src.alarms.forEach(function(item){
      while(alarms.length<=item.index)alarms.push(cloneAlarm(null));
      const local=alarms[item.index];
      const fields=item.fields||{};
      ['room','mount','bedno','other','adjacent','manufacturer','model','db','expiry','mfd'].forEach(function(key){
        consider(conflicts,filled,local[key],fields[key],{index:item.index,field:key})});
      if(fields.power)consider(conflicts,filled,local.power,fields.power,{index:item.index,field:'power'});
      if(fields.sensor)consider(conflicts,filled,local.sensor,fields.sensor,{index:item.index,field:'sensor'});
      if(fields.isNew){
        const localNew=local.newAns==='Yes'||local.isNew===true?'Yes':local.newAns==='No'?'No':'';
        consider(conflicts,filled,localNew,'Yes',{index:item.index,field:'new'})}
      if(item.uncertain){
        consider(conflicts,filled,local.calRef,item.raw,{index:item.index,field:'calRef'});
        if(!Object.keys(fields).length)reference.push(item.raw)}});
    filled.forEach(function(ch){
      const a=alarms[ch.index];
      if(ch.field==='new'){a.isNew=true;a.newAns='Yes'}
      else if(ch.field==='power'||ch.field==='sensor')a[ch.field]=ch.value.slice();
      else a[ch.field]=ch.value});
    const property={};
    const propFilled=[];
    Object.keys(src.property).forEach(function(key){
      consider(conflicts,propFilled,f[key],src.property[key],{index:null,field:key})});
    propFilled.forEach(function(ch){property[ch.field]=ch.value;filled.push(ch)});
    let comments=f.comments||'';
    const extra=reference.filter(function(line){return comments.indexOf(line)<0});
    if(extra.length){
      const block='Calendar alarm text:\n'+extra.join('\n');
      comments=comments?comments.replace(/\s*$/,'')+'\n\n'+block:block}
    const count=Math.max(+(f.alarms||0)||0,alarms.length);
    const changed=filled.length>0||comments!==(f.comments||'')||alarms.length>(f.al||[]).length;
    return {writes:false,filled:filled.length,alarms:changed?alarms:(f.al||[]),alarmCount:count,comments:comments,property:property,conflicts:conflicts,reference:reference,changed:changed,fromVisit:src.fromVisit}}
  function acceptAlarmField(alarm,conflict){
    const a=cloneAlarm(alarm);
    if(!conflict)return a;
    if(conflict.field==='new'){a.isNew=true;a.newAns='Yes'}
    else if(conflict.field==='power'||conflict.field==='sensor')a[conflict.field]=(conflict.source||[]).slice();
    else if(conflict.field!=='yn'&&conflict.field!=='photos'&&conflict.field!=='done')a[conflict.field]=conflict.source;
    a.yn=Object.assign({},alarm&&alarm.yn||{});
    a.photos=(alarm&&alarm.photos?alarm.photos:[]).slice();
    return a}
  return {resolveRefreshTarget:resolveRefreshTarget,classifyRemote:classifyRemote,failureMessage:failureMessage,appointmentPatch:appointmentPatch,dayOf:dayOf,applyAlarmInventory:applyAlarmInventory,acceptAlarmField:acceptAlarmField,parseAlarmSources:parseAlarmSources};
});
