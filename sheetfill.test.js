const test=require('node:test');
const assert=require('node:assert/strict');
const fill=require('./sheetfill.js');
const jr=require('./jobrefresh.js');

const RW='Ray White Maclean/Yamba';
const LIFE='Lifestyle Maclean/Yamba';
const RH='Raine & Horne Maclean/Yamba';
const LJH='LJH Iluka';
const MCK='McKimms Grafton';
const RWG='Ray White Grafton';
const DOUG='Dougherty Property Grafton';
const ELD='Elders Real Estate Clarence Valley';
const YV='Yamba Valley Real Estate';
const PRIV='Private Owner';

test('known agencies map to the four names and unknown names stay',function(){
  const cases=[
    ['RWY',RW],['rwy',RW],['Ray White Yamba',RW],['Ray White, Yamba',RW],['Raywhite Yamba',RW],
    ['RWM',RW],['Ray White Maclean',RW],['Ray White Maclean/Yamba',RW],
    ['R&H',RH],['R & H',RH],['Raine & Horne',RH],['Raine and Horne',RH],['Raine Horne',RH],
    ['Raine & Horne Maclean',RH],['Raine & Horne Yamba',RH],
    ['LIFE',LIFE],['Lifestyle',LIFE],['lifestyle',LIFE],['Lifestyle Maclean',LIFE],['Lifestyle Yamba',LIFE],
    ['LJH',LJH],['LJ Hooker Iluka',LJH],['L.J. Hooker Iluka',LJH],['LJH Iluka',LJH],
    ['McKimms',MCK],['McKimms Grafton',MCK],['Mc Kimms Grafton',MCK],
    ['Ray White Grafton',RWG],['RWG',RWG],['Ray White, Grafton',RWG],
    ['Dougherty',DOUG],['Dougherty Property',DOUG],['Dougherty Property Grafton',DOUG],["Dougherty's",DOUG],
    ['Elders',ELD],['Elders Real Estate',ELD],['Elders Real Estate Clarence Valley',ELD],
    ['Yamba Valley',YV],['Yamba Valley Real Estate',YV],
    ['Private Owner',PRIV],['Private',PRIV],
    ['Ray White','Ray White'],['LJ Hooker','LJ Hooker'],['McGrath','McGrath'],['  McGrath  ','McGrath'],
    ['','']
  ];
  cases.forEach(function(pair){assert.equal(fill.print(pair[0]),pair[1],pair[0])});
  assert.equal(fill.print(null),'');
  assert.equal(fill.print('Ray White Yamba Pty Ltd'),'Ray White Yamba Pty Ltd');
  assert.deepEqual(fill.agencyChoices(),[RW,LIFE,RH,LJH,MCK,RWG,DOUG,ELD,YV,PRIV]);
  assert.equal(fill.agencyChoices().indexOf('Elders'),-1);
  assert.equal(fill.agencyChoices().indexOf('McGrath'),-1);
});

test('spreadsheet, route JSON and calendar titles use the same agency rules',function(){
  assert.equal(fill.print('Ray White Yamba'),RW);
  assert.equal(fill.stripTail('1 Sample St Yamba RWY').code,RW);
  assert.equal(fill.stripTail('1 Sample St Yamba RWY').text,'1 Sample St Yamba');
  assert.equal(fill.stripTail('2 Sample St Maclean RWM PERM').code,RW);
  assert.equal(fill.stripTail('2 Sample St Maclean RWM PERM').text,'2 Sample St Maclean');
  assert.equal(fill.stripTail('3 Sample St Yamba R&H').code,RH);
  assert.equal(fill.stripTail('3 Sample St Yamba HOL LIFE').code,LIFE);
  assert.equal(fill.stripTail('3 Sample St Yamba HOL LIFE').text,'3 Sample St Yamba');
  assert.equal(fill.stripTail('4 Sample St Yamba PERM').code,'');
  assert.equal(fill.stripTail('4 Sample St Yamba PERM').text,'4 Sample St Yamba');
  assert.equal(fill.stripTail('1 Life St').code,'');
  assert.equal(fill.fromEvent({summary:'1 Sample St Yamba RWY',description:''}),RW);
  assert.equal(fill.fromEvent({summary:'1 Sample St',description:'Agent: Ray White Maclean'}),RW);
  assert.equal(fill.fromEvent({summary:'1 Sample St Yamba RWY',description:'Agent: McGrath'}),'McGrath');
  assert.equal(fill.fromEvent({summary:'1 Sample St',description:'Agent: Ray White'}),'Ray White');
  assert.equal(fill.fromEvent({summary:'12 River St Iluka',description:'Agent: LJ Hooker Iluka'}),LJH);
  assert.equal(fill.fromEvent({summary:'1 Sample St Yamba',description:''}),'');
  assert.equal(fill.forForm('',{agent:'Ray White Yamba',src:'Sheet'}),RW);
  assert.equal(fill.forForm('McGrath',{agent:'Ray White Yamba'}),'McGrath');
  assert.equal(fill.forForm('Elders',{agent:'Lifestyle'}),ELD);
  assert.equal(fill.forForm('',{agent:'',src:'Calendar',notes:'1 Sample St Yamba R&H'}),RH);
  assert.equal(fill.forForm('',{agent:'',src:'Sheet',notes:'1 Sample St Yamba RWY'}),'');
});

