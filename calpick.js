/* Which Google Calendar this signed-in technician reads and updates.
   Adam keeps the shared jobs calendar. Everyone else starts on their primary calendar.
   A job remembers the calendar it came from, and a colour update is only sent there. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSACalPick=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ADAM_EMAIL='bearus69@gmail.com';
  const SHARED_ID='a7rbih2gfr6rcfol434u08lt4k@group.calendar.google.com';
  const SHARED_NAME='Smoke alarm calendar';
  const EVENTS_SCOPE='https://www.googleapis.com/auth/calendar.events';
  const LIST_SCOPE='https://www.googleapis.com/auth/calendar.calendarlist.readonly';
  const STORE_KEY='ccsa.calpick.v1';

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function emailOf(v){return clean(v).toLowerCase()}
  function loginHint(email){
    const e=emailOf(email);
    return e.indexOf('@')>0?e:'';
  }
  function defaultChoice(email){
    if(emailOf(email)===ADAM_EMAIL)return {id:SHARED_ID,summary:SHARED_NAME,source:'default'};
    return {id:'primary',summary:'Primary calendar',source:'default'};
  }
  function readMap(storage){
    try{
      const raw=storage&&storage.getItem?storage.getItem(STORE_KEY):'';
      const data=raw?JSON.parse(raw):{};
      return data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    }catch(e){return {}}
  }
  function writeMap(storage,map){
    if(!storage||!storage.setItem)return;
    storage.setItem(STORE_KEY,JSON.stringify(map));
  }
  function recall(storage,email){
    const e=emailOf(email);
    if(!e)return null;
    const row=readMap(storage)[e];
    if(!row||!row.id)return null;
    return {id:String(row.id),summary:clean(row.summary)||String(row.id),updated:row.updated||'',source:'saved'};
  }
  function remember(storage,email,choice){
    const e=emailOf(email);
    if(!e||!choice||!choice.id)return null;
    const map=readMap(storage);
    const row={id:String(choice.id),summary:clean(choice.summary)||String(choice.id),updated:choice.updated||new Date().toISOString()};
    map[e]=row;
    writeMap(storage,map);
    return {id:row.id,summary:row.summary,updated:row.updated,source:'saved'};
  }
  function normaliseList(items){
    return (items||[]).map(function(item){
      if(!item||!item.id)return null;
      return {id:String(item.id),summary:clean(item.summary)||String(item.id),primary:!!item.primary};
    }).filter(Boolean);
  }
  function chooseFromList(email,items){
    const list=normaliseList(items);
    const fallback=defaultChoice(email);
    if(emailOf(email)===ADAM_EMAIL){
      const shared=list.filter(function(item){return item.id===SHARED_ID})[0];
      return {id:SHARED_ID,summary:shared?shared.summary:SHARED_NAME,source:'default'};
    }
    const primary=list.filter(function(item){return item.primary})[0];
    if(primary)return {id:primary.id,summary:primary.summary,source:'primary'};
    if(list[0])return {id:list[0].id,summary:list[0].summary,source:'list'};
    return fallback;
  }
  function withChoice(list,choice){
    const rows=normaliseList(list);
    if(choice&&choice.id&&!rows.some(function(item){return item.id===choice.id}))rows.unshift({id:choice.id,summary:choice.summary||choice.id,primary:false});
    return rows;
  }
  function primaryId(list){
    const row=normaliseList(list).filter(function(item){return item.primary})[0];
    return row?row.id:'';
  }
  /* "primary" and the account's real primary id are the same calendar. */
  function sameCalendar(a,b,list){
    const left=String(a||''),right=String(b||'');
    if(!left||!right)return false;
    if(left===right)return true;
    const real=primaryId(list);
    if(!real)return false;
    const norm=function(id){return id==='primary'?real:id};
    return norm(left)===norm(right);
  }
  /* A job is patched only on the calendar it was imported from. */
  function patchCalendarId(job,activeId,list){
    const own=job&&job.calCalendarId?String(job.calCalendarId):'';
    if(!own)return String(activeId||'');
    if(own==='primary'){const real=primaryId(list);if(real)return real}
    return own;
  }
  function mayPatch(job,activeId,list){
    const own=job&&job.calCalendarId?String(job.calCalendarId):'';
    if(!own)return true;
    return sameCalendar(own,activeId,list);
  }
  return {
    ADAM_EMAIL:ADAM_EMAIL,SHARED_ID:SHARED_ID,SHARED_NAME:SHARED_NAME,
    EVENTS_SCOPE:EVENTS_SCOPE,LIST_SCOPE:LIST_SCOPE,STORE_KEY:STORE_KEY,
    loginHint:loginHint,defaultChoice:defaultChoice,recall:recall,remember:remember,
    normaliseList:normaliseList,chooseFromList:chooseFromList,withChoice:withChoice,
    sameCalendar:sameCalendar,patchCalendarId:patchCalendarId,mayPatch:mayPatch
  };
});
