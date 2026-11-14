const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const portal=require('./portaldata.js');
const admin=require('./portaladmin.js');

const TENANT=portal.SAMPLE_TENANT;

function textOf(value){return JSON.stringify(value)}
function rwm(){return portal.demoView('rwm')}

test('known agencies keep their codes and LIFE is Lifestyle',function(){
  assert.equal(portal.agencyFromCode('RWY').id,'rwy');
  assert.equal(portal.agencyFromCode('Ray White Maclean').code,'RWM');
  assert.equal(portal.agencyFromCode('Raine & Horne').id,'rh');
  assert.equal(portal.agencyFromCode('R&H').name,'Raine & Horne');
  assert.equal(portal.agencyFromCode('LIFE').code,'Lifestyle');
  assert.equal(portal.agencyFromCode('LIFE').id,'lifestyle');
  assert.equal(portal.agencyFromCode('Elders').id,'elders');
  assert.equal(portal.agencyFromCode('Coast Homes').id,'coast-homes');
  assert.equal(portal.agencyFromCode(''),null);
});

test('a portal record drops tenant names, phones and emails',function(){
  const sample=portal.demoInput();
  const built=portal.buildPortal(sample.jobs,sample.forms,sample.today,sample.now);
  const raw=textOf(built);
  assert.equal(portal.bundleClean(built).join(';'),'');
  assert.equal(raw.includes(TENANT.name),false);
  assert.equal(raw.includes(TENANT.phone),false);
  assert.equal(raw.includes(TENANT.phone2),false);
  assert.equal(raw.includes(TENANT.email),false);
  assert.equal(raw.includes('0400111222'),false);
  assert.equal(raw.includes('phoneLine'),false);
  assert.equal(raw.includes('"contact"'),false);
  assert.equal(portal.tenantHits(built).length,0);
});

test('each agency sees only its own properties',function(){
  const built=portal.demoPortal();
  const mine=portal.visibleAgency(built,'rwm');
  const theirs=portal.visibleAgency(built,'lifestyle');
  const rh=portal.visibleAgency(built,'rh');
  const mineText=textOf(mine);
  const theirText=textOf(theirs);
  assert.match(mineText,/18 River Street, Maclean NSW 2463/);
  assert.match(mineText,/9 Church Street/);
  assert.doesNotMatch(mineText,/21 Yamba Street/);
  assert.doesNotMatch(mineText,/4 Clarence Street/);
  assert.match(theirText,/21 Yamba Street, Yamba NSW 2464/);
  assert.doesNotMatch(theirText,/River Street, Maclean/);
  assert.equal(theirs.code,'Lifestyle');
  assert.equal(rh.code,'R&H');
  assert.match(textOf(rh),/4 Clarence Street/);
  assert.equal(portal.visibleAgency(built,'elders').jobs.length,0);
  const addresses=new Set();
  Object.keys(built.agencies).forEach(function(id){
    built.agencies[id].jobs.forEach(function(job){
      const key=id+'|'+job.address;
      assert.equal(job.agencyId,id);
      assert.equal(addresses.has(job.id),false);
      addresses.add(job.id);
    });
  });
});

test('compliance is compliant, due soon, overdue or failed',function(){
  const today='2026-11-13';
  assert.equal(portal.complianceStatus({result:'pass',due:'2027-08-12',today:today}),'compliant');
  assert.equal(portal.complianceStatus({result:'replace',due:'2027-07-01',today:today}),'compliant');
  assert.equal(portal.complianceStatus({result:'pass',due:'2026-11-20',today:today}),'due soon');
  assert.equal(portal.complianceStatus({result:'pass',due:'2026-09-01',today:today}),'overdue');
  assert.equal(portal.complianceStatus({result:'fail',due:'2027-10-02',today:today}),'failed');
  assert.notEqual(portal.complianceStatus({result:'',due:'2027-08-12',today:today}),'compliant');
  const view=rwm();
  const by=Object.fromEntries(view.properties.map(function(p){return [p.address,p]}));
  assert.equal(by['18 River Street, Maclean NSW 2463'].compliance,'compliant');
  assert.equal(by['6 Wharf Street, Maclean NSW 2463'].compliance,'due soon');
  assert.equal(by['42 Cameron Street, Maclean NSW 2463'].compliance,'overdue');
  assert.equal(by['9 Church Street, Maclean NSW 2463'].compliance,'failed');
  assert.equal(by['15 Short Street, Townsend NSW 2463'].compliance,'compliant');
  assert.equal(by['3 Union Street, Maclean NSW 2463'].compliance,'compliant');
  const counts=portal.counts(view.properties);
  assert.equal(counts.properties,6);
  assert.equal(counts.compliant,3);
  assert.equal(counts['due soon'],1);
  assert.equal(counts.overdue,1);
  assert.equal(counts.failed,1);
});