test('comma calendar titles fill agency and tenancy without guessing',function(){
  const rwy=fill.readTitle('12 Smith St, Yamba, RWY, Holiday');
  assert.equal(rwy.agent,RW);
  assert.equal(rwy.tenancy,'Holiday');
  assert.equal(rwy.text,'12 Smith St, Yamba');
  const rwm=fill.readTitle('4 River Rd Maclean RWM PERM');
  assert.equal(rwm.agent,RW);
  assert.equal(rwm.tenancy,'Permanent');
  assert.equal(rwm.text,'4 River Rd Maclean');
  const life=fill.readTitle('9 Beach Rd, Yamba, Lifestyle, Holiday');
  assert.equal(life.agent,LIFE);
  assert.equal(life.tenancy,'Holiday');
  assert.equal(life.text,'9 Beach Rd, Yamba');
  const rh=fill.readTitle('3 King St, Raine & Horne, PERM');
  assert.equal(rh.agent,RH);
  assert.equal(rh.tenancy,'Permanent');
  assert.equal(fill.readTitle('3 King St, Raine and Horne').agent,RH);
  assert.equal(fill.readTitle('2 Riverview St, Iluka, LJH, Holiday').agent,LJH);
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
  assert.equal(fill.agentForForm(blank,job,meta),RW);
  assert.equal(fill.tenancyForForm(blank,job,meta),'Holiday');
  assert.equal(fill.agentForForm({agent:'McGrath'},job,meta),'McGrath');
  assert.equal(fill.tenancyForForm({tenancy:'Holiday',tenancySet:true},job,{tenancy:'Permanent'}),'Holiday');
  assert.equal(fill.tenancyForForm({tenancy:''},{section:'Permanent',ptype:'Unit'},{}),'Permanent');
  const real=[
    ['9 Riverwood Terrace Maclean, Raine & Horne Maclean, Holiday',RH,'Holiday'],
    ['50 Jubilee St Townsend, R & H Maclean, PERM',RH,'Permanent'],
    ['606 South Arm Rd South Arm, R&H Maclean, PERM',RH,'Permanent'],
    ['46 Farlows Lane Maclean, Lifestyle Maclean, PERM',LIFE,'Permanent'],
    ['key 14 Coonawarra Court Yamba, Lifestyle Yamba, PERM',LIFE,'Permanent'],
    ['19 Church St Maclean, Ray White Maclean, PERM',RW,'Permanent'],
    ['Pippi House  9 Pacific Pde Yamba  RWY Holiday',RW,'Holiday'],
    ['8/5 Beach St Yamba, Raine & Horne Yamba , Holiday',RH,'Holiday'],
    ['3/22 Clarence St Yamba, Elders, Holiday',ELD,'Holiday'],
    ['6 Prince St Grafton, Dougherty Property, PERM',DOUG,'Permanent'],
    ['11 Coldstream St Yamba, Yamba Valley Real Estate, Holiday',YV,'Holiday'],
    ['8 Spenser St Iluka, LJ Hooker Iluka, PERM',LJH,'Permanent'],
    ['14 Prince St Grafton, Ray White Grafton, PERM',RWG,'Permanent'],
    ['9 Victoria St Grafton, McKimms, Holiday',MCK,'Holiday'],
    ['2 Owner Lane Yamba, Private Owner, PERM',PRIV,'Permanent']
  ];
  real.forEach(function(row){
    const got=fill.readTitle(row[0]);
    assert.equal(got.agent,row[1],row[0]);
    assert.equal(got.tenancy,row[2],row[0]);
  });
  const stra=fill.readEvent({summary:'8 Campbell Lane Yamba, Lifestyle Yamba, Holiday',description:'Contact / access: Approved STRA Upgrade'});
  assert.equal(stra.agent,LIFE);
  assert.equal(stra.tenancy,'Holiday');
  const perm=fill.readEvent({summary:'46 Farlows Lane Maclean, Lifestyle Maclean, PERM',description:'Passed NSW STRA'});
  assert.equal(perm.agent,LIFE);
  assert.equal(perm.tenancy,'Permanent');
  const banner=fill.readEvent({summary:'4/25 Queen St Yamba',description:'--- LAST VISIT (04/11/2025, Green Dolphin 4/25 Queen St Yamba Lifestyle Perm) ---'});
  assert.equal(banner.agent,LIFE);
  assert.equal(banner.tenancy,'Permanent');
  const titleWins=fill.readEvent({summary:'1 Sample St, Yamba, RWY, Holiday',description:'--- LAST VISIT (04/11/2025, 1 Sample St Lifestyle Perm) ---'});
  assert.equal(titleWins.agent,RW);
  assert.equal(titleWins.tenancy,'Holiday');
  const typed=fill.visitConflicts({agent:'McGrath',tenancy:'Permanent'},{agent:'Lifestyle',tenancy:'Holiday'});
  assert.deepEqual(typed.map(function(c){return c.field}),['agent','tenancy']);
  assert.equal(fill.visitConflicts({agent:'',tenancy:''},{agent:'Lifestyle',tenancy:'Permanent'}).length,0);
  assert.equal(fill.visitConflicts({agent:'RWM',tenancy:'Permanent'},{agent:'Ray White Yamba',tenancy:'Permanent'}).length,0);
  assert.equal(fill.visitConflicts({agent:'Elders',tenancy:''},{agent:'LJH',tenancy:''}).length,1);
  assert.equal(fill.agentForForm({agent:'',agentSet:true},job,meta),'');
  assert.equal(blank.ptype,'House');
});

