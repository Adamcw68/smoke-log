const test=require('node:test');
const assert=require('node:assert/strict');
require('./transfer.js');
const sync=require('./livesync.js');

function job(id,addr,updated,agent){
  return {id:id,addr:addr,ident:'',due:'2026-11-09',agent:agent||'',section:'Holiday',p1:'0400 111 222',updated:updated};
}
function form(updated,db,agent){
  return {updated:updated,agent:agent,tenancy:'Holiday',tech:'Adam Westerman',date:'2026-11-09',alarms:1,comments:'',al:[{db:db,yn:{cleaned:'Yes',battery:'Yes'},power:['240v'],room:'Hallway',photos:[]}],photos:[]};
}

test('placeholders turn sync off and a real config leaves it on',function(){
  assert.equal(sync.configReady(null),false);
  assert.equal(sync.configReady({apiKey:'YOUR_API_KEY',authDomain:'YOUR_PROJECT_ID.firebaseapp.com',projectId:'YOUR_PROJECT_ID',appId:'YOUR_APP_ID'}),false);
  assert.equal(sync.configReady({apiKey:'AIzaSyExample',authDomain:'ccsa-smoke-log.firebaseapp.com',projectId:'ccsa-smoke-log',appId:'1:1:web:abc'}),true);
});

test('iOS home screen uses redirect and a normal browser uses the popup',function(){
  assert.equal(sync.preferRedirect({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',standalone:true}),true);
  assert.equal(sync.preferRedirect({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',standalone:false,displayMode:'browser'}),false);
  assert.equal(sync.preferRedirect({userAgent:'Mozilla/5.0 (Windows NT 10.0)',standalone:false}),false);
});

test('a photo that cannot fit in one Firestore record stays local',function(){
  assert.equal(sync.photoFits(200000),true);
  assert.equal(sync.photoFits(900000),false);
  assert.equal(sync.photoFits(0),false);
});

test('the status line uses the four sync states',function(){
  assert.equal(sync.statusLabel({configured:false}),"Sync isn't set up yet");
  assert.equal(sync.statusLabel({configured:true,user:null}),'Not signed in');
  assert.equal(sync.statusLabel({configured:true,user:{uid:'u'},phase:'syncing'}),'Syncing');
  assert.equal(sync.statusLabel({configured:true,user:{uid:'u'},phase:'offline'}),'Offline - changes saved on this device');
  assert.equal(sync.statusLabel({configured:true,user:{uid:'u'},phase:'synced'}),'Synced');
  assert.match(sync.panelHTML({configured:true,user:null}),/Sign in/);
  assert.match(sync.panelHTML({configured:true,user:{email:'adam@example.com',uid:'u'},phase:'synced',lastSync:'2026-11-09T08:00:00.000Z'}),/adam@example.com/);
  assert.match(sync.panelHTML({configured:true,user:{uid:'u'},phase:'synced'}),/Make PDF/);
});

test('first sign-in keeps local jobs and remote jobs, and the newer worksheet wins',function(){
  const local={
    jobs:[job('a','1 Circle St, Yamba NSW 2464','2026-11-09T02:00:00.000Z','RWY'),job('desk','9 Desk St, Yamba NSW 2464','2026-11-08T00:00:00.000Z','Desk')],
    forms:{a:form('2026-11-09T02:00:00.000Z','99.5','RWY'),desk:form('2026-11-08T00:00:00.000Z','70','Desk')},
    photos:[{id:'local-shot',ts:'2026-11-09T02:00:00.000Z'}],
    tombstones:[]
  };
  const remote={
    jobs:[job('a','1 Circle St, Yamba NSW 2464','2026-11-01T00:00:00.000Z','Old'),job('extra','2 Extra St, Yamba NSW 2464','2026-11-09T01:00:00.000Z','LIFE')],
    forms:{a:form('2026-11-01T00:00:00.000Z','80','Old'),extra:form('2026-11-09T01:00:00.000Z','','LIFE')},
    photos:[{id:'remote-shot',ts:'2026-11-09T01:00:00.000Z',b64:'aaa'}],
    tombstones:[]
  };
  const out=sync.reconcile(local,remote);
  const circle=out.jobs.find(j=>j.id==='a');
  assert.equal(out.forms.a.al[0].db,'99.5');
  assert.equal(out.forms.a.agent,'RWY');
  assert.equal(circle.agent,'RWY');
  assert.ok(out.jobs.some(j=>j.id==='desk'));
  assert.ok(out.jobs.some(j=>j.id==='extra'));
  assert.equal(out.forms.desk.al[0].db,'70');
  assert.ok(out.pushJobs.includes('a'));
  assert.ok(out.pushJobs.includes('desk'));
  assert.ok(!out.pushJobs.includes('extra'));
  assert.deepEqual(out.pullPhotos.map(p=>p.id),['remote-shot']);
  assert.deepEqual(out.pushPhotos,['local-shot']);
  assert.equal(out.dropJobs.length,0);
});

test('an older edit does not replace a newer one, and a newer delete removes the job',function(){
  const newer={
    jobs:[job('a','1 Circle St, Yamba NSW 2464','2026-11-09T05:00:00.000Z','RWY')],
    forms:{a:form('2026-11-09T05:00:00.000Z','99.5','RWY')},
    photos:[{id:'p1',ts:'2026-11-09T05:00:00.000Z'}],
    tombstones:[]
  };
  const older={
    jobs:[job('a','1 Circle St, Yamba NSW 2464','2026-11-08T00:00:00.000Z','Old')],
    forms:{a:form('2026-11-08T00:00:00.000Z','1','Old')},
    photos:[{id:'p1',ts:'2026-11-01T00:00:00.000Z',b64:'old'}],
    tombstones:[]
  };
  const kept=sync.reconcile(newer,older);
  assert.equal(kept.forms.a.al[0].db,'99.5');
  assert.equal(kept.pushJobs.includes('a'),true);
  assert.equal(kept.pullPhotos.length,0);
  const deleted=sync.reconcile(newer,{jobs:[],forms:{},photos:[],tombstones:[{kind:'job',id:'a',at:'2026-11-09T06:00:00.000Z'}]});
  assert.equal(deleted.jobs.some(j=>j.id==='a'),false);
  assert.ok(deleted.dropJobs.includes('a'));
  const editedAfter=sync.reconcile(newer,{jobs:[],forms:{},photos:[],tombstones:[{kind:'job',id:'a',at:'2026-11-09T01:00:00.000Z'}]});
  assert.equal(editedAfter.forms.a.al[0].db,'99.5');
});

test('offline edits stay queued until the device is online',function(){
  let box=[];
  box=sync.queueOp(box,{op:'job',id:'a'});
  box=sync.queueOp(box,{op:'job',id:'a'});
  box=sync.queueOp(box,{op:'photo',id:'p1'});
  assert.equal(box.length,2);
  const held=sync.drainOps(box,false);
  assert.equal(held.send.length,0);
  assert.equal(held.keep.length,2);
  const sent=sync.drainOps(box,true);
  assert.equal(sent.send.length,2);
  assert.equal(sent.keep.length,0);
});
