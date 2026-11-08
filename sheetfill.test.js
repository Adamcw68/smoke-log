const test=require('node:test');
const assert=require('node:assert/strict');
const fill=require('./sheetfill.js');
const jr=require('./jobrefresh.js');

test('known agencies become the short code and unknown names stay',function(){
  const cases=[
    ['RWY','RWY'],['rwy','RWY'],['Ray White Yamba','RWY'],['Ray White, Yamba','RWY'],['Raywhite Yamba','RWY'],
    ['RWM','RWM'],['Ray White Maclean','RWM'],
    ['R&H','R&H'],['R & H','R&H'],['Raine & Horne','R&H'],['Raine and Horne','R&H'],['Raine Horne','R&H'],
    ['LIFE','LIFE'],['Lifestyle','LIFE'],['lifestyle','LIFE'],
    ['Ray White','Ray White'],['McGrath','McGrath'],['  McGrath  ','McGrath'],
    ['','']
  ];
  cases.forEach(function(pair){assert.equal(fill.print(pair[0]),pair[1],pair[0])});
  assert.equal(fill.print(null),'');
  assert.equal(fill.print('Ray White Yamba Pty Ltd'),'Ray White Yamba Pty Ltd');
});

test('spreadsheet, route JSON and calendar titles use the same agency rules',function(){
  assert.equal(fill.print('Ray White Yamba'),'RWY');
  assert.equal(fill.stripTail('1 Sample St Yamba RWY').code,'RWY');
  assert.equal(fill.stripTail('1 Sample St Yamba RWY').text,'1 Sample St Yamba');
  assert.equal(fill.stripTail('2 Sample St Maclean RWM PERM').code,'RWM');
  assert.equal(fill.stripTail('2 Sample St Maclean RWM PERM').text,'2 Sample St Maclean');
  assert.equal(fill.stripTail('3 Sample St Yamba R&H').code,'R&H');
  assert.equal(fill.stripTail('3 Sample St Yamba HOL LIFE').code,'LIFE');
  assert.equal(fill.stripTail('3 Sample St Yamba HOL LIFE').text,'3 Sample St Yamba');
  assert.equal(fill.stripTail('4 Sample St Yamba PERM').code,'');
  assert.equal(fill.stripTail('4 Sample St Yamba PERM').text,'4 Sample St Yamba');
  assert.equal(fill.stripTail('1 Life St').code,'');
  assert.equal(fill.fromEvent({summary:'1 Sample St Yamba RWY',description:''}),'RWY');
  assert.equal(fill.fromEvent({summary:'1 Sample St',description:'Agent: Ray White Maclean'}),'RWM');
  assert.equal(fill.fromEvent({summary:'1 Sample St Yamba RWY',description:'Agent: McGrath'}),'McGrath');
  assert.equal(fill.fromEvent({summary:'1 Sample St',description:'Agent: Ray White'}),'Ray White');
  assert.equal(fill.fromEvent({summary:'1 Sample St Yamba',description:''}),'');
  assert.equal(fill.forForm('',{agent:'Ray White Yamba',src:'Sheet'}),'RWY');
  assert.equal(fill.forForm('McGrath',{agent:'Ray White Yamba'}),'McGrath');
  assert.equal(fill.forForm('',{agent:'',src:'Calendar',notes:'1 Sample St Yamba R&H'}),'R&H');
  assert.equal(fill.forForm('',{agent:'',src:'Sheet',notes:'1 Sample St Yamba RWY'}),'');
});

test('comma calendar titles fill agency and tenancy without guessing',function(){
  const rwy=fill.readTitle('12 Smith St, Yamba, RWY, Holiday');
  assert.equal(rwy.agent,'RWY');
  assert.equal(rwy.tenancy,'Holiday');
  assert.equal(rwy.text,'12 Smith St, Yamba');
  const rwm=fill.readTitle('4 River Rd Maclean RWM PERM');
  assert.equal(rwm.agent,'RWM');
  assert.equal(rwm.tenancy,'Permanent');
  assert.equal(rwm.text,'4 River Rd Maclean');
  const life=fill.readTitle('9 Beach Rd, Yamba, Lifestyle, Holiday');
  assert.equal(life.agent,'LIFE');
  assert.equal(life.tenancy,'Holiday');
  assert.equal(life.text,'9 Beach Rd, Yamba');
  const rh=fill.readTitle('3 King St, Raine & Horne, PERM');
  assert.equal(rh.agent,'R&H');
  assert.equal(rh.tenancy,'Permanent');
  assert.equal(fill.readTitle('3 King St, Raine and Horne').agent,'R&H');
  assert.equal(fill.readTitle('1 Life St').agent,'');
  assert.equal(fill.readTitle('1 Life St').tenancy,'');
  const unknown=fill.readTitle('5 Queen St, Some Agency, Holiday');
  assert.equal(unknown.agent,'');
  assert.equal(unknown.tenancy,'Holiday');
  assert.equal(fill.readTitle('8 Lane, Ray White, Holiday').agent,'');
  assert.equal(fill.readTitle('8 Lane, Ray White, Holiday').tenancy,'Holiday');
  const explicit=fill.readEvent({summary:'1 Sample St, Yamba, RWY, Holiday',description:'Agent: McGrath'});
  assert.equal(explicit.agent,'McGrath');
  assert.equal(explicit.tenancy,'Holiday');
  const blank={agent:'',tenancy:'',agentSet:false,tenancySet:false,ptype:'House'};
  const job={agent:'',section:'',src:'Sheet',notes:'gate code',ptype:'House'};
  const meta={agent:'RWY',tenancy:'Holiday'};
  assert.equal(fill.agentForForm(blank,job,meta),'RWY');
  assert.equal(fill.tenancyForForm(blank,job,meta),'Holiday');
  assert.equal(fill.agentForForm({agent:'McGrath'},job,meta),'McGrath');
  assert.equal(fill.tenancyForForm({tenancy:'Holiday',tenancySet:true},job,{tenancy:'Permanent'}),'Holiday');
  assert.equal(fill.tenancyForForm({tenancy:''},{section:'Permanent',ptype:'Unit'},{}),'Permanent');
  assert.equal(fill.agentForForm({agent:'',agentSet:true},job,meta),'');
  assert.equal(blank.ptype,'House');
});