test('calendar appointment keeps an unknown agent and maps a known one',function(){
  const job={addr:'1 Sample St',agent:'',svc:'2026-11-08T09:00:00+11:00'};
  const known=jr.appointmentPatch(job,{agent:''},{iso:'2026-11-08T09:00:00+11:00',description:'Agent: Ray White Yamba',location:'1 Sample St'});
  assert.equal(known.job.agent,RW);
  assert.equal(known.formPatch.agent,RW);
  const unknown=jr.appointmentPatch(job,{agent:''},{iso:'2026-11-08T09:00:00+11:00',description:'Agent: McGrath',location:'1 Sample St'});
  assert.equal(unknown.job.agent,'McGrath');
  const bare=jr.appointmentPatch({addr:'1 Sample St',agent:'Ray White'},{agent:'Ray White'},{description:'Agent: Ray White',location:'1 Sample St',iso:'2026-11-08T09:00:00+11:00'});
  assert.equal(bare.job.agent,'Ray White');
  assert.equal(bare.formPatch.agent,undefined);
  const titled=jr.appointmentPatch({addr:'1 Sample St, Yamba NSW 2464',agent:'',section:''},{agent:'',ptype:'House'},{summary:'1 Sample St, Yamba, RWY, Holiday',description:'',location:'1 Sample St, Yamba NSW 2464',iso:'2026-11-08T09:00:00+11:00'});
  assert.equal(titled.job.agent,RW);
  assert.equal(titled.formPatch.agent,RW);
  assert.equal(titled.job.section,'Holiday');
  assert.equal(titled.formPatch.tenancy,'Holiday');
  assert.equal(titled.job.ptype,undefined);
  const kept=jr.appointmentPatch({agent:'McGrath',section:'Permanent'},{agent:'McGrath',tenancy:'Permanent',ptype:'Unit'},{summary:'1 Sample St, Yamba, RWY, Holiday',description:'',iso:'2026-11-08T09:00:00+11:00'});
  assert.equal(kept.job.agent,'McGrath');
  assert.equal(kept.job.section,'Permanent');
  assert.equal(kept.formPatch.agent,undefined);
  assert.equal(kept.formPatch.tenancy,undefined);
});

