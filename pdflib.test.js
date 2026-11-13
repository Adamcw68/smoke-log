const test=require('node:test');
const assert=require('node:assert/strict');
const pdf=require('./pdflib.js');

function freeze(v){
  if(!v||typeof v!=='object'||Object.isFrozen(v))return v;
  Object.values(v).forEach(freeze);
  return Object.freeze(v);
}
function job(over){
  return Object.assign({
    id:'a',addr:'1 Sample St, Yamba NSW 2464',street:'1 Sample St',town:'Yamba',
    svc:'2026-11-08T09:00:00+11:00',order:1,arch:null
  },over||{});
}
function alarm(over){
  return Object.assign({isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'X1',expiry:'11/2030',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]},over||{});
}
function form(over){
  const base={
    date:'2026-11-08',addr:'1 Sample St, Yamba NSW 2464',agent:'Sample Agency',ident:'',
    tech:'Adam Westerman',ptype:'House',levels:1,beds:3,alarms:1,ladder:'Sm',
    asPrev:false,asPhotos:false,asPhotosSet:false,comments:'',photos:[],done:true,updated:'2026-11-08T01:00:00.000Z',
    al:[alarm()]
  };
  return Object.assign(base,over||{},{al:(over&&over.al)||base.al});
}
function bytes(text){
  const raw=text||'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n';
  return new TextEncoder().encode(raw);
}
function record(over){
  const f=form(over&&over.form);
  const j=job(over&&over.job);
  const rec={
    id:j.id,name:pdf.pdfFileName([j],j,f.date,function(){return f.date}),day:f.date,
    addr:j.addr,street:j.street,stamp:pdf.worksheetStamp(f),made:'2026-11-08T02:00:00.000Z',
    incomplete:false,bytes:bytes('%PDF-1.4\n'+j.id+'\n%%EOF\n')
  };
  return Object.assign(rec,over&&over.record||{});
}

test('service day uses the worksheet date, otherwise Sydney time',function(){
  assert.equal(pdf.serviceDay(job({svc:'2026-11-07T13:30:00Z'}),null),'2026-11-08');
  assert.equal(pdf.serviceDay(job({svc:'2026-11-07T12:30:00Z'}),null),'2026-11-07');
  assert.equal(pdf.serviceDay(job({svc:'2026-06-15T14:30:00Z'}),null),'2026-06-16');
  assert.equal(pdf.serviceDay(job({svc:'2026-06-15T13:30:00Z'}),null),'2026-06-15');
  assert.equal(pdf.serviceDay(job({svc:'2026-04-04T13:00:00Z'}),null),'2026-04-05');
  assert.equal(pdf.serviceDay(job({svc:'2026-04-04T12:59:00Z'}),null),'2026-04-04');
  assert.equal(pdf.sydneyDay('2026-11-08'),'2026-11-08');
  assert.equal(pdf.sydneyToday(Date.UTC(2026,10,7,13,30,0)),'2026-11-08');
  assert.equal(pdf.sydneyClock('2026-11-07T13:30:00Z'),'00:30');
  const moved=form({date:'2026-11-09'});
  assert.equal(pdf.serviceDay(job({svc:'2026-11-08T09:00:00+11:00'}),moved),'2026-11-09');
  assert.equal(pdf.addDays('2026-11-08',1),'2026-11-09');
  assert.equal(pdf.addDays('2026-04-05',-1),'2026-04-04');
});

test('filenames are the service date and street, with no time',function(){
  const a=job({id:'a',street:'1 Sample St'});
  const b=job({id:'b',street:'1 Sample St',order:2});
  const c=job({id:'c',street:'9 Other Rd',addr:'9 Other Rd, Yamba NSW 2464',order:3});
  const name=pdf.pdfFileName([a,b,c],b,'2026-11-08',function(){return '2026-11-08'});
  assert.equal(name,'2026-11-08_1-Sample-St-2.pdf');
  assert.equal(pdf.pdfFileName([a,b,c],a,'2026-11-08',function(){return '2026-11-08'}),'2026-11-08_1-Sample-St.pdf');
  assert.equal(pdf.pdfFileName([a,b,c],c,'2026-11-08',function(){return '2026-11-08'}),'2026-11-08_9-Other-Rd.pdf');
  assert.equal(pdf.fileBase('1 Sample St','1 Sample St, Yamba','2026-11-08T09:30:00'),'2026-11-08_1-Sample-St');
  assert.doesNotMatch(name,/\d{2}:\d{2}/);
  assert.equal(pdf.DEFAULT_TECH,'Adam Westerman');
});