test('calendar appointment keeps an unknown agent and shortens a known one',function(){
  const job={addr:'1 Sample St',agent:'',svc:'2026-11-08T09:00:00+11:00'};
  const known=jr.appointmentPatch(job,{agent:''},{iso:'2026-11-08T09:00:00+11:00',description:'Agent: Ray White Yamba',location:'1 Sample St'});
  assert.equal(known.job.agent,'RWY');
  assert.equal(known.formPatch.agent,'RWY');
  const unknown=jr.appointmentPatch(job,{agent:''},{iso:'2026-11-08T09:00:00+11:00',description:'Agent: McGrath',location:'1 Sample St'});
  assert.equal(unknown.job.agent,'McGrath');
  const bare=jr.appointmentPatch({addr:'1 Sample St',agent:'Ray White'},{agent:'Ray White'},{description:'Agent: Ray White',location:'1 Sample St',iso:'2026-11-08T09:00:00+11:00'});
  assert.equal(bare.job.agent,'Ray White');
  assert.equal(bare.formPatch.agent,undefined);
  const titled=jr.appointmentPatch({addr:'1 Sample St, Yamba NSW 2464',agent:'',section:''},{agent:'',ptype:'House'},{summary:'1 Sample St, Yamba, RWY, Holiday',description:'',location:'1 Sample St, Yamba NSW 2464',iso:'2026-11-08T09:00:00+11:00'});
  assert.equal(titled.job.agent,'RWY');
  assert.equal(titled.formPatch.agent,'RWY');
  assert.equal(titled.job.section,'Holiday');
  assert.equal(titled.formPatch.tenancy,'Holiday');
  assert.equal(titled.job.ptype,undefined);
  const kept=jr.appointmentPatch({agent:'McGrath',section:'Permanent'},{agent:'McGrath',tenancy:'Permanent',ptype:'Unit'},{summary:'1 Sample St, Yamba, RWY, Holiday',description:'',iso:'2026-11-08T09:00:00+11:00'});
  assert.equal(kept.job.agent,'McGrath');
  assert.equal(kept.job.section,'Permanent');
  assert.equal(kept.formPatch.agent,undefined);
  assert.equal(kept.formPatch.tenancy,undefined);
});

test('measured sound level accepts real readings and invents nothing',function(){
  assert.deepEqual(fill.soundFinal(''),{ok:true,blank:true,value:'',message:''});
  assert.deepEqual(fill.soundFinal('   '),{ok:true,blank:true,value:'',message:''});
  assert.equal(fill.soundFinal('99.5').value,'99.5');
  assert.equal(fill.soundFinal('103').value,'103');
  assert.equal(fill.soundFinal('85').value,'85');
  assert.equal(fill.soundFinal('96').value,'96');
  assert.equal(fill.soundFinal('110.2').value,'110.2');
  assert.equal(fill.soundFinal('99.50').value,'99.5');
  assert.equal(fill.soundFinal('0').value,'0');
  assert.equal(fill.soundFinal('200').ok,true);
  assert.equal(fill.soundFinal('201').ok,false);
  assert.equal(fill.soundFinal('-1').ok,false);
  assert.equal(fill.soundFinal('abc').ok,false);
  assert.equal(fill.soundFinal('97-103').ok,false);
  assert.equal(fill.soundFinal('1e2').ok,false);
  assert.equal(fill.soundFinal('99.5').blank,false);
  assert.match(fill.soundFinal('97-103').message,/blank/);
  assert.equal(fill.soundDraft('99.5 dB'),'99.5');
  assert.equal(fill.soundDraft('97-103'),'97103');
  assert.notEqual(fill.soundFinal('').value,'97');
  assert.notEqual(fill.soundFinal('').value,'100');
});
