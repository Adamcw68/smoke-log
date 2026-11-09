const test=require('node:test');
const assert=require('node:assert/strict');
const xfer=require('./transfer.js');

function job(id,addr,over){
  return Object.assign({id:id,addr:addr,ident:'',street:addr,town:'Yamba',agent:'',section:'',due:'2026-11-09',svc:'2026-11-09T09:00:00+11:00',p1:'',contact:'',notes:'',directions:''},over||{});
}
function form(updated,db,agent){
  return {updated:updated,agent:agent,tenancy:'Holiday',tech:'Adam Westerman',date:'2026-11-09',alarms:1,comments:'',al:[{db:db,yn:{cleaned:'Yes',battery:'Yes'},power:['240v'],photos:[]}],photos:[]};
}

test('a newer phone worksheet replaces an older desktop copy and keeps the other job',function(){
  const local={
    jobs:[job('a','1 Circle St, Yamba NSW 2464',{agent:'Old'}),job('desk','9 Desk St, Yamba NSW 2464',{agent:'Desk'})],
    forms:{a:form('2026-11-01T00:00:00.000Z','80','Old'),desk:form('2026-11-08T00:00:00.000Z','70','Desk')},
    photos:[{id:'p-local',ts:'2026-11-09T02:00:00.000Z'}],
    pdfs:[{id:'a',made:'2026-11-09T03:00:00.000Z'}]
  };
  const incoming={
    jobs:[job('a','1 Circle St, Yamba NSW 2464',{agent:'RWY',p1:'0400 111 222'}),job('extra','2 Extra St, Yamba NSW 2464')],
    forms:{a:form('2026-11-09T01:00:00.000Z','99.5','RWY'),extra:form('2026-11-09T01:00:00.000Z','','LIFE')},
    photos:[{id:'p-phone',ts:'2026-11-09T01:00:00.000Z'},{id:'p-local',ts:'2026-11-08T01:00:00.000Z'}],
    pdfs:[{id:'a',made:'2026-11-09T04:00:00.000Z'},{id:'desk',made:'2026-11-01T00:00:00.000Z'}]
  };
  const out=xfer.mergeWorksheets(local,incoming);
  const circle=out.jobs.find(j=>j.id==='a');
  const desk=out.jobs.find(j=>j.id==='desk');
  const extra=out.jobs.find(j=>j.addr.indexOf('2 Extra')===0);
  assert.equal(out.forms.a.al[0].db,'99.5');
  assert.equal(out.forms.a.agent,'RWY');
  assert.equal(circle.agent,'RWY');
  assert.equal(circle.p1,'0400 111 222');
  assert.equal(out.forms.desk.al[0].db,'70');
  assert.equal(desk.agent,'Desk');
  assert.ok(extra);
  assert.equal(out.forms[extra.id].agent,'LIFE');
  assert.deepEqual(out.photos.map(p=>p.id),['p-phone']);
  assert.deepEqual(out.pdfs.map(p=>p.id),['a','desk']);
  assert.equal(out.jobs.length,3);
  assert.match(xfer.mergeMessage(out.report),/Nothing already on this device was deleted/);
  assert.equal(out.report.kept.length,0);
  assert.equal(out.report.newer.length,1);
});

test('an older import does not replace a newer worksheet, photo, or PDF',function(){
  const local={
    jobs:[job('a','1 Circle St, Yamba NSW 2464',{agent:'RWY'})],
    forms:{a:form('2026-11-09T05:00:00.000Z','99.5','RWY')},
    photos:[{id:'p1',ts:'2026-11-09T05:00:00.000Z'}],
    pdfs:[{id:'a',made:'2026-11-09T05:00:00.000Z'}]
  };
  const incoming={
    jobs:[job('a','1 Circle St, Yamba NSW 2464',{agent:'Old'})],
    forms:{a:form('2026-11-08T00:00:00.000Z','1','Old')},
    photos:[{id:'p1',ts:'2026-11-01T00:00:00.000Z'}],
    pdfs:[{id:'a',made:'2026-11-01T00:00:00.000Z'}]
  };
  const out=xfer.mergeWorksheets(local,incoming);
  assert.equal(out.forms.a.al[0].db,'99.5');
  assert.equal(out.forms.a.agent,'RWY');
  assert.equal(out.jobs[0].agent,'RWY');
  assert.equal(out.photos.length,0);
  assert.equal(out.pdfs.length,0);
  assert.equal(out.report.kept.length,1);
  assert.equal(out.report.added.length,0);
});

test('the spreadsheet has one row per alarm and does not invent a sound level',function(){
  const rows=xfer.sheetRows([job('a','1 Circle St, Yamba NSW 2464',{agent:'RWY',p1:'0400 111 222'})],{
    a:{agent:'RWY',tenancy:'Holiday',tech:'Adam Westerman',date:'2026-11-09',alarms:2,comments:'Gate',al:[{db:'99.5',room:'Hallway',power:['240v'],yn:{battery:'Yes',cleaned:'Yes'}},{db:'',room:'Bedroom',power:['Lithium'],yn:{battery:'',cleaned:'Yes'}}]}
  });
  assert.equal(rows.length,2);
  assert.equal(rows[0]['Sound dB'],'99.5');
  assert.equal(rows[1]['Sound dB'],'');
  assert.equal(rows[0].Agent,'RWY');
  assert.equal(rows[0].Tenancy,'Holiday');
  assert.equal(rows[0].Phone,'0400 111 222');
  assert.equal(rows[1].Power,'Lithium');
  assert.equal(xfer.isWorksheetPack({version:4,jobs:[],forms:{}}),true);
  assert.equal(xfer.isWorksheetPack([{addr:'1 St'}]),false);
  assert.equal(xfer.isWorksheetPack({events:[{summary:'x'}]}),false);
});