test('jobs keep status and dates and leave out the tenant',function(){
  const view=rwm();
  const wharf=view.jobs.filter(function(j){return j.address.indexOf('6 Wharf')===0});
  const booked=wharf.filter(function(j){return j.status==='booked'})[0];
  const done=wharf.filter(function(j){return j.status==='completed'})[0];
  assert.ok(booked&&done);
  assert.equal(booked.appointment,'2026-11-20');
  assert.equal(booked.appointmentTime,'09:30');
  assert.equal(booked.result,'');
  assert.equal(done.serviceDate,'2025-11-20');
  assert.equal(done.result,'pass');
  assert.equal(textOf(booked).includes(TENANT.name),false);
  const cameron=view.jobs.filter(function(j){return j.address.indexOf('42 Cameron')===0})[0];
  assert.equal(cameron.status,'upcoming');
  assert.equal(cameron.appointment,'');
  assert.equal(cameron.priorDate,'2025-09-01');
  const church=view.certificates.filter(function(c){return c.address.indexOf('9 Church')===0})[0];
  assert.equal(church.result,'fail');
  assert.equal(church.alarms[1].result,'fail');
  assert.equal(church.alarms[1].power,'9v');
  assert.equal(church.alarms[1].location,'Ceiling, Lounge');
  assert.equal(church.alarms[1].expiry,'10/2026');
  const replaced=view.certificates.filter(function(c){return c.address.indexOf('15 Short')===0})[0];
  assert.equal(replaced.result,'replace');
  assert.equal(replaced.alarms[0].result,'replace');
  assert.equal(replaced.alarms[0].expiry,'07/2036');
  const river=view.certificates.filter(function(c){return c.address.indexOf('18 River')===0})[0];
  assert.deepEqual(river.alarms.map(function(a){return a.location}),['Ceiling, Hallway','Ceiling, Bedroom 1']);
  assert.deepEqual(river.alarms.map(function(a){return a.type}),['Photo-Electric','Photo-Electric']);
  assert.deepEqual(river.alarms.map(function(a){return a.power}),['240v','Lithium']);
  assert.ok(river.alarms.every(function(a){return a.expiry==='08/2031'&&a.result==='pass'}));
  assert.match(river.statement,/Adam Westerman/);
  assert.match(river.statement,/does not include tenant names/);
});

test('a later booking keeps the completed visit',function(){
  const view=rwm();
  const remote=view.jobs.filter(function(j){return j.status==='completed'});
  const local=Object.assign({},view,{jobs:view.jobs.filter(function(j){return j.status!=='completed'}),certificates:[],retractCertificates:[]});
  const stale=view.jobs.filter(function(j){return j.status==='booked'&&j.address.indexOf('3 Union')===0})[0];
  const plan=portal.planWrites(local,remote.concat([Object.assign({},stale,{id:'old-booking',status:'booked'})]),'2026-11-13');
  assert.ok(plan.deleteJobIds.indexOf('old-booking')>=0);
  assert.ok(plan.jobs.every(function(j){return j.status!=='completed'}));
  const church=plan.properties.filter(function(p){return p.address.indexOf('9 Church')===0})[0];
  assert.equal(church.compliance,'failed');
  const undone=portal.buildPortal([{id:'river',agent:'RWM',addr:'18 River Street, Maclean NSW 2463',street:'18 River Street',town:'Maclean',due:'2027-08-12',arch:null}],{river:{agent:'RWM',addr:'18 River Street, Maclean NSW 2463',date:'2026-08-12',done:false,alarms:2,al:[]}},'2026-11-13','2026-11-13T00:00:00.000Z');
  assert.ok(undone.agencies.rwm.retractCertificates.indexOf(undone.agencies.rwm.jobs[0].propertyId+'-2026-08-12')>=0);
  assert.equal(undone.agencies.rwm.certificates.length,0);
});

