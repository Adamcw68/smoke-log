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