test('the agent slot joins a name and tenancy once',function(){
  [RW,RW,RH,LJH].forEach(function(code){
    assert.equal(fill.agentSlot(code,'Holiday'),code+' Holiday');
    assert.equal(fill.agentSlot(code,'Permanent'),code+' Perm');
    assert.equal(fill.agentSlot(code,'PERM'),code+' Perm');
  });
  assert.equal(fill.agentSlot('Ray White Yamba','Holiday'),RW+' Holiday');
  assert.equal(fill.agentSlot('Ray White Maclean','Permanent'),RW+' Perm');
  assert.equal(fill.agentSlot('Raine & Horne','Holiday'),RH+' Holiday');
  assert.equal(fill.agentSlot('Lifestyle','Permanent'),LIFE+' Perm');
  assert.equal(fill.agentSlot('LIFE','Holiday'),LIFE+' Holiday');
  assert.equal(fill.agentSlot('LIFE Holiday','Holiday'),LIFE+' Holiday');
  assert.equal(fill.agentSlot('LJ Hooker Iluka','Permanent'),LJH+' Perm');
  assert.equal(fill.agentSlot('RWY',''),RW);
  assert.equal(fill.agentSlot('','Holiday'),'Holiday');
  assert.equal(fill.agentSlot('','Permanent'),'Perm');
  assert.equal(fill.agentSlot('',''),'');
  assert.equal(fill.agentSlot('RWY Holiday','Holiday'),RW+' Holiday');
  assert.equal(fill.agentSlot('RWY Perm',''),RW+' Perm');
  assert.equal(fill.agentSlot('RWY Holiday','Permanent'),RW+' Perm');
  assert.equal(fill.agentSlot('RWY, Holiday','Holiday'),RW+' Holiday');
  assert.equal(fill.agentSlot('McGrath','Holiday'),'McGrath Holiday');
  assert.equal(fill.agentSlot('McGrath',''),'McGrath');
  assert.equal(fill.agentSlot('Elders','Holiday'),ELD+' Holiday');
  assert.equal(fill.agentSlot('Ray White','Holiday'),'Ray White Holiday');
  assert.doesNotMatch(fill.agentSlot('RWY Holiday','Holiday'),/Holiday Holiday/);
  assert.doesNotMatch(fill.agentSlot('RWY Perm','Permanent'),/Perm Perm/);
  assert.equal(fill.agentSlot('Holiday RWY',''),RW+' Holiday');
  assert.equal(fill.agentSlot('Holiday RWY','Permanent'),RW+' Perm');
  assert.equal(fill.agentSlot('Perm Lifestyle',''),LIFE+' Perm');
  assert.equal(fill.agentSlot('HOLIDAY, RWM',''),RW+' Holiday');
  assert.equal(fill.agentSlot('Holiday Ray White Yamba',''),RW+' Holiday');
  assert.equal(fill.agentSlot('R&H Perm',''),RH+' Perm');
  assert.equal(fill.agentSlot('Holiday McGrath',''),'Holiday McGrath');
  assert.equal(fill.agentSlot('Holiday McGrath','Holiday'),'McGrath Holiday');
  assert.equal(fill.agencyFields('Holiday RWY').agent,RW);
  assert.equal(fill.agencyFields('Holiday RWY').tenancy,'Holiday');
  assert.equal(fill.agencyFields('Perm, Lifestyle').agent,LIFE);
  assert.equal(fill.agencyFields('Perm, Lifestyle').tenancy,'Permanent');
  assert.equal(fill.agencyFields('Elders').agent,ELD);
  assert.equal(fill.agentForForm({agent:'Holiday RWY'},{agent:'McGrath'},{}),RW);
  assert.equal(fill.tenancyForForm({agent:'Holiday RWY',tenancy:''},{section:''},{}),'Holiday');
  assert.equal(fill.tenancyForForm({agent:'Holiday RWY',tenancy:'',tenancySet:true},{section:'Holiday'},{}),'');
  assert.equal(fill.tenancyForForm({agent:'RWY',tenancy:''},{section:'Permanent'},{}),'Permanent');
});

test('australian mobiles keep a leading zero and the 0### ### ### groups',function(){
  assert.equal(fill.phoneFormat(400111222),'0400 111 222');
  assert.equal(fill.phoneFormat('400111222'),'0400 111 222');
  assert.equal(fill.phoneFormat('0400111222'),'0400 111 222');
  assert.equal(fill.phoneFormat('0400 111 222'),'0400 111 222');
  assert.equal(fill.phoneFormat('+61 400 111 222'),'0400 111 222');
  assert.equal(fill.phoneFormat('+61400111222'),'0400 111 222');
  assert.equal(fill.phoneFormat('61400111222'),'0400 111 222');
  assert.equal(fill.phoneFormat('+61 0400 111 222'),'0400 111 222');
  assert.equal(fill.phoneFormat('4.00111222e8'),'0400 111 222');
  assert.equal(fill.phoneFormat('(0400) 111-222'),'0400 111 222');
  assert.equal(fill.phoneFormat('02 6649 0000'),'02 6649 0000');
  assert.equal(fill.phoneFormat('+61 2 6649 0000'),'02 6649 0000');
  assert.equal(fill.phoneFormat('0266490000'),'02 6649 0000');
  assert.equal(fill.phoneFormat(266490000),'266490000');
  assert.equal(fill.phoneFormat('66490000'),'6649 0000');
  assert.equal(fill.phoneFormat('1300123456'),'1300 123 456');
  assert.equal(fill.phoneFormat('040011122'),'040011122');
  assert.equal(fill.phoneFormat('12345'),'12345');
  assert.equal(fill.phoneFormat('4.00e8'),'4.00e8');
  assert.equal(fill.phoneFormat('pat@example.com'),'pat@example.com');
  assert.equal(fill.phoneFormat(''),'');
  assert.equal(fill.phoneFormat(null),'');
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
