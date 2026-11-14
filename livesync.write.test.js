const test=require('node:test');
const assert=require('node:assert/strict');
require('./transfer.js');
const sync=require('./livesync.js');

test('a newer timestamp with the same worksheet is not uploaded again',function(){
  const job={id:'a',addr:'1 Circle St, Yamba NSW 2464',agent:'RWY',order:1,updated:'2026-11-14T01:00:00.000Z'};
  const form={date:'2026-11-14',comments:'Hallway',updated:'2026-11-14T01:00:00.000Z',alarms:1,al:[{yn:{cleaned:'Yes'}}]};
  const touched=Object.assign({},form,{updated:'2026-11-14T09:00:00.000Z'});
  assert.equal(sync.contentSig(job,form),sync.contentSig(Object.assign({},job,{updated:'2026-11-14T09:00:00.000Z'}),touched));
  assert.equal(sync.needsPush(job,touched,job,form),false);
  const changed=Object.assign({},form,{comments:'Replaced the hallway alarm'});
  assert.equal(sync.needsPush(job,changed,job,form),true);
  assert.equal(sync.needsPush(job,form,null,null),true);
});

test('a snapshot of the same content does not queue another write',function(){
  const localJob={id:'a',addr:'1 Circle St',agent:'RWY',order:1,updated:'2026-11-14T02:00:00.000Z'};
  const localForm={date:'2026-11-14',comments:'done',updated:'2026-11-14T02:00:00.000Z',alarms:1,al:[]};
  const remoteJob=Object.assign({},localJob,{updated:'2026-11-14T01:00:00.000Z'});
  const remoteForm=Object.assign({},localForm,{updated:'2026-11-14T01:00:00.000Z'});
  const out=sync.reconcile(
    {jobs:[localJob],forms:{a:localForm},photos:[],tombstones:[]},
    {jobs:[remoteJob],forms:{a:remoteForm},photos:[],tombstones:[]}
  );
  assert.equal(out.pushJobs.includes('a'),false);
});

test('a normal day of 20 jobs stays well under 1000 writes',function(){
  const steps=[];
  for(let i=0;i<20;i++)steps.push({type:'edit',id:'job-'+i,comments:'Serviced alarm '+i,at:'2026-11-14T01:'+String(i).padStart(2,'0')+':00.000Z'});
  steps.push({type:'calendar'});
  const reversed=[];
  for(let i=19;i>=0;i--)reversed.push('job-'+i);
  steps.push({type:'reorder',ids:reversed});
  for(let n=0;n<3;n++)steps.push({type:'reload',at:'2026-11-14T03:0'+n+':00.000Z'});
  for(let i=0;i<20;i++)steps.push({type:'open',id:'job-'+i,at:'2026-11-14T04:'+String(i).padStart(2,'0')+':00.000Z'});
  const writes=sync.simulateSyncDay(20,steps);
  assert.equal(writes,40);
  assert.ok(writes<1000);
});

test('the daily write limit stops retries and leaves local worksheets alone',function(){
  assert.equal(sync.isQuotaError({code:'resource-exhausted'}),true);
  assert.equal(sync.isQuotaError({status:429,message:'Quota exceeded'}),true);
  assert.equal(sync.isQuotaError({code:'unavailable',message:'offline'}),false);
  const msg=sync.quotaMessage();
  assert.match(msg,/daily write limit/);
  assert.match(msg,/stay on this phone/);
  assert.match(msg,/Nothing on this phone was cleared/);
  assert.equal(sync.statusLabel({configured:true,user:{uid:'u'},phase:'paused'}),'Sync paused');
  const panel=sync.panelHTML({configured:true,user:{email:'adam@example.com',uid:'u'},phase:'paused',error:msg});
  assert.match(panel,/Sync paused/);
  assert.match(panel,/daily write limit/);
  assert.match(panel,/Nothing on this phone was cleared/);
});
