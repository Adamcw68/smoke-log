/* Push an archived worksheet onto its own Google Calendar event.
   Event colour id 10 is Basil on the event palette (colors.get background #51b749;
   modern UI #0b8043). Calendar-list id 10 is Avocado and calendar-list Basil is 8 —
   those ids are never written.
   The matched event description loses tenant names, phone numbers, email addresses
   and contact lines. Access notes, warnings and a short last-visit line stay.
   Worksheet contact fields are not copied in and are not deleted. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CCSACal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const BASIL_EVENT_COLOR_ID='10';
  const BASIL_EVENT_BG='#51b749';
  const OPEN='[CCSA visit]';
  const CLOSE='[/CCSA visit]';
  const YN={comply:'AS3786',battery:'battery',located:'location',button:'test button',affixed:'affixed',cleaned:'cleaned'};
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function dmy(day){
    const m=String(day||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '';
    return (+m[3])+' '+MONTHS[+m[2]-1]+' '+m[1];
  }
  function sydneyDay(iso){
    const t=Date.parse(iso);
    if(isNaN(t))return '';
    const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
    return fmt.format(new Date(t));
  }
  function eventDay(ev){
    const iso=ev&&(ev.iso||ev.dateTime||'');
    if(ev&&ev.start&&ev.start.date)return String(ev.start.date).slice(0,10);
    return sydneyDay(iso)||String(iso).slice(0,10);
  }
  function sameInstant(a,b){
    const ta=Date.parse(a),tb=Date.parse(b);
    return !isNaN(ta)&&!isNaN(tb)&&ta===tb;
  }
  function visitDay(job,form){
    const svc=job&&job.svc?String(job.svc):'';
    if(/^\d{4}-\d{2}-\d{2}/.test(svc)&&!isNaN(Date.parse(svc)))return svc.slice(0,10);
    const d=form&&form.date?String(form.date).slice(0,10):'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d;
    return '';
  }
  /* Official colors.get event palette. Refuse if id 10 is not the Basil background. */
  function basilColorIdFromPalette(colors){
    const ev=colors&&colors.event&&colors.event['10'];
    const bg=ev&&String(ev.background||'').toLowerCase();
    return bg===BASIL_EVENT_BG?BASIL_EVENT_COLOR_ID:null;
  }
  function matchVisitEvent(job,events,form,matches){
    matches=matches||function(){return false};
    if(!job||!job.arch)return {status:'not-archived'};
    const day=visitDay(job,form);
    if(!day)return {status:'absent',reason:'no-visit-date'};
    const list=(events||[]).filter(function(ev){return ev&&matches(job,ev)&&eventDay(ev)===day});
    const withId=list.filter(function(ev){return ev.id});
    if(!list.length)return {status:'absent',reason:'no-event-that-day',day};
    if(job.calEventId){
      const bound=withId.filter(function(ev){return ev.id===job.calEventId});
      if(bound.length===1)return {status:'ok',event:bound[0],day};
    }
    if(job.svc){
      const exact=withId.filter(function(ev){return sameInstant(ev.iso||ev.dateTime,job.svc)});
      if(exact.length===1)return {status:'ok',event:exact[0],day};
      if(exact.length>1)return {status:'ambiguous',reason:'same-instant',day,count:exact.length};
    }
    if(list.length>1)return {status:'ambiguous',reason:'same-day',day,count:list.length};
    if(withId.length===1)return {status:'ok',event:withId[0],day};
    return {status:'noid',reason:'no-event-id',day};
  }
  function worksheetTouched(form){
    if(!form)return false;
    if(form.updated||form.done||clean(form.comments))return true;
    return (form.al||[]).some(function(a){return a&&(a.isNew||Object.keys(a.yn||{}).some(function(k){return YN[k]&&a.yn[k]}))});
  }
  const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const PHONE=/(?:\+61[\s-]?|0)[2-478](?:[\s-]?\d){8}\b|\(\s*0[2-478]\s*\)(?:[\s-]*\d){8}/gi;
  const CONTACT_HEAD=/^(?:contacts?|tenants?|tenant details|names?|phones?|mobiles?|tels?|telephones?|e-?mails?|occupants?|residents?|guests?)\b[:\s-]*$/i;
  const CONTACT_FIELD=/^(?:contacts?|tenants?|tenant details|names?|phones?|mobiles?|tels?|telephones?|e-?mails?|occupants?|residents?|guests?)\b\s*[:\-]?\s+\S/i;
  const OPERATIONAL=/^(?:access|entry|warning|warn|last visit|notes?|alarms?|key|gate|parking|instructions?|\[ccsa\b)/i;
  function plainText(s){
    return String(s??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'');
  }
  function scrubInline(s){
    return String(s||'').replace(EMAIL,' ').replace(PHONE,' ').replace(/\s{2,}/g,' ').replace(/\s+([,.;:)])/g,'$1').replace(/([(])\s+/g,'$1').trim();
  }
  function stripName(s,name){
    const n=clean(name);
    if(n.length<3)return s;
    const re=new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi');
    return s.replace(re,'').replace(/\s{2,}/g,' ').replace(/\s+([,.;:])/g,'$1').trim();
  }
  function capWord(w){
    const s=String(w||'').toLowerCase();
    if(s==='no access')return 'No access';
    return s.replace(/\b[a-z]/g,function(c){return c.toUpperCase()});
  }
  function conciseLastVisit(line){
    if(!/^last visit\b/i.test(line))return line;
    const date=line.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})\b/);
    const result=line.match(/\b(passed|failed|complete|completed|no access|vacant)\b/i);
    if(!date&&!result){
      const rest=line.replace(/^last visit\s*[:\-]?\s*/i,'').trim();
      return rest?('Last visit: '+rest):'';
    }
    return 'Last visit:'+(date?' '+date[1]:'')+(result?' '+capWord(result[1]):'');
  }
  /* Remove tenant names, phones, emails and contact lines from one event description.
     Access notes, warnings and a short last-visit line stay. */
  function stripTenantDetails(text,job){
    const lines=plainText(text).split('\n');
    const out=[];
    let dropping=false;
    lines.forEach(function(raw){
      const line=String(raw||'').trim();
      if(!line){dropping=false;out.push('');return}
      if(CONTACT_HEAD.test(line)||CONTACT_FIELD.test(line)){dropping=true;return}
      if(dropping){
        if(OPERATIONAL.test(line))dropping=false;
        else return;
      }
      if(OPERATIONAL.test(line)===false && scrubInline(line)==='' )return;
      let kept=scrubInline(line);
      if(!/^technician:/i.test(kept))kept=stripName(kept,job&&job.contact);
      kept=conciseLastVisit(kept);
      if(kept)out.push(kept);
    });
    return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function scrubCopiedNotes(notes,job){
    let s=plainText(notes);
    s=s.split('\n').filter(function(line){return !(CONTACT_HEAD.test(line.trim())||CONTACT_FIELD.test(line.trim()))}).join(' ');
    s=scrubInline(s);
    s=stripName(s,job&&job.contact);
    s=s.replace(/\b(?:contact|tenant|phone|mobile|e-?mail)\s*:\s*/gi,'').replace(/\s{2,}/g,' ').trim();
    return s;
  }
  function visitBlock(job,form,day){
    const lines=['Visit '+dmy(day)+'.'];
    const archived=job&&job.arch?sydneyDay(job.arch):'';
    if(archived&&archived!==day)lines.push('Archived '+dmy(archived)+'.');
    if(!worksheetTouched(form)){
      lines.push('No worksheet answers stored for this visit.');
      return lines.join('\n');
    }
    if(clean(form.tech))lines.push('Technician: '+clean(form.tech)+'.');
    const n=+form.alarms||0;
    const alarms=(form.al||[]).slice(0,n);
    if(n)lines.push(n+' alarm'+(n===1?'':'s')+'.');
    const news=alarms.filter(function(a){return a&&a.isNew}).length;
    if(news)lines.push(news+' new alarm'+(news===1?'':'s')+'.');
    const nos=[];
    let anyYes=false;
    alarms.forEach(function(a,i){
      if(!a||!a.yn)return;
      Object.keys(YN).forEach(function(k){
        if(a.yn[k]==='No')nos.push('Alarm '+(i+1)+' '+YN[k]);
        else if(a.yn[k]==='Yes')anyYes=true;
      });
    });
    if(nos.length)lines.push('Not yes: '+nos.join(', ')+'.');
    else if(anyYes)lines.push('Recorded checks are Yes.');
    else lines.push('No inspection answers stored for this visit.');
    const notes=scrubCopiedNotes(form.comments,job);
    if(notes)lines.push('Notes: '+(notes.length>240?notes.slice(0,240)+'…':notes));
    const wd=form.date?String(form.date).slice(0,10):'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(wd)&&wd!==day)lines.push('Worksheet date '+dmy(wd)+'.');
    return lines.join('\n');
  }
  function mergeVisitDescription(existing,block,job){
    const text=plainText(existing);
    const without=text.replace(/\[CCSA visit\][\s\S]*?\[\/CCSA visit\]\n?/g,'').trim();
    const kept=stripTenantDetails(without,job).trim();
    const body=stripTenantDetails(String(block||'').trim(),job).trim();
    const wrapped=OPEN+'\n'+body+'\n'+CLOSE;
    return (kept?kept+'\n\n':'')+wrapped+'\n';
  }
  function buildEventPatch(description){
    return {colorId:BASIL_EVENT_COLOR_ID,description:description};
  }
  function remoteDay(remote){
    if(!remote)return '';
    if(remote.iso)return eventDay(remote);
    const st=remote.start||{};
    if(st.date)return String(st.date).slice(0,10);
    if(st.dateTime)return sydneyDay(st.dateTime)||String(st.dateTime).slice(0,10);
    return '';
  }
  function isSeriesMaster(remote){
    return !!(remote&&Array.isArray(remote.recurrence)&&remote.recurrence.length);
  }
  async function syncVisit(opts){
    opts=opts||{};
    const job=opts.job,form=opts.form,events=opts.events||[];
    const colorId=basilColorIdFromPalette(opts.palette);
    if(!colorId)return {ok:false,pending:true,status:'palette',error:'Basil colour id was not verified. Calendar was not changed.'};
    const match=matchVisitEvent(job,events,form,opts.matches);
    if(match.status!=='ok')return {ok:false,pending:false,status:match.status,reason:match.reason,day:match.day};
    if(opts.offline)return {ok:false,pending:true,status:'offline',eventId:match.event.id,day:match.day,error:'offline'};
    const transport=opts.transport;
    if(!transport)return {ok:false,pending:true,status:'error',eventId:match.event.id,error:'no transport'};
    let remote;
    try{remote=await transport.get(match.event.id)}
    catch(e){return {ok:false,pending:true,status:'error',eventId:match.event.id,day:match.day,error:String(e&&e.message||e)}}
    if(!remote||remote.id&&remote.id!==match.event.id)return {ok:false,pending:false,status:'absent',reason:'remote-id',eventId:match.event.id,day:match.day};
    if(isSeriesMaster(remote))return {ok:false,pending:false,status:'ambiguous',reason:'series-master',eventId:match.event.id,day:match.day};
    const gotDay=remoteDay(remote);
    if(gotDay&&gotDay!==match.day)return {ok:false,pending:false,status:'absent',reason:'remote-day',eventId:match.event.id,day:match.day};
    const description=mergeVisitDescription(remote.description,visitBlock(job,form,match.day),job);
    const patch=buildEventPatch(description);
    if(String(remote.colorId||'')===colorId&&String(remote.description||'')===description){
      return {ok:true,pending:false,status:'current',eventId:match.event.id,day:match.day,patch:patch,skippedWrite:true};
    }
    try{await transport.patch(match.event.id,patch,{sendUpdates:'none'})}
    catch(e){return {ok:false,pending:true,status:'error',eventId:match.event.id,day:match.day,error:String(e&&e.message||e),patch:patch}}
    return {ok:true,pending:false,status:'updated',eventId:match.event.id,day:match.day,patch:patch};
  }
  function summariseResults(results){
    results=results||[];
    const count=function(s){return results.filter(function(r){return r.status===s}).length};
    const bits=[];
    const upd=count('updated'),cur=count('current');
    if(upd)bits.push(upd+' event'+(upd===1?'':'s')+' marked Basil');
    if(cur)bits.push(cur+' already up to date');
    const absent=count('absent')+count('noid');
    if(absent)bits.push(absent+' not matched to one event');
    if(count('ambiguous'))bits.push(count('ambiguous')+' ambiguous and left unchanged');
    if(count('not-archived'))bits.push(count('not-archived')+' not archived, left unchanged');
    const held=results.filter(function(r){return r.pending}).length;
    if(held)bits.push(held+' not updated on the calendar');
    if(!bits.length)return 'Calendar was not changed.';
    return 'Calendar: '+bits.join(', ')+'.';
  }
  return {
    BASIL_EVENT_COLOR_ID:BASIL_EVENT_COLOR_ID,
    BASIL_EVENT_BG:BASIL_EVENT_BG,
    basilColorIdFromPalette:basilColorIdFromPalette,
    matchVisitEvent:matchVisitEvent,
    visitBlock:visitBlock,
    mergeVisitDescription:mergeVisitDescription,
    stripTenantDetails:stripTenantDetails,
    buildEventPatch:buildEventPatch,
    syncVisit:syncVisit,
    summariseResults:summariseResults,
    worksheetTouched:worksheetTouched,
    visitDay:visitDay
  };
});
