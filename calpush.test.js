const test=require('node:test');
const assert=require('node:assert/strict');
const cal=require('./calpush.js');

const PALETTE={event:{'10':{background:'#51b749',foreground:'#1d1d1d'},'2':{background:'#7ae7bf',foreground:'#1d1d1d'}}};
const SAME=function(job,ev){return ev.addr===job.addr};

function job(over){
  return Object.assign({
    id:'j1',addr:'1 River St, Yamba',arch:'2026-11-04T02:30:00.000Z',
    svc:'2026-11-04T09:00:00+11:00',notes:'Passed 2019',last:'2019-11-04',calEventId:'ev-2026',
    contact:'Pat Tenant',p1:'0412000001',p2:'jane.smith@example.com'
  },over||{});
}
function ev(over){
  return Object.assign({
    id:'ev-2026',addr:'1 River St, Yamba',iso:'2026-11-04T09:00:00+11:00',
    summary:'1 River St Yamba',location:'1 River St, Yamba NSW 2464',
    description:'Tenant: Pat Tenant\nPhone: 0412 000 001\nEmail: jane.smith@example.com\nContact: Pat Tenant 0412000001\n\nAccess: key safe 2291\nWarning: dog in the yard\nLast visit: 12 Mar 2025 Passed — Pat Tenant 0412000001\n'
  },over||{});
}
function form(over){
  return Object.assign({
    updated:'2026-11-04T01:00:00.000Z',date:'2026-11-04',tech:'Adam Westerman',done:true,alarms:2,comments:'Gate code works',
    al:[
      {isNew:false,yn:{comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes',cleaned:'Yes'}},
      {isNew:true,yn:{comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes'}}
    ]
  },over||{});
}
function transport(remote,calls){
  calls.get=[];calls.patch=[];
  return {
    get:async function(id){calls.get.push(id);if(remote.error)throw new Error(remote.error);return remote.body},
    patch:async function(id,body,q){calls.patch.push({id,body,q});if(remote.patchError)throw new Error(remote.patchError);return {id,body}}
  };
}

test('basil is event colour 10 only when the official background matches',function(){
  assert.equal(cal.basilColorIdFromPalette(PALETTE),'10');
  assert.equal(cal.basilColorIdFromPalette({event:{'10':{background:'#b3dc6c'}}}),null);
  assert.equal(cal.basilColorIdFromPalette({calendar:{'8':{background:'#0b8043'}}}),null);
  assert.equal(cal.BASIL_EVENT_COLOR_ID,'10');
});

test('archive success strips tenant details and keeps the inspection',async function(){
  const calls={};
  const j=job();
  const f=form({comments:'Gate code works. Tenant: Pat Tenant 0412000001 jane.smith@example.com'});
  const other=ev({id:'ev-2025',iso:'2025-11-04T09:00:00+11:00',addr:'1 River St, Yamba',description:'Tenant: Someone Else\nPhone: 0499000000'});
  const remote=ev();
  remote.body={id:'ev-2026',colorId:'2',description:remote.description,summary:'1 River St Yamba',location:remote.location,start:{dateTime:remote.iso},attendees:[{email:'agent@example.com'}]};
  const res=await cal.syncVisit({job:j,form:f,events:[ev(),other],matches:SAME,palette:PALETTE,transport:transport(remote,calls)});
  assert.equal(res.ok,true);
  assert.equal(res.status,'updated');
  assert.equal(res.eventId,'ev-2026');
  assert.deepEqual(Object.keys(res.patch),['colorId','description']);
  assert.equal(res.patch.colorId,'10');
  assert.equal(calls.patch.length,1);
  assert.equal(calls.patch[0].id,'ev-2026');
  assert.deepEqual(calls.patch[0].q,{sendUpdates:'none'});
  assert.equal(calls.patch[0].body.summary,undefined);
  assert.equal(calls.patch[0].body.location,undefined);
  assert.equal(calls.patch[0].body.start,undefined);
  assert.equal(calls.patch[0].body.attendees,undefined);
  const desc=calls.patch[0].body.description;
  assert.equal(calls.patch.map(p=>p.id).join(','),'ev-2026');
  assert.equal(other.description.includes('Someone Else'),true);
  assert.equal(j.contact,'Pat Tenant');
  assert.equal(j.p1,'0412000001');
  assert.match(f.comments,/0412000001/);
  assert.match(desc,/Access: key safe 2291/);
  assert.match(desc,/Warning: dog in the yard/);
  assert.match(desc,/Last visit: 12 Mar 2025 Passed/);
  assert.doesNotMatch(desc,/Tenant:/i);
  assert.doesNotMatch(desc,/Contact:/i);
  assert.doesNotMatch(desc,/Phone:/i);
  assert.doesNotMatch(desc,/Email:/i);
  assert.doesNotMatch(desc,/Pat Tenant/);
  assert.doesNotMatch(desc,/0412/);
  assert.doesNotMatch(desc,/jane\.smith@example\.com/);
  assert.match(desc,/Visit 4 Nov 2026/);
  assert.match(desc,/Technician: Adam Westerman/);
  assert.match(desc,/1 new alarm/);
  assert.match(desc,/Recorded checks are Yes/);
  assert.match(desc,/Notes: Gate code works/);
  assert.equal(desc.match(/\[CCSA visit\]/g).length,1);
  assert.doesNotMatch(desc.split('[CCSA visit]')[1],/Passed/);
  assert.doesNotMatch(desc,/Passed 2019/);
});

test('offline and failed writes stay pending and do not claim success',async function(){
  const off=await cal.syncVisit({job:job(),form:form(),events:[ev()],matches:SAME,palette:PALETTE,offline:true,transport:{get:async function(){throw new Error('should not get')},patch:async function(){throw new Error('should not patch')}}});
  assert.equal(off.ok,false);
  assert.equal(off.pending,true);
  assert.equal(off.status,'offline');
  const calls={};
  const fail=await cal.syncVisit({job:job(),form:form(),events:[ev()],matches:SAME,palette:PALETTE,transport:transport({error:'offline',body:null},calls)});
  assert.equal(fail.ok,false);
  assert.equal(fail.pending,true);
  assert.equal(fail.status,'error');
  assert.equal(calls.patch.length,0);
  const calls2={};
  const remote={body:{id:'ev-2026',description:ev().description,colorId:'2',start:{dateTime:ev().iso}},patchError:'network down'};
  const again=await cal.syncVisit({job:job(),form:form(),events:[ev()],matches:SAME,palette:PALETTE,transport:transport(remote,calls2)});
  assert.equal(again.ok,false);
  assert.equal(again.pending,true);
  assert.match(again.error,/network down/);
  const calls3={};
  const retry=await cal.syncVisit({job:job(),form:form(),events:[ev()],matches:SAME,palette:PALETTE,transport:transport({body:{id:'ev-2026',description:ev().description,colorId:'2',start:{dateTime:ev().iso}}},calls3)});
  assert.equal(retry.ok,true);
  assert.equal(retry.pending,false);
  assert.equal(retry.status,'updated');
});

test('repeating the sync does not duplicate the visit block',async function(){
  const first=cal.mergeVisitDescription(ev().description,cal.visitBlock(job(),form(),'2026-11-04'),job());
  const second=cal.mergeVisitDescription(first,cal.visitBlock(job(),form(),'2026-11-04'),job());
  assert.doesNotMatch(first,/0412/);
  assert.doesNotMatch(first,/Pat Tenant/);
  assert.equal(first,second);
  assert.equal(first.match(/\[CCSA visit\]/g).length,1);
  const calls={};
  const res=await cal.syncVisit({job:job(),form:form(),events:[ev()],matches:SAME,palette:PALETTE,transport:transport({body:{id:'ev-2026',colorId:'10',description:first,start:{dateTime:ev().iso}}},calls)});
  assert.equal(res.status,'current');
  assert.equal(res.skippedWrite,true);
  assert.equal(calls.patch.length,0);
});

test('absent, ambiguous, other year, and series master are not written',async function(){
  const calls={get:[],patch:[]};
  const transportSpy={
    get:async function(id){calls.get.push(id);return {id:id,recurrence:['RRULE:FREQ=YEARLY'],description:'',start:{dateTime:'2026-11-04T09:00:00+11:00'}}},
    patch:async function(){calls.patch.push('x');throw new Error('no')}
  };
  const absent=await cal.syncVisit({job:job(),form:form(),events:[ev({id:'ev-2025',iso:'2025-11-04T09:00:00+11:00'})],matches:SAME,palette:PALETTE,transport:transportSpy});
  assert.equal(absent.status,'absent');
  assert.equal(absent.pending,false);
  const amb=await cal.syncVisit({job:job({calEventId:'',svc:'2026-11-04T00:00:00+11:00'}),form:form(),events:[ev({id:'a',iso:'2026-11-04T09:00:00+11:00'}),ev({id:'b',iso:'2026-11-04T13:00:00+11:00'})],matches:SAME,palette:PALETTE,transport:transportSpy});
  assert.equal(amb.status,'ambiguous');
  const master=await cal.syncVisit({job:job(),form:form(),events:[ev()],matches:SAME,palette:PALETTE,transport:transportSpy});
  assert.equal(master.status,'ambiguous');
  assert.equal(master.reason,'series-master');
  assert.equal(calls.patch.length,0);
});

test('imported Passed history does not become this visit result',function(){
  const block=cal.visitBlock(job(),null,'2026-11-04');
  assert.match(block,/No worksheet answers stored/);
  assert.doesNotMatch(block,/Passed/);
  assert.doesNotMatch(block,/2019/);
  const blank=cal.visitBlock(job(),{tech:'Adam Westerman',alarms:4,date:'2026-11-04',al:[],comments:''},'2026-11-04');
  assert.match(blank,/No worksheet answers stored/);
  assert.doesNotMatch(blank,/Adam Westerman/);
  assert.doesNotMatch(blank,/4 alarms/);
});

test('unarchived and done-but-not-archived worksheets are not marked complete',async function(){
  const calls={get:0,patch:0};
  const transportSpy={get:async function(){calls.get++;return {}},patch:async function(){calls.patch++}};
  const open=await cal.syncVisit({job:job({arch:null,done:true}),form:form(),events:[ev()],matches:SAME,palette:PALETTE,transport:transportSpy});
  assert.equal(open.status,'not-archived');
  assert.equal(open.ok,false);
  const doneOnly=await cal.syncVisit({job:job({arch:''}),form:form({done:true}),events:[ev()],matches:SAME,palette:PALETTE,transport:transportSpy});
  assert.equal(doneOnly.status,'not-archived');
  assert.equal(calls.get,0);
  assert.equal(calls.patch,0);
});

test('explicit No answers are kept and Yes is not invented',function(){
  const f=form({al:[{isNew:false,yn:{cleaned:'No',comply:'Yes'}},{isNew:false,yn:{}}]});
  const block=cal.visitBlock(job(),f,'2026-11-04');
  assert.match(block,/Not yes: Alarm 1 cleaned/);
  assert.doesNotMatch(block,/Recorded checks are Yes/);
  assert.doesNotMatch(block,/Passed/);
});

test('summary reports backfill without calling a failure a success',function(){
  const msg=cal.summariseResults([
    {status:'updated',ok:true,pending:false},
    {status:'current',ok:true,pending:false},
    {status:'absent',ok:false,pending:false},
    {status:'ambiguous',ok:false,pending:false},
    {status:'offline',ok:false,pending:true}
  ]);
  assert.match(msg,/1 event marked Basil/);
  assert.match(msg,/1 already up to date/);
  assert.match(msg,/1 not matched/);
  assert.match(msg,/1 ambiguous and left unchanged/);
  assert.match(msg,/1 not updated on the calendar/);
});
