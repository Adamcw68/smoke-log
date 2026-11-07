const test=require('node:test');
const assert=require('node:assert/strict');
const jr=require('./jobrefresh.js');

function job(over){
  return Object.assign({
    id:'j1',addr:'1 River St, Yamba NSW 2464',street:'1 River St',town:'Yamba',
    agent:'Ray White',contact:'Pat Tenant',p1:'0412000001',directions:'key safe 1111',
    svc:'2026-11-04T09:00:00+11:00',notes:'Passed 2019',last:'2019-11-04',ic:'',
    arch:null,calEventId:'ev-2026'
  },over||{});
}
function form(over){
  return Object.assign({
    date:'2026-11-04',addr:'1 River St, Yamba NSW 2464',agent:'Ray White',
    done:true,comments:'Gate code works',al:[{yn:{cleaned:'Yes'},isNew:false}],photos:['p1'],tech:'Adam Westerman'
  },over||{});
}
function event(over){
  return Object.assign({
    id:'ev-2026',status:'confirmed',iso:'2026-11-04T09:00:00+11:00',
    summary:'1 River St Yamba',location:'1 River St, Yamba NSW 2464',
    description:'Contact: Pat Tenant\nPhone: 0412000001\nAccess: key safe 1111\nAgent: Ray White\nLast visit: 12 Mar 2025 Passed\n'
  },over||{});
}
const sameAddr=function(j,ev){return String(ev.location||'').indexOf('1 River')>=0};

test('stored event id is used and a moved time keeps the inspection',function(){
  const j=job(),f=form();
  const target=jr.resolveRefreshTarget(j,[event({id:'other',iso:'2026-11-04T15:00:00+11:00'}),event({id:'ev-2026',iso:'2026-11-05T10:30:00+11:00'})],sameAddr);
  assert.equal(target.eventId,'ev-2026');
  assert.equal(target.writes,false);
  const moved=event({iso:'2026-11-05T10:30:00+11:00',location:'1 River St, Yamba NSW 2464'});
  const patch=jr.appointmentPatch(j,f,moved,{calendarId:'cal-1'});
  assert.equal(patch.job.svc,'2026-11-05T10:30:00+11:00');
  assert.equal(patch.formPatch.date,'2026-11-05');
  assert.equal(patch.preserved.done,true);
  assert.equal(patch.preserved.comments,'Gate code works');
  assert.deepEqual(patch.preserved.alarms,f.al);
  assert.deepEqual(patch.preserved.photos,['p1']);
  assert.equal(patch.preserved.notes,'Passed 2019');
  assert.equal(patch.job.notes,'Passed 2019');
  assert.equal(patch.job.last,'2019-11-04');
  assert.equal(patch.writes,false);
  assert.equal(j.svc,'2026-11-04T09:00:00+11:00');
});

test('a service date the user changed is not replaced when the appointment moves',function(){
  const moved=jr.appointmentPatch(job(),form({date:'2026-11-06'}),event({iso:'2026-11-05T10:30:00+11:00'}));
  assert.equal(moved.formPatch.date,undefined);
  assert.equal(moved.job.svc,'2026-11-05T10:30:00+11:00');
  assert.equal(moved.job.notes,'Passed 2019');
  assert.equal(moved.preserved.done,true);
});

test('legacy match is used only when one event fits, otherwise the worksheet stays',function(){
  const bare=job({calEventId:''});
  const one=jr.resolveRefreshTarget(bare,[event({id:'only'})],sameAddr);
  assert.equal(one.status,'unique');
  assert.equal(one.eventId,'only');
  const two=jr.resolveRefreshTarget(bare,[event({id:'a',iso:'2026-11-04T09:00:00+11:00'}),event({id:'b',iso:'2027-11-04T09:00:00+11:00'})],sameAddr);
  assert.equal(two.status,'ambiguous');
  assert.equal(two.ok,false);
  assert.match(two.message,/not changed/);
  const none=jr.resolveRefreshTarget(bare,[],sameAddr);
  assert.equal(none.status,'absent');
});

test('cancelled, missing and wrong event do not change the job',function(){
  assert.equal(jr.classifyRemote({id:'ev-2026',status:'cancelled'},'ev-2026').status,'cancelled');
  assert.equal(jr.classifyRemote(null,'ev-2026').status,'missing');
  assert.equal(jr.classifyRemote({id:'other',status:'confirmed'},'ev-2026').status,'mismatch');
  assert.match(jr.failureMessage('offline'),/not changed/);
  assert.match(jr.failureMessage('permission'),/not changed/);
  const before=job();
  const copy=JSON.parse(JSON.stringify(before));
  jr.classifyRemote({id:'ev-2026',status:'cancelled'},'ev-2026');
  assert.deepEqual(before,copy);
});

test('an archived job does not take tenant contact back from the event',function(){
  const j=job({arch:'2026-11-04T02:30:00.000Z',contact:'',p1:''});
  const ev=event({description:'Contact: Pat Tenant\nPhone: 0412000001\nEmail: pat@example.com\nAccess: side gate\nPassed 2019\n'});
  const patch=jr.appointmentPatch(j,form({done:true,comments:'Hallway done'}),ev);
  assert.equal(patch.job.contact,'');
  assert.equal(patch.job.p1,'');
  assert.equal(patch.job.directions,'side gate');
  assert.equal(patch.job.arch,j.arch);
  assert.equal(patch.preserved.done,true);
  assert.equal(patch.preserved.comments,'Hallway done');
  assert.equal(patch.job.notes,'Passed 2019');
  assert.equal(patch.writes,false);
});
