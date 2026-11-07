/* Read one job's appointment from its calendar event. Never writes to the calendar.
   Inspection answers, photos, notes, archive and completion stay on the phone. */
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
  return {resolveRefreshTarget:resolveRefreshTarget,classifyRemote:classifyRemote,failureMessage:failureMessage,appointmentPatch:appointmentPatch,dayOf:dayOf};
});
