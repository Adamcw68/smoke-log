const test=require('node:test');
const assert=require('node:assert/strict');
const visit=require('./visittype.js');
const portal=require('./portaldata.js');
const certs=require('./certificate.js');
const inv=require('./invoice.js');

function passAlarm(){
  return {room:'Hallway',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Clipsal',model:'755LPSMA4',expiry:'08/2031',yn:{comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes',cleaned:'Yes'},photos:['old-shot']};
}
function job(){
  return {id:'annual-1',agent:'Ray White Maclean/Yamba',addr:'1 Visit Street, Yamba NSW 2464',street:'1 Visit Street',town:'Yamba',ident:'',due:'2027-08-12',last:'2025-08-12',svc:'2026-08-12T09:00:00+10:00',alarms:1,contact:'Jane Tenant',p1:'0400 111 222',arch:null,notes:'Keep me'};
}
function annualForm(){
  return {agent:'Ray White Maclean/Yamba',agentSet:true,addr:'1 Visit Street, Yamba NSW 2464',date:'2026-08-12',done:true,tech:'Adam Westerman',alarms:1,comments:'Gate code',al:[passAlarm()],photos:['house']};
}

test('an off-annual visit copies the alarms and leaves the annual worksheet alone',function(){
  const source=job();
  const form=annualForm();
  const before=JSON.stringify({job:source,form:form});
  const made=visit.offAnnualVisit(source,form,{today:'2026-11-24',priorDue:'2027-08-12',reason:'callout',stamp:'abc123'});
  assert.equal(JSON.stringify({job:source,form:form}),before);
  assert.notEqual(made.job.id,source.id);
  assert.equal(made.job.notes,'');
  assert.equal(made.form.visitKind,'off');
  assert.equal(made.form.visitReason,'callout');
  assert.equal(made.form.done,false);
  assert.equal(made.form.date,'2026-11-24');
  assert.equal(made.form.priorDue,'2027-08-12');
  assert.equal(made.form.comments,'');
  assert.deepEqual(made.form.photos,[]);
  assert.equal(made.form.al[0].manufacturer,'Clipsal');
  assert.equal(made.form.al[0].model,'755LPSMA4');
  assert.deepEqual(made.form.al[0].power,['240v']);
  assert.equal(made.form.al[0].expiry,'08/2031');
  assert.equal(made.form.al[0].room,'Hallway');
  assert.deepEqual(made.form.al[0].yn,{});
  assert.deepEqual(made.form.al[0].photos,[]);
  assert.equal(form.al[0].photos[0],'old-shot');
  assert.equal(visit.describe(made.form).line,'Off-annual service · Callout / Beeping / Faulty alarm');
  assert.equal(visit.resetsCompliance(made.form),false);
  made.form.al[0].yn={comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes'};
  assert.equal(visit.resetsCompliance(made.form),true);
});

test('an unfinished off-annual visit does not move the 12-month date',function(){
  const annual=job();
  const off=Object.assign({},job(),{id:'off-1',svc:'2026-11-24T09:00:00+11:00',due:''});
  const open=Object.assign({},annualForm(),{visitKind:'off',visitReason:'callout',priorDue:'2027-08-12',date:'2026-11-24',done:true,al:[{room:'Hallway',power:['240v'],sensor:['Photo-Electric'],yn:{comply:'Yes',located:'Yes',affixed:'Yes'}}]});
  assert.equal(portal.dueOf(off,open,'2026-11-24'),'2027-08-12');
  const passed=Object.assign({},open,{al:[passAlarm()]});
  assert.equal(portal.dueOf(off,passed,'2026-11-24'),'2027-11-24');
  const built=portal.buildPortal([annual,off],{'annual-1':annualForm(),'off-1':open},'2026-11-24','2026-11-24T00:00:00.000Z');
  const property=built.agencies.rwm.properties.filter(function(row){return row.address.indexOf('1 Visit')===0})[0];
  assert.equal(property.due,'2027-08-12');
  assert.equal(property.lastService,'2026-08-12');
  assert.equal(property.compliance,'compliant');
  const rows=built.agencies.rwm.jobs.filter(function(row){return row.address.indexOf('1 Visit')===0});
  assert.equal(rows.length,2);
  const callout=rows.filter(function(row){return row.visitKind==='off'})[0];
  assert.equal(callout.visitReason,'Callout / Beeping / Faulty alarm');
  assert.equal(JSON.stringify(built).includes('0400 111 222'),false);
  assert.equal(JSON.stringify(built).includes('Jane Tenant'),false);
});

test('the worksheet, service report and invoice name the off-annual visit',function(){
  const source=job();
  const made=visit.offAnnualVisit(source,annualForm(),{today:'2026-11-24',priorDue:'2027-08-12',reason:'replacement',stamp:'pdf1'});
  made.form.done=true;
  made.form.al[0].yn={comply:'Yes',located:'Yes',button:'No',affixed:'Yes'};
  const sheet=certs.pdfText(certs.buildDayFiles([made.job],{[made.job.id]:made.form},{date:'2026-11-24'}).worksheetBytes);
  assert.match(sheet,/Off-annual service/);
  assert.match(sheet,/Alarm replacement/);
  assert.match(sheet,/\/Count 2/);
  assert.match(sheet,/strike:smoke/);
  const cert=portal.localCertificate(made.job,made.form);
  const view=certs.viewModel(cert);
  assert.equal(view.serviceReason,'Off-annual service');
  assert.equal(view.alarms[0].reason,'Alarm replacement');
  assert.equal(view.validUntil,'');
  assert.equal(/\bHW\b/.test(view.alarms[0].product),false);
  const annualView=certs.viewModel(portal.localCertificate(source,annualForm()));
  assert.equal(annualView.serviceReason,'Subscription Service');
  assert.equal(annualView.alarms[0].reason,'Annual Maintenance');
  const prices={service:15000,offAnnual:9000,replace:4500,battery:500};
  const lines=inv.suggestLines(made.form,prices);
  assert.equal(lines[0].description,'Off-annual service visit — Alarm replacement');
  assert.equal(lines[0].unitCents,9000);
  assert.equal(inv.suggestLines(annualForm(),prices)[0].description,'Annual smoke alarm and compliance service');
  assert.equal(inv.defaultSettings().prices.offAnnual,0);
});