test('a day lists saved PDFs in appointment order and leaves the rest out',function(){
  const early=job({id:'early',addr:'2 Early St, Yamba NSW 2464',street:'2 Early St',svc:'2026-11-08T09:00:00+11:00',order:2});
  const late=job({id:'late',addr:'1 Late St, Yamba NSW 2464',street:'1 Late St',svc:'2026-11-08T15:00:00+11:00',order:1});
  const same=job({id:'same',addr:'3 Same St, Yamba NSW 2464',street:'3 Same St',svc:'2026-11-08T09:00:00+11:00',order:1});
  const untimed=job({id:'untimed',addr:'4 Untimed St, Yamba NSW 2464',street:'4 Untimed St',svc:'',order:1});
  const other=job({id:'other',svc:'2026-11-07T12:30:00Z',addr:'5 Other Day St, Yamba NSW 2464',street:'5 Other Day St'});
  const forms={
    early:form({addr:early.addr}),
    late:form({addr:late.addr,al:[alarm({yn:{cleaned:''}})]}),
    same:form({addr:same.addr}),
    untimed:form({date:'2026-11-08',addr:untimed.addr}),
    other:form({date:'2026-11-07',addr:other.addr})
  };
  const records=[
    record({job:early,form:forms.early,record:{id:'early'}}),
    record({job:same,form:forms.same,record:{id:'same',stamp:'old-stamp'}}),
    {id:'gone',name:'2026-11-08_9-Kept-St.pdf',day:'2026-11-08',addr:'9 Kept St, Yamba NSW 2464',street:'9 Kept St',stamp:'x',bytes:bytes(),made:''}
  ];
  const jobs=[late,early,untimed,same,other];
  const jobsCopy=JSON.stringify(jobs),formsCopy=JSON.stringify(forms);
  freeze(jobs);freeze(forms);
  const plan=pdf.dayPlan(jobs,forms,records,'2026-11-08');
  assert.deepEqual(plan.rows.map(function(r){return r.id}),['same','early','late','untimed','gone']);
  assert.deepEqual(plan.included.map(function(r){return r.id}),['early','gone']);
  assert.equal(plan.rows.find(function(r){return r.id==='same'}).status,'stale');
  assert.equal(plan.rows.find(function(r){return r.id==='late'}).status,'incomplete');
  assert.equal(plan.rows.find(function(r){return r.id==='untimed'}).status,'missing');
  assert.equal(plan.rows.find(function(r){return r.id==='early'}).include,true);
  assert.equal(plan.rows.find(function(r){return r.id==='gone'}).status,'ready');
  assert.equal(pdf.dayPlan(jobs,forms,records,'2026-11-07').rows.map(function(r){return r.id}).join(','),'other');
  assert.equal(pdf.dayPlan(jobs,forms,records,'2026-01-01').rows.length,0);
  assert.match(pdf.HELP,/share sheet/);
  assert.match(pdf.HELP,/does not email/);
  assert.match(pdf.HELP,/worksheet pages only/);
  assert.match(pdf.HELP,/Photos stay on this phone/);
  assert.equal(pdf.sharePageKind('Photos\n1 Sample St\nPhoto page 1 of 1\nAlarm 1 - photo 1'),'photo');
  assert.equal(pdf.sharePageKind('Photo page 2 of 3'),'photo');
  assert.equal(pdf.sharePageKind('CCSA worksheets 2026-11-08\nThis page is a list only. It is not a worksheet.'),'summary');
  assert.equal(pdf.sharePageKind('9 Synthetic St\nRWY Holiday\n92'),'worksheet');
  assert.equal(pdf.sharePageKind('Notes:\nSee the photo on the phone'),'worksheet');
  assert.equal(pdf.sharePageKind(''),'worksheet');
  assert.equal(jobsCopy,JSON.stringify(jobs));
  assert.equal(formsCopy,JSON.stringify(forms));
  assert.equal(records[0].bytes[0],0x25);
});

