const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('./labelread.js');
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

const SHORTHAND='A1 240v photo entryway rep 8/2027 NEW; A2 9v photo hallway rep 5/2032';
const STRUCTURED=[
  'Contact: Pat Tenant','Phone: 0412000001','Access: key safe 1111','Agent: Ray White',
  'Last visit: 12 Mar 2025 Passed','Ladder: Med','Bedrooms: 3',
  '[CCSA visit]','Visit 04/11/2025.','Technician: Adam Westerman.','2 alarms.','1 new alarm.',
  'Alarm 1: Entryway, Clipsal SMA-4, 9v backup, photo, ceiling, 85dB, made 01/2019, rep 08/2027, NEW',
  'Alarm 2: Hallway, Brooks, 9v, photo, rep 05/2032',
  'Not yes: Alarm 1 battery.','Recorded checks are Yes.','Notes: Replaced battery on alarm 1. New battery installed.',
  '[/CCSA visit]'
].join('\n');
function emptyForm(over){
  return Object.assign({date:'2026-11-04',done:false,comments:'Gate code works',photos:['job-photo'],alarms:1,al:[{yn:{cleaned:'Yes'},isNew:false,newAns:'',photos:['alarm-photo'],power:[],sensor:[],room:'',expiry:'',manufacturer:'',model:''}],ladder:'',beds:null},over||{});
}
test('shorthand alarm lines fill empty worksheet fields and do not duplicate',function(){
  const f=emptyForm();
  const before=JSON.parse(JSON.stringify(f));
  const once=jr.applyAlarmInventory(f,SHORTHAND,{nowYear:2026});
  assert.equal(once.writes,false);
  assert.equal(once.alarmCount,2);
  assert.equal(once.alarms.length,2);
  assert.equal(once.alarms[0].room,'Entryway');
  assert.equal(once.alarms[0].expiry,'08/2027');
  assert.deepEqual(once.alarms[0].power,['240v']);
  assert.deepEqual(once.alarms[0].sensor,['Photo-Electric']);
  assert.equal(once.alarms[0].isNew,true);
  assert.equal(once.alarms[0].newAns,'Yes');
  assert.equal(once.alarms[1].room,'Hallway');
  assert.equal(once.alarms[1].expiry,'05/2032');
  assert.deepEqual(once.alarms[1].power,['9v']);
  assert.equal(once.alarms[1].isNew,false);
  assert.equal(once.alarms[0].calRef||'','');
  assert.equal(once.alarms[1].calRef||'','');
  assert.deepEqual(once.alarms[0].photos,['alarm-photo']);
  assert.deepEqual(once.alarms[0].yn,{cleaned:'Yes'});
  assert.equal(once.comments,'Gate code works');
  assert.equal(f.done,false);
  assert.deepEqual(f,before);
  const again=jr.applyAlarmInventory(Object.assign({},f,{al:once.alarms,alarms:once.alarmCount,comments:once.comments}),SHORTHAND,{nowYear:2026});
  assert.equal(again.filled,0);
  assert.equal(again.alarms.length,2);
  assert.equal(again.comments,once.comments);
  assert.equal(again.changed,false);
});
test('a structured archived visit fills alarm details without becoming this visit result',function(){
  const f=emptyForm({done:false,al:[{yn:{},photos:['alarm-photo']}],archNote:true});
  const out=jr.applyAlarmInventory(f,STRUCTURED,{nowYear:2026});
  assert.equal(out.writes,false);
  assert.equal(out.fromVisit,true);
  assert.equal(out.alarms[0].manufacturer,'Clipsal');
  assert.equal(out.alarms[0].model,'SMA4');
  assert.deepEqual(out.alarms[0].power,['9v','240v']);
  assert.equal(out.alarms[0].room,'Entryway');
  assert.equal(out.alarms[0].mount,'Ceiling');
  assert.equal(out.alarms[0].db,'85');
  assert.equal(out.alarms[0].mfd,'01/2019');
  assert.equal(out.alarms[0].expiry,'08/2027');
  assert.equal(out.alarms[0].isNew,true);
  assert.equal(out.alarms[1].manufacturer,'Brooks');
  assert.equal(out.alarms[1].room,'Hallway');
  assert.deepEqual(out.alarms[1].power,['9v']);
  assert.equal(out.alarms[1].expiry,'05/2032');
  assert.equal(out.alarms[1].isNew,false);
  assert.equal(out.property.ladder,'Med');
  assert.equal(out.property.beds,3);
  assert.equal(out.alarms[0].yn.battery,undefined);
  assert.equal(out.alarms[0].yn.button,undefined);
  assert.equal(out.alarms[0].yn.cleaned,undefined);
  assert.equal(f.done,false);
  assert.equal(out.comments,'Gate code works');
  assert.equal(out.alarms[0].manufacturer!=='Pat Tenant',true);
  assert.ok(!JSON.stringify(out.alarms).includes('0412000001'));
  assert.ok(!JSON.stringify(out.alarms).includes('Passed'));
});
test('a different typed value is kept and an empty field is still filled',function(){
  const f=emptyForm({al:[{room:'Hallway',expiry:'01/2029',power:['240v'],sensor:[],model:'',manufacturer:'',yn:{cleaned:'No'},photos:['alarm-photo'],isNew:false,newAns:'No'}]});
  const out=jr.applyAlarmInventory(f,'A1 9v photo entryway rep 8/2027 NEW',{nowYear:2026});
  assert.equal(out.alarms[0].room,'Hallway');
  assert.equal(out.alarms[0].expiry,'01/2029');
  assert.deepEqual(out.alarms[0].power,['240v']);
  assert.equal(out.alarms[0].newAns,'No');
  assert.deepEqual(out.alarms[0].sensor,['Photo-Electric']);
  assert.equal(out.alarms[0].yn.cleaned,'No');
  const fields=out.conflicts.map(function(c){return c.field}).sort();
  assert.deepEqual(fields,['expiry','new','power','room']);
  const accepted=jr.acceptAlarmField(out.alarms[0],out.conflicts.find(function(c){return c.field==='room'}));
  assert.equal(accepted.room,'Entryway');
  assert.equal(accepted.expiry,'01/2029');
  assert.equal(accepted.yn.cleaned,'No');
  assert.deepEqual(accepted.photos,['alarm-photo']);
});
test('unreadable alarm text is kept and an ambiguous date is not guessed',function(){
  const f=emptyForm({comments:'Gate code works',al:[{}]});
  const out=jr.applyAlarmInventory(f,'A1 rep 03/12 hallway; A3 see underside',{nowYear:2026});
  assert.equal(out.alarms[0].expiry||'','');
  assert.equal(out.alarms[0].room,'Hallway');
  assert.match(out.alarms[0].calRef,/03\/12/);
  assert.match(out.alarms[2].calRef,/see underside/);
  assert.equal(out.alarms[2].room||'','');
  assert.equal(out.alarms[2].power.length,0);
  assert.match(out.comments,/Calendar alarm text:/);
  assert.match(out.comments,/see underside/);
  assert.match(out.comments,/Gate code works/);
  const again=jr.applyAlarmInventory(Object.assign({},f,{al:out.alarms,alarms:out.alarmCount,comments:out.comments}),'A1 rep 03/12 hallway; A3 see underside',{nowYear:2026});
  assert.equal(again.comments,out.comments);
  assert.equal((again.comments.match(/see underside/g)||[]).length,1);
});
test('passed history and a second visit do not overwrite this alarm list or mark the job done',function(){
  const standing='A1 240v photo entryway rep 8/2027\nLast visit: 12 Mar 2025 Passed\n[CCSA visit]\nVisit 04/11/2024.\nAlarm 1: Hallway, 9v, ion, rep 01/2020\nRecorded checks are Yes.\n[/CCSA visit]\n[CCSA visit]\nVisit 04/11/2025.\nAlarm 1: Laundry, heat, rep 02/2021\nNot yes: Alarm 1 battery.\n[/CCSA visit]';
  const f=emptyForm({done:false});
  const out=jr.applyAlarmInventory(f,standing,{nowYear:2026});
  assert.equal(out.fromVisit,false);
  assert.equal(out.alarms[0].room,'Entryway');
  assert.deepEqual(out.alarms[0].power,['240v']);
  assert.equal(out.alarms[0].expiry,'08/2027');
  assert.notEqual(out.alarms[0].room,'Laundry');
  assert.equal(out.alarms[0].yn.battery,undefined);
  assert.equal(f.done,false);
  assert.equal(out.alarms.length,1);
});
test('an explicit full-day expiry stays month and year and a Clipsal factory code still derives ten years',function(){
  const day=jr.applyAlarmInventory(emptyForm(),'A1 Clipsal rep 21/01/2029 photo entryway',{nowYear:2026});
  assert.equal(day.alarms[0].expiry,'01/2029');
  assert.notEqual(day.alarms[0].expiry,'01/2039');
  const code=jr.applyAlarmInventory(emptyForm(),'A1 Clipsal 210119 photo entryway',{nowYear:2026});
  assert.equal(code.alarms[0].mfd,'01/2019');
  assert.equal(code.alarms[0].expiry,'01/2029');
  assert.notEqual(code.alarms[0].model,'210119');
  const both=jr.applyAlarmInventory(emptyForm(),'A1 Clipsal SMA-4 210119 rep 03/2028 9v',{nowYear:2026});
  assert.equal(both.alarms[0].model,'SMA4');
  assert.equal(both.alarms[0].expiry,'03/2028');
  assert.equal(both.alarms[0].mfd,'01/2019');
  assert.deepEqual(both.alarms[0].power,['9v','240v']);
});
test('the worksheet update reads alarm text and does not post a calendar change',function(){
  const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
  const start=html.indexOf('async function updateJobFromCalendar');
  const fn=html.slice(start,html.indexOf('async function gcalJSON',start));
  assert.match(fn,/applyAlarmInventory/);
  assert.match(fn,/flushWorksheet/);
  assert.doesNotMatch(fn,/PATCH|POST/);
  assert.match(html,/No property or alarm details were recognised/);
  assert.match(html,/JobRefresh\.applyAlarmInventory\(sheet,ev\.description/);
});

const REAL={
  visit:'Last visit (25/11/2025): A1 240v photo entryway rep 2/2030 NEW; A2 240v photo lounge rep 2/2030 NEW\n\n--- LAST VISIT (25/11/2025, $35 58B Scullin St Townsend RWM NEW) ---\nDuplex  \nSingle storey \n2 bed\n\n1. Tested, sound tested and cleaned 240v photoelectric smoke alarm located entryway ...',
  prose:'Unit\n2 bed\n\n1. Tested, sound tested and cleaned  lithium photoelectric smoke alarm, alarm  located hallway,  lithium battery, passed sound test. Replace alarm by 11/2031.',
  batteries:'Last visit (25/11/2025): A1 9v photo entryway installed new battery rep 11/2035 NEW; A2 9v photo lounge installed new battery r rep 11/2035 NEW; A3 9v photo hallway installed new battery  rep 11/2035 NEW',
  html:'Unit<br>2 bed<br><br>1. Tested, sound tested and cleaned 240v photoelectric  smoke alarm located hallwa...',
  count:'Last visit (12/11/2024): A1 240v photo hallway rep 7/2033 NEW; A2 240v photo b [text cut off]\n4 x 240v photoelectric smoke alarm test button works located correctly',
  holiday:'House\nsingle storey (elevated)\n5\n211/2031'
};
test('real last-visit shorthand fills property, storeys, beds and both alarms',function(){
  const out=jr.applyAlarmInventory(emptyForm({done:false,al:[{yn:{},photos:['p'],power:[],sensor:[],room:'',expiry:'',newAns:'',isNew:false}]}),REAL.visit,{nowYear:2026});
  assert.equal(out.property.ptype,'Duplex');
  assert.equal(out.property.levels,1);
  assert.equal(out.property.beds,2);
  assert.equal(out.recognised,2);
  assert.equal(out.alarmCount,2);
  assert.equal(out.alarms[0].room,'Entryway');
  assert.equal(out.alarms[0].expiry,'02/2030');
  assert.deepEqual(out.alarms[0].power,['240v']);
  assert.equal(out.alarms[1].room,'Lounge');
  assert.equal(out.alarms[0].yn.cleaned,undefined);
  assert.equal(out.alarms[0].yn.button,undefined);
  assert.notEqual(out.alarms[0].isNew,false);
});
test('a numbered service note sets one alarm and does not mark this visit passed',function(){
  const f=emptyForm({done:false,comments:'Gate code works'});
  const out=jr.applyAlarmInventory(f,REAL.prose,{nowYear:2026});
  assert.equal(out.property.ptype,'Unit');
  assert.equal(out.property.beds,2);
  assert.equal(out.recognised,1);
  assert.equal(out.alarms[0].room,'Hallway');
  assert.deepEqual(out.alarms[0].power,['Lithium']);
  assert.deepEqual(out.alarms[0].sensor,['Photo-Electric']);
  assert.equal(out.alarms[0].expiry,'11/2031');
  assert.equal(out.alarms[0].yn.battery,undefined);
  assert.equal(out.alarms[0].yn.button,undefined);
  assert.equal(out.alarms[0].isNew,false);
  assert.equal(f.done,false);
  assert.match(out.comments,/Gate code works/);
});
test('installed new battery is not an inspection result and HTML breaks still parse',function(){
  const bat=jr.applyAlarmInventory(emptyForm(),REAL.batteries,{nowYear:2026});
  assert.equal(bat.recognised,3);
  assert.equal(bat.alarms[0].expiry,'11/2035');
  assert.equal(bat.alarms[2].room,'Hallway');
  assert.equal(bat.alarms[0].yn.battery,undefined);
  assert.equal(bat.alarms[0].isNew,true);
  const html=jr.applyAlarmInventory(emptyForm(),REAL.html,{nowYear:2026});
  assert.equal(html.property.ptype,'Unit');
  assert.equal(html.property.beds,2);
  assert.equal(html.alarms[0].room,'Hallway');
  assert.deepEqual(html.alarms[0].power,['240v']);
  assert.equal(html.alarms[0].expiry||'','');
});
test('a shared 4 x line raises the alarm count without inventing the cut-off room',function(){
  const out=jr.applyAlarmInventory(emptyForm(),REAL.count,{nowYear:2026});
  assert.equal(out.recognised,4);
  assert.equal(out.alarmCount,4);
  assert.equal(out.alarms[0].room,'Hallway');
  assert.equal(out.alarms[0].expiry,'07/2033');
  assert.equal(out.alarms[1].room||'','');
  assert.deepEqual(out.alarms[3].power,['240v']);
  assert.deepEqual(out.alarms[3].sensor,['Photo-Electric']);
  assert.equal(out.alarms[0].yn.button,undefined);
  assert.equal(out.alarms[0].yn.located,undefined);
});
test('a holiday note fills house, one storey and five beds and ignores 211/2031',function(){
  const out=jr.applyAlarmInventory(emptyForm(),REAL.holiday,{nowYear:2026});
  assert.equal(out.property.ptype,'House');
  assert.equal(out.property.levels,1);
  assert.equal(out.property.beds,5);
  assert.equal(out.recognised,0);
  assert.equal(out.alarms[0].expiry||'','');
  assert.equal(out.changed,true);
});
test('a sheet expiry on a blank alarm does not block the calendar date, a typed one does',function(){
  const blank=emptyForm({al:[{expiry:'01/2020',room:'',power:[],sensor:[],yn:{},newAns:'',isNew:false,photos:['keep']}]});
  const filled=jr.applyAlarmInventory(blank,'A1 240v photo entryway rep 2/2030',{nowYear:2026,sheetExpiry:['01/2020']});
  assert.equal(filled.alarms[0].expiry,'02/2030');
  assert.deepEqual(filled.alarms[0].photos,['keep']);
  const typed=jr.applyAlarmInventory(emptyForm({al:[{expiry:'01/2029',room:'Hallway',power:['9v'],sensor:[],yn:{cleaned:'Yes'},newAns:'No',isNew:false,photos:['keep']}]}),'A1 240v photo entryway rep 2/2030 NEW',{nowYear:2026,sheetExpiry:['01/2029']});
  assert.equal(typed.alarms[0].expiry,'01/2029');
  assert.equal(typed.alarms[0].room,'Hallway');
  assert.equal(typed.alarms[0].yn.cleaned,'Yes');
  assert.ok(typed.conflicts.some(function(c){return c.field==='expiry'&&c.source==='02/2030'}));
  assert.ok(typed.conflicts.some(function(c){return c.field==='ptype'||c.field==='room'}));
});
