const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const find=require('./addressfind.js');

const river={id:'river',addr:'18 River Street, Maclean NSW 2463',street:'18 River Street',town:'Maclean',agent:'Ray White Maclean/Yamba',contact:'Pat Sample',ident:'',section:'Permanent',arch:null};
const unit={id:'queen',addr:'Unit 1, 14 Queen Street, Yamba NSW 2464',street:'Unit 1, 14 Queen Street',town:'Yamba',agent:'Lifestyle',contact:'',ident:'Lot 2',section:'Holiday',arch:'2026-11-01T01:00:00.000Z'};
const beach={id:'beach',addr:'8/5 Beach St, Yamba NSW 2464',street:'8/5 Beach St',town:'Yamba',agent:'Raine & Horne',section:'Holiday',arch:null};
const forms={beach:{addr:'8/5 Beach Street, Yamba',ident:'Beach house',done:true}};

test('a job header puts the unit and street above the suburb',function(){
  assert.deepEqual(find.addressLines('Unit 1, 14 Queen Street, Yamba NSW 2464','Unit 1, 14 Queen Street','Yamba'),{line1:'Unit 1, 14 Queen Street',line2:'Yamba NSW 2464'});
  assert.deepEqual(find.addressLines('18 River Street, Maclean NSW 2463','18 River Street','Maclean'),{line1:'18 River Street',line2:'Maclean NSW 2463'});
  assert.deepEqual(find.addressLines('8/5 Beach St, Yamba NSW 2464','8/5 Beach St','Yamba'),{line1:'8/5 Beach St',line2:'Yamba NSW 2464'});
  assert.deepEqual(find.addressLines('1 Sample St','1 Sample St',''),{line1:'1 Sample St',line2:''});
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/header \.jobst,\.joblead \.jobst\{[^}]*font-size:1\.5rem/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*header\{[^}]*padding:4px 8px/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*header img\{height:26px\}/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*header \.jobst\{[^}]*font-size:1\.15rem;font-weight:800[^}]*text-overflow:ellipsis/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*\.joblead \.jobst\{[^}]*font-size:1\.35rem;font-weight:800/);
  assert.match(html,/CCSAAddress\.addressLines/);
  const sync=html.slice(html.indexOf('function paintSync'),html.indexOf('async function backupForSync'));
  const applied=html.slice(html.indexOf('async function applySyncResult'),html.indexOf('function syncHooks'));
  assert.match(sync,/paintHead\(open\)/);
  assert.match(applied,/openJobId\(\)/);
  assert.match(applied,/paintHead\(open\)/);
  assert.doesNotMatch(applied,/&&CURJOB\)renderJob/);
  assert.match(html,/class="jobst"/);
  assert.match(html,/class="jobsub"/);
});

test('street suffix, unit wording, suburb and part of the street all match',function(){
  assert.equal(find.matches([river.addr,river.street,river.town],'18 river st'),true);
  assert.equal(find.matches([river.addr],'RIVER'),true);
  assert.equal(find.matches([river.addr],'maclean'),true);
  assert.equal(find.matches([river.addr],'18  River'),true);
  assert.equal(find.matches([unit.addr,unit.street,unit.town],'1/14 queen st'),true);
  assert.equal(find.matches([unit.addr],'unit 1 14 Queen Street'),true);
  assert.equal(find.matches([unit.addr],'14 queen yamba'),true);
  assert.equal(find.matches([beach.addr,beach.street],'unit 8 5 beach street'),true);
  assert.equal(find.matches([beach.addr],'8/5 Beach St'),true);
  assert.equal(find.matches([beach.street],'beach rd'),false);
  assert.equal(find.matches([river.addr],'queen'),false);
  assert.equal(find.matches([''],'...'),false);
  assert.equal(find.matches([river.addr],''),true);
  assert.equal(find.matches([river.addr,river.agent],'ray white'),true);
});

test('a search returns archived and completed jobs and ignores the status tab',function(){
  const jobs=[river,unit,beach];
  assert.deepEqual(find.searchJobs(jobs,forms,'queen st').map(function(j){return j.id}),['queen']);
  assert.equal(jobs[1].arch!==null,true);
  assert.deepEqual(find.searchJobs(jobs,forms,'beach street').map(function(j){return j.id}),['beach']);
  assert.deepEqual(find.searchJobs(jobs,forms,'beach house').map(function(j){return j.id}),['beach']);
  assert.deepEqual(find.searchJobs(jobs,forms,'').map(function(j){return j.id}),['river','queen','beach']);
  const html=fs.readFileSync('index.html','utf8');
  const list=html.slice(html.indexOf('function renderList'),html.indexOf('function card'));
  assert.match(list,/CCSAAddress\.searchJobs\(JOBS,FORMS,UI\.q\)/);
  assert.match(list,/if\(!searching\)list=list\.filter\(passesJobFilter\)/);
  assert.match(list,/Search includes to-do, completed and archived jobs/);
  const portal=fs.readFileSync('portal/app.js','utf8');
  assert.match(portal,/CCSAAddress\.matches/);
  assert.match(portal,/p\.address,p\.street,p\.town,p\.ident/);
});
