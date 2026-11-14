/* Firestore and Auth emulators only. Synthetic users. Does not use the live Firebase project. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,deleteDoc,onSnapshot}=require('firebase/firestore');
require('./transfer.js');
const sync=require('./livesync.js');
const portal=require('./portaldata.js');
const invoices=require('./invoice.js');

const PROJECT='demo-ccsa-log';
let env;

test.before(async()=>{
  env=await initializeTestEnvironment({
    projectId:PROJECT,
    firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}
  });
});
test.after(async()=>{if(env)await env.cleanup()});

test('another account cannot read these jobs, and a signed-out client cannot either',async()=>{
  await env.clearFirestore();
  const alice=env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(alice,'users/alice/jobs/circle'),{id:'circle',job:{id:'circle',addr:'1 Circle St',updated:'2026-11-09T01:00:00.000Z'},form:{updated:'2026-11-09T01:00:00.000Z',al:[{db:'99.5'}]},updated:'2026-11-09T01:00:00.000Z'}));
  const bob=env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(bob,'users/alice/jobs/circle')));
  await assertFails(setDoc(doc(bob,'users/alice/jobs/circle'),{id:'nope'}));
  const signedOut=env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(signedOut,'users/alice/jobs/circle')));
  await assertSucceeds(getDoc(doc(alice,'users/alice/jobs/circle')));
});

test('two devices for one account see a job, an offline edit, and a photo',async()=>{
  await env.clearFirestore();
  const auth=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'synthetic.sync@example.com',password:'synthetic-pass',returnSecureToken:true})
  });
  const created=await auth.json();
  assert.equal(auth.ok,true,JSON.stringify(created));
  const uid=created.localId;
  assert.ok(uid);
  const deviceA=env.authenticatedContext(uid).firestore();
  const deviceB=env.authenticatedContext(uid).firestore();
  const seen=[];
  const stop=onSnapshot(doc(deviceB,'users/'+uid+'/jobs/circle'),function(snap){if(snap.exists())seen.push(snap.data().form.al[0].db)});
  await setDoc(doc(deviceA,'users/'+uid+'/jobs/circle'),{id:'circle',job:{id:'circle',addr:'1 Circle St, Yamba NSW 2464',updated:'2026-11-09T01:00:00.000Z',agent:'RWY'},form:{updated:'2026-11-09T01:00:00.000Z',agent:'RWY',al:[{db:'80'}]},updated:'2026-11-09T01:00:00.000Z'});
  await new Promise(function(r){setTimeout(r,400)});
  assert.ok(seen.includes('80'));
  let box=sync.queueOp([],{op:'job',id:'circle'});
  const held=sync.drainOps(box,false);
  assert.equal(held.send.length,0);
  const local={jobs:[{id:'circle',addr:'1 Circle St, Yamba NSW 2464',updated:'2026-11-09T03:00:00.000Z',agent:'RWY',ident:'',due:'2026-11-09',section:'Holiday',p1:'0400 111 222'}],forms:{circle:{updated:'2026-11-09T03:00:00.000Z',agent:'RWY',tenancy:'Holiday',alarms:1,al:[{db:'99.5'}],photos:[]}},photos:[],tombstones:[]};
  const remoteNow=await getDoc(doc(deviceA,'users/'+uid+'/jobs/circle'));
  const remote={jobs:[remoteNow.data().job],forms:{circle:remoteNow.data().form},photos:[],tombstones:[]};
  const merged=sync.reconcile(local,remote);
  assert.equal(merged.forms.circle.al[0].db,'99.5');
  const sent=sync.drainOps(held.keep,true);
  assert.equal(sent.send.length,1);
  await setDoc(doc(deviceA,'users/'+uid+'/jobs/circle'),{id:'circle',job:merged.jobs.find(j=>j.id==='circle'),form:merged.forms.circle,updated:'2026-11-09T03:00:00.000Z'});
  await new Promise(function(r){setTimeout(r,400)});
  assert.ok(seen.includes('99.5'));
  const older=sync.reconcile(local,{jobs:[{id:'circle',addr:'1 Circle St, Yamba NSW 2464',updated:'2026-11-08T00:00:00.000Z',agent:'Old',ident:'',due:'2026-11-09'}],forms:{circle:{updated:'2026-11-08T00:00:00.000Z',agent:'Old',alarms:1,al:[{db:'1'}]}},photos:[],tombstones:[]});
  assert.equal(older.forms.circle.al[0].db,'99.5');
  if(sync.photoFits(120)){
    await setDoc(doc(deviceA,'users/'+uid+'/photos/shot'),{id:'shot',job:'circle',slot:'al0',type:'image/jpeg',w:2,h:2,ts:'2026-11-09T03:00:00.000Z',b64:'AQIDBAU='});
  }
  const photo=await getDoc(doc(deviceB,'users/'+uid+'/photos/shot'));
  assert.equal(photo.exists(),true);
  assert.equal(photo.data().b64,'AQIDBAU=');
  assert.equal(sync.photoFits(900000),false);
  stop();
});

test('an agency login reads only its own portal and cannot write',async()=>{
  await env.clearFirestore();
  const sample=portal.demoPortal();
  const rwm=sample.agencies.rwm;
  const life=sample.agencies.lifestyle;
  assert.ok(rwm&&life);
  assert.equal(portal.bundleClean(sample).length,0);
  await env.withSecurityRulesDisabled(async(ctx)=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'admins/adam'),{email:'adam@example.com',since:'2026-11-13'});
    await setDoc(doc(db,'agencyUsers/agent-rwm'),{agencyId:'rwm',agencyCode:'RWM',email:'rwm@example.com',role:'agent',createdAt:'2026-11-13T00:00:00.000Z',disabled:false});
    await setDoc(doc(db,'agencyUsers/agent-life'),{agencyId:'lifestyle',agencyCode:'Lifestyle',email:'life@example.com',role:'agent',createdAt:'2026-11-13T00:00:00.000Z',disabled:false});
    await setDoc(doc(db,'agencyUsers/agent-off'),{agencyId:'rwm',agencyCode:'RWM',email:'off@example.com',role:'agent',createdAt:'2026-11-13T00:00:00.000Z',disabled:true});
  });
  const admin=env.authenticatedContext('adam').firestore();
  const prop=rwm.properties[0];
  const job=rwm.jobs[0];
  const cert=rwm.certificates[0];
  const lifeProp=life.properties[0];
  await assertSucceeds(setDoc(doc(admin,'portal/rwm/properties/'+prop.id),prop));
  await assertSucceeds(setDoc(doc(admin,'portal/rwm/jobs/'+job.id),job));
  await assertSucceeds(setDoc(doc(admin,'portal/rwm/certificates/'+cert.id),cert));
  await assertSucceeds(setDoc(doc(admin,'portal/lifestyle/properties/'+lifeProp.id),lifeProp));
  await assertFails(setDoc(doc(admin,'portal/rwm/properties/'+prop.id),Object.assign({},prop,{contact:'Jane Tenant'})));
  await assertFails(setDoc(doc(admin,'portal/rwm/properties/'+prop.id),Object.assign({},prop,{address:'18 River Street 0400111222'})));
  const agent=env.authenticatedContext('agent-rwm').firestore();
  await assertSucceeds(getDoc(doc(agent,'portal/rwm/properties/'+prop.id)));
  await assertSucceeds(getDoc(doc(agent,'portal/rwm/certificates/'+cert.id)));
  await assertFails(getDoc(doc(agent,'portal/lifestyle/properties/'+lifeProp.id)));
  await assertFails(setDoc(doc(agent,'portal/rwm/jobs/'+job.id),job));
  await assertFails(getDoc(doc(agent,'users/adam/jobs/circle')));
  const other=env.authenticatedContext('agent-life').firestore();
  await assertFails(getDoc(doc(other,'portal/rwm/certificates/'+cert.id)));
  await assertSucceeds(getDoc(doc(other,'portal/lifestyle/properties/'+lifeProp.id)));
  await assertFails(getDoc(doc(other,'agencyUsers/agent-rwm')));
  const off=env.authenticatedContext('agent-off').firestore();
  await assertFails(getDoc(doc(off,'portal/rwm/properties/'+prop.id)));
  const stranger=env.authenticatedContext('stranger').firestore();
  await assertFails(getDoc(doc(stranger,'portal/rwm/properties/'+prop.id)));
  await assertFails(setDoc(doc(stranger,'admins/stranger'),{email:'stranger@example.com',since:'2026-11-13'}));
  const signedOut=env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(signedOut,'portal/rwm/jobs/'+job.id)));
  await assertSucceeds(getDoc(doc(agent,'agencyUsers/agent-rwm')));
  const invoice=invoices.demoInvoices(sample.agencies.rwm,sample.today)[0];
  const lifeInvoice=invoices.demoInvoices(sample.agencies.lifestyle,sample.today)[0];
  assert.equal(invoices.tenantHits([invoice,lifeInvoice]).length,0);
  await assertSucceeds(setDoc(doc(admin,'portal/rwm/invoices/'+invoice.id),invoice));
  await assertSucceeds(setDoc(doc(admin,'portal/lifestyle/invoices/'+lifeInvoice.id),lifeInvoice));
  await assertSucceeds(getDoc(doc(agent,'portal/rwm/invoices/'+invoice.id)));
  await assertFails(getDoc(doc(agent,'portal/lifestyle/invoices/'+lifeInvoice.id)));
  await assertFails(setDoc(doc(agent,'portal/rwm/invoices/'+invoice.id),invoice));
  await assertFails(setDoc(doc(admin,'portal/rwm/invoices/'+invoice.id),Object.assign({},invoice,{contact:'Jane Tenant'})));
  await assertFails(getDoc(doc(signedOut,'portal/rwm/invoices/'+invoice.id)));
  const request={
    id:'req-18-river',agencyId:'rwm',agencyCode:'Ray White Maclean/Yamba',propertyId:prop.propertyId||prop.id,
    address:prop.address,ident:'',tenancy:'Permanent',timeframe:'Next fortnight',notes:'Two alarms',
    status:'new',createdAt:'2026-11-14T01:00:00.000Z',fileName:'',fileType:'',fileData:''
  };
  const access={id:request.id,agencyId:'rwm',requestId:request.id,contactName:'Sam Resident',contactPhone:'0412 555 019',createdAt:request.createdAt};
  await assertSucceeds(setDoc(doc(agent,'portal/rwm/requests/'+request.id),request));
  await assertSucceeds(setDoc(doc(agent,'portal/rwm/access/'+request.id),access));
  await assertSucceeds(getDoc(doc(agent,'portal/rwm/requests/'+request.id)));
  await assertFails(getDoc(doc(agent,'portal/rwm/access/'+request.id)));
  await assertFails(getDoc(doc(other,'portal/rwm/requests/'+request.id)));
  await assertFails(setDoc(doc(other,'portal/rwm/requests/'+request.id),Object.assign({},request,{agencyId:'lifestyle'})));
  await assertFails(setDoc(doc(agent,'portal/rwm/requests/'+request.id),Object.assign({},request,{status:'accepted'})));
  await assertFails(setDoc(doc(agent,'portal/rwm/requests/'+request.id),Object.assign({},request,{contactPhone:'0412 555 019'})));
  await assertSucceeds(getDoc(doc(admin,'portal/rwm/access/'+request.id)));
  await assertSucceeds(setDoc(doc(admin,'portal/rwm/requests/'+request.id),Object.assign({},request,{status:'accepted'})));
  await assertSucceeds(setDoc(doc(admin,'portal/rwm/requests/'+request.id),Object.assign({},request,{status:'completed'})));
  await assertSucceeds(deleteDoc(doc(admin,'portal/rwm/access/'+request.id)));
  await assertFails(deleteDoc(doc(agent,'portal/rwm/access/'+request.id)));
});