test('expiry is MM/YYYY and a blank agency is not published',function(){
  assert.equal(portal.expiryOf('8/2031'),'08/2031');
  assert.equal(portal.expiryOf('2031-08'),'08/2031');
  assert.equal(portal.expiryOf('11/30'),'');
  assert.equal(portal.expiryOf('0400 111 222'),'');
  const built=portal.buildPortal([{id:'x',agent:'',addr:'1 Test Street, Yamba NSW 2464',contact:'Jane Tenant',p1:'0400 111 222'}],{},'2026-11-13','2026-11-13T00:00:00.000Z');
  assert.deepEqual(built.agencies,{});
});

test('rules lists match the published keys',function(){
  const rules=fs.readFileSync('firestore.rules','utf8');
  function listed(marker){
    const line=rules.split('\n').filter(function(row){return row.indexOf(marker+': ')>=0})[0];
    return line.split(': ')[1].trim().split(',');
  }
  assert.deepEqual(listed('portal-property-keys'),portal.PROPERTY_KEYS);
  assert.deepEqual(listed('portal-job-keys'),portal.JOB_KEYS);
  assert.deepEqual(listed('portal-certificate-keys'),portal.CERT_KEYS);
  const built=portal.demoPortal();
  Object.keys(built.agencies).forEach(function(id){
    built.agencies[id].properties.forEach(function(row){assert.equal(portal.sameKeys(row,portal.PROPERTY_KEYS),true)});
    built.agencies[id].jobs.forEach(function(row){assert.equal(portal.sameKeys(row,portal.JOB_KEYS),true)});
    built.agencies[id].certificates.forEach(function(row){
      assert.equal(portal.sameKeys(row,portal.CERT_KEYS),true);
      assert.ok(row.statement.length<900);
      row.alarms.forEach(function(alarm){assert.equal(portal.sameKeys(alarm,portal.ALARM_KEYS),true)});
    });
  });
});

test('the service worker leaves the portal alone and does not clear site data',function(){
  const sw=fs.readFileSync('sw.js','utf8');
  const html=fs.readFileSync('index.html','utf8');
  assert.match(sw,/ccsa-v2\.28\.0-20261114/);
  assert.match(sw,/portaldata\.js/);
  assert.ok(sw.includes('if(/\\/portal(?:\\/|$)/.test(u.pathname))return;'));
  assert.doesNotMatch(sw,/indexedDB\.deleteDatabase|localStorage\.clear|caches\.keys\(\)\.then\(k=>Promise\.all\(k\.map/);
  assert.match(html,/APP_VERSION='2\.28\.0 \(20261114\)'/);
  assert.match(html,/portaladmin\.js/);
  assert.match(html,/portalNudge/);
});

test('setup steps name the console work and the admin panel does not show a tenant',function(){
  const steps=portal.setupSteps('uid-adam','adamcw68.github.io');
  assert.match(steps,/ccsa-smoke-log/);
  assert.match(steps,/Email\/Password/);
  assert.match(steps,/Authorized domains/);
  assert.match(steps,/adamcw68\.github\.io/);
  assert.match(steps,/admins/);
  assert.match(steps,/uid-adam/);
  assert.match(steps,/firestore:rules/);
  assert.match(steps,/Storage is not used/);
  assert.match(steps,/Google Calendar/);
  assert.match(portal.authError('auth/unauthorized-domain','adamcw68.github.io'),/adamcw68\.github\.io/);
  assert.match(portal.authError('auth/operation-not-allowed','adamcw68.github.io'),/Email\/Password/);
  const html=admin.panelHTML();
  assert.match(html,/Agency portal/);
  assert.match(html,/Open agency portal/);
  assert.match(html,/Email\/Password/);
  assert.match(html,/adamcw68\.github\.io/);
  assert.doesNotMatch(html,/Jane Tenant|0400 111 222|jane\.tenant@example\.com/);
});