test('Sydney midnight jobs stay on the Sydney day and an empty day packs nothing',function(){
  const after=job({id:'after',svc:'2026-11-07T13:30:00Z',addr:'1 After Midnight St, Yamba NSW 2464',street:'1 After Midnight St'});
  const before=job({id:'before',svc:'2026-11-07T12:30:00Z',addr:'1 Before Midnight St, Yamba NSW 2464',street:'1 Before Midnight St'});
  const winter=job({id:'winter',svc:'2026-06-15T14:30:00Z',addr:'1 Winter St, Yamba NSW 2464',street:'1 Winter St'});
  const jobs=[after,before,winter];
  assert.deepEqual(pdf.dayPlan(jobs,{},[],'2026-11-08').rows.map(function(r){return r.id}),['after']);
  assert.equal(pdf.dayPlan(jobs,{},[],'2026-11-08').rows[0].status,'noworksheet');
  assert.equal(pdf.dayPlan(jobs,{},[],'2026-11-08').included.length,0);
  assert.deepEqual(pdf.dayPlan(jobs,{},[],'2026-11-07').rows.map(function(r){return r.id}),['before']);
  assert.deepEqual(pdf.dayPlan(jobs,{},[],'2026-06-16').rows.map(function(r){return r.id}),['winter']);
  const empty=pdf.packFiles(pdf.dayPlan(jobs,{},[],'2026-01-02'));
  assert.equal(empty.ok,false);
  assert.equal(empty.zip,null);
});

test('changed, incomplete, and unsaved worksheets are not packed or rebuilt',function(){
  const readyJob=job({id:'ready',order:1});
  const staleJob=job({id:'stale',order:2,addr:'2 Stale St, Yamba NSW 2464',street:'2 Stale St',svc:'2026-11-08T10:00:00+11:00'});
  const bareJob=job({id:'bare',order:3,addr:'3 Bare St, Yamba NSW 2464',street:'3 Bare St',svc:'2026-11-08T11:00:00+11:00'});
  const lith=form({al:[alarm({power:['Lithium'],yn:{cleaned:'Yes',battery:''}})]});
  assert.deepEqual(pdf.cleaningMissing(lith),[]);
  assert.deepEqual(pdf.cleaningMissing(form({al:[alarm({isNew:true,yn:{cleaned:''}})]})),[]);
  assert.deepEqual(pdf.cleaningMissing(form({al:[alarm({yn:{cleaned:'No'}})]})),[]);
  assert.deepEqual(pdf.cleaningMissing(form({al:[alarm({yn:{cleaned:''}})]})),[0]);
  const readyForm=form();
  const staleForm=form({addr:staleJob.addr,comments:'Edited after the PDF'});
  const forms={ready:readyForm,stale:staleForm,bare:form({addr:bareJob.addr})};
  const savedReady=record({job:readyJob,form:readyForm});
  const savedStale=record({job:staleJob,form:form({addr:staleJob.addr,comments:''}),record:{id:'stale',stamp:pdf.worksheetStamp(form({addr:staleJob.addr,comments:''}))}});
  savedStale.stamp=pdf.worksheetStamp(form({addr:staleJob.addr,comments:''}));
  const plan=pdf.dayPlan([staleJob,bareJob,readyJob],forms,[savedReady,savedStale],'2026-11-08');
  assert.deepEqual(plan.included.map(function(r){return r.id}),['ready']);
  const pack=pdf.packFiles(plan);
  assert.equal(pack.ok,true);
  assert.deepEqual(pack.pdfs.map(function(f){return f.name}),[savedReady.name]);
  assert.deepEqual(pack.pdfs[0].data,savedReady.bytes);
  const unzipped=pdf.unzipStore(pack.zip);
  assert.deepEqual(unzipped[0].data,savedReady.bytes);
  assert.equal(unzipped[1].name,'day-notes.txt');
  const notes=new TextDecoder().decode(unzipped[1].data);
  assert.match(notes,/2 Stale St/);
  assert.match(notes,/3 Bare St/);
  assert.match(notes,/not a worksheet/);
  assert.doesNotMatch(notes,/Edited after the PDF/);
  const lines=pdf.contentsLines(plan).join('\n');
  assert.match(lines,/Left out/);
  assert.match(lines,/This page is a list only/);
});

