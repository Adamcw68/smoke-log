const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const alarm=require('./alarmedit.js');

test('brand and model lists include the common alarms and keep a saved custom value',function(){
  alarm.BRANDS.forEach(function(name){
    assert.ok(['Clipsal','Brooks','Red','Quell','PSA','Emerald','Cavius','Lifesaver','Kidde','Firepro','Hager'].indexOf(name)>=0);
  });
  assert.deepEqual(alarm.BRANDS,['Clipsal','Brooks','Red','Quell','PSA','Emerald','Cavius','Lifesaver','Kidde','Firepro','Hager']);
  const brands=alarm.brandChoices('Acme Alarms');
  assert.equal(brands.options.some(function(o){return o.value==='Clipsal'}),true);
  assert.equal(brands.options.some(function(o){return o.value==='Other'}),true);
  const custom=brands.options.filter(function(o){return o.value==='Acme Alarms'});
  assert.equal(custom.length,1);
  assert.equal(custom[0].selected,true);
  assert.deepEqual(alarm.modelsFor('Clipsal').slice(0,3),['755LPSMA4','755RSMA','755PSMA4']);
  assert.ok(alarm.modelsFor('Brooks').indexOf('EIB650i')>=0);
  assert.ok(alarm.modelsFor('Brooks').indexOf('EIB3016')>=0);
  assert.ok(alarm.modelsFor('Brooks').indexOf('PFC-610')>=0);
  assert.ok(alarm.modelsFor('Brooks').indexOf('PFC-450')>=0);
  assert.ok(alarm.modelsFor('Red').indexOf('R240RC')>=0);
  assert.ok(alarm.modelsFor('Red').indexOf('R10RF')>=0);
  assert.ok(alarm.modelsFor('Quell').length>0);
  assert.ok(alarm.modelsFor('Clipsal').indexOf('SMA4')>=0);
  const clipsal=alarm.modelChoices('Clipsal','ZZ9');
  assert.equal(clipsal.options.some(function(o){return o.value==='755LPSMA4'}),true);
  assert.equal(clipsal.options.filter(function(o){return o.value==='ZZ9'&&o.selected}).length,1);
  assert.equal(clipsal.options.some(function(o){return o.value==='Other'}),true);
  assert.equal(alarm.modelChoices('Brooks','EIB650i').options.some(function(o){return o.value==='755LPSMA4'}),false);
  assert.equal(alarm.knownBrand('clipsal'),'Clipsal');
  assert.equal(alarm.knownModel('Clipsal','sma4'),'SMA4');
});

test('same as previous copies details and power, and leaves location and photos alone',function(){
  const prev={
    manufacturer:'Clipsal',model:'755LPSMA4',power:['HW','Lithium'],expiry:'08/2031',mfd:'08/2021',
    mount:'Ceiling',room:'Hallway',bedno:'2',other:'Stairs',adjacent:'Bed 1',
    photos:['shot-a'],db:'90',sensor:['Photo-Electric'],isNew:true,
    yn:{comply:'Yes',located:'No',button:'Yes',cleaned:'Yes'}
  };
  const cur={
    manufacturer:'Old',model:'X',power:['9v'],expiry:'01/2020',mfd:'01/2010',
    mount:'Wall',room:'Lounge',bedno:'',other:'',adjacent:'Door',
    photos:['shot-b'],yn:{comply:'No'}
  };
  const plan=alarm.copyFromPrevious(prev,cur);
  assert.equal(plan.empty,false);
  assert.equal(plan.overwrite,true);
  assert.equal(plan.fields.manufacturer,'Clipsal');
  assert.equal(plan.fields.model,'755LPSMA4');
  assert.deepEqual(plan.fields.power,['240v','Lithium']);
  assert.equal(plan.fields.expiry,undefined);
  assert.equal(plan.fields.mfd,undefined);
  assert.deepEqual(plan.fields.yn,{comply:'Yes',located:'No',button:'Yes',cleaned:'Yes'});
  assert.equal(plan.fields.mount,undefined);
  assert.equal(plan.fields.room,undefined);
  assert.equal(plan.fields.photos,undefined);
  assert.equal(plan.fields.adjacent,undefined);
  assert.equal(plan.fields.db,undefined);
  assert.equal(plan.fields.sensor,undefined);
  assert.equal(plan.fields.isNew,undefined);
  assert.equal(cur.photos[0],'shot-b');
  assert.equal(cur.room,'Lounge');
  assert.equal(alarm.powerLabel('240v'),'240V');
  assert.equal(alarm.powerLabel('HW'),'240V');
  assert.equal(alarm.powerLabel('9v'),'9V');
  assert.equal(alarm.powerLabel('Lithium'),'10yr lithium');
  assert.equal(/\bHW\b/.test(alarm.powerLabel('HW')+alarm.powerLabel('240v')),false);
  const blank=alarm.copyFromPrevious({mount:'Ceiling',room:'Hallway',photos:['only'],expiry:'08/2031',mfd:'08/2021'},{expiry:'01/2020',mfd:'01/2010'});
  assert.equal(blank.empty,true);
  assert.equal(blank.overwrite,false);
  assert.equal(blank.fields.expiry,undefined);
  assert.equal(blank.fields.mfd,undefined);
  assert.deepEqual(blank.fields.power,[]);
  assert.equal(cur.expiry,'01/2020');
  assert.equal(cur.mfd,'01/2010');
});

test('the worksheet uses dropdowns, copies the previous alarm, and patches Basil colour only',function(){
  const html=fs.readFileSync('index.html','utf8');
  const sw=fs.readFileSync('sw.js','utf8');
  const start=html.indexOf('function alarmHTML');
  const end=html.indexOf('function serviceCert');
  const fn=html.slice(start,end);
  assert.match(fn,/Same as previous alarm/);
  assert.match(fn,/keeps its own expiry and manufacture date/);
  assert.match(html,/Expiry, manufacture date, location and photos stay/);
  assert.equal(html.includes('power, expiry and Yes/No'),false);
  assert.match(fn,/data-sameprev/);
  assert.match(fn,/brandChoiceHTML/);
  assert.match(fn,/modelChoiceHTML/);
  assert.match(html,/data-brand/);
  assert.match(html,/data-model/);
  assert.match(html,/value:'Other'/);
  assert.match(fn,/>Model</);
  assert.match(fn,/>Manufacturer</);
  assert.match(fn,/240V/);
  assert.equal(fn.includes('>HW<'),false);
  assert.equal(html.includes('Mark today\'s completed jobs Basil'),false);
  assert.equal(html.includes('data-daybasil'),false);
  assert.match(html,/CCSACal\.syncBasilColour/);
  assert.match(html,/data-path="done"/);
  assert.match(html,/const GCAL_SCOPE='https:\/\/www\.googleapis\.com\/auth\/calendar\.events'/);
  assert.doesNotMatch(html,/calendar\.readonly/);
  assert.match(html,/method:'PATCH'/);
  assert.match(html,/JSON\.stringify\(body\)/);
  assert.match(sw,/alarmedit\.js/);
  assert.match(html,/src="alarmedit\.js"/);
});