test('share sheet results and empty PDFs are refused',function(){
  assert.equal(pdf.shareChoice({count:0}).mode,'none');
  assert.equal(pdf.shareChoice({count:2,canShareSet:true}).mode,'files');
  assert.equal(pdf.shareChoice({count:2,canShareSet:false,canShareOne:true}).mode,'one');
  assert.equal(pdf.shareChoice({count:2}).mode,'download');
  assert.match(pdf.shareChoice({count:2,canShareSet:true}).message,/Send/);
  assert.equal(pdf.shareResult(null).status,'sent');
  assert.equal(pdf.shareResult({name:'AbortError'}).status,'cancelled');
  assert.match(pdf.shareResult({name:'AbortError'}).message,/Nothing was sent/);
  assert.equal(pdf.shareResult({name:'NotAllowedError'}).status,'failed');
  assert.match(pdf.shareResult({name:'NotAllowedError'}).message,/ZIP/);
  const empty=pdf.retainRecord({id:'a',stamp:'s',day:'2026-11-08',name:'2026-11-08_1-Sample-St.pdf',bytes:new Uint8Array()});
  assert.equal(empty.ok,false);
  const junk=pdf.retainRecord({id:'a',stamp:'s',day:'2026-11-08',name:'2026-11-08_1-Sample-St.pdf',bytes:bytes('hello')});
  assert.equal(junk.ok,false);
  const timed=pdf.retainRecord({id:'a',stamp:'s',day:'2026-11-08',name:'2026-11-08_09:30_1-Sample-St.pdf',bytes:bytes()});
  assert.equal(timed.ok,false);
  const src=bytes();
  const kept=pdf.retainRecord({id:'a',stamp:'s',day:'2026-11-08',name:'2026-11-08_1-Sample-St.pdf',addr:'1 Sample St, Yamba NSW 2464',bytes:src});
  assert.equal(kept.ok,true);
  kept.record.bytes[0]=0;
  assert.equal(src[0],0x25);
  assert.equal(pdf.uniqueFileNames(['a.pdf','a.pdf','b.pdf']).join(','),'a.pdf,a-2.pdf,b.pdf');
});

test('changing the measured sound level or the sheet marks leaves the saved PDF in place and stale',function(){
  const quiet=form();
  const measured=form();
  measured.al=measured.al.map(function(a){return Object.assign({},a,{db:'99.5'})});
  assert.notEqual(pdf.worksheetStamp(quiet),pdf.worksheetStamp(measured));
  assert.match(pdf.worksheetStamp(quiet),/smoke-strike-yn/);
  assert.doesNotMatch(pdf.worksheetStamp(quiet),/insect-strike/);
  const rec=record({job:job(),form:quiet});
  const old=JSON.parse(rec.stamp);
  delete old.marks;
  rec.stamp=JSON.stringify(old);
  const st=pdf.statusOf(job(),quiet,rec);
  assert.equal(st.status,'stale');
  assert.equal(st.include,false);
  assert.ok(rec.bytes.byteLength>5);
  assert.equal(rec.bytes[0],0x25);
});

test('a saved PDF whose worksheet disappeared is not treated as current',function(){
  const j=job({id:'a'});
  const rec=record({job:j,form:form()});
  const stale=pdf.statusOf(j,null,rec);
  assert.equal(stale.status,'stale');
  assert.equal(stale.include,false);
  const orphan=pdf.dayPlan([],{},[rec],'2026-11-08');
  assert.equal(orphan.included.length,1);
  assert.match(orphan.rows[0].reason,/no longer on the list/);
});
