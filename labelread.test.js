const test=require('node:test');
const assert=require('node:assert/strict');
const lr=require('./labelread.js');

test('model normalization recognises Clipsal SMA4 spacing and case',function(){
  ['SMA4','sma4','SMA-4','SMA 4','S.M.A.4','sma  4'].forEach(function(m){
    assert.equal(lr.isClipsalSma4('Clipsal',m),true,m);
    assert.equal(lr.isClipsalSma4('',m),true,m);
  });
  ['Clipsal SMA4','CLIPSAL-SMA4','clipsal sma 4','Clipsal/SMA4'].forEach(function(m){
    assert.equal(lr.normToken(m),'CLIPSALSMA4');
    assert.equal(lr.isClipsalSma4('',m),true,m);
    assert.equal(lr.isClipsalSma4('Clipsal',m),true,m);
  });
});

test('other models and incomplete readings are not treated as SMA4',function(){
  assert.equal(lr.isClipsalSma4('Clipsal','755'),false);
  assert.equal(lr.isClipsalSma4('Clipsal','SMA40'),false);
  assert.equal(lr.isClipsalSma4('Clipsal','SMA'),false);
  assert.equal(lr.isClipsalSma4('Brooks','SMA4'),false);
  assert.equal(lr.isClipsalSma4('','') ,false);
  const empty={fields:{}};
  lr.correctReading(empty);
  assert.deepEqual(empty.fields,{});
  const dated={fields:{expiry:{v:'11/2034',note:'read near expiry'}}};
  lr.correctReading(dated);
  assert.equal(dated.fields.power,undefined);
  assert.equal(dated.fields.model,undefined);
  assert.equal(dated.fields.expiry.v,'11/2034');
});

test('SMA4 supply is 240V mains and keeps a separate backup cell',function(){
  const r={fields:{manufacturer:{v:'Clipsal'},model:{v:'SMA-4'},power:{v:['9v'],note:'power marking on label'}}};
  lr.correctReading(r);
  assert.deepEqual(r.fields.power.v,['9v','240v']);
  assert.match(r.fields.power.note,/240V mains/);
  assert.deepEqual(lr.ensureSma4Mains(['Lithium']),['240v','Lithium']);
  assert.deepEqual(lr.ensureSma4Mains(['9v','Lithium']),['9v','240v','Lithium']);
  assert.deepEqual(lr.ensureSma4Mains([]),['240v']);
  assert.deepEqual(lr.ensureSma4Mains(null),['240v']);
  assert.deepEqual(lr.ensureSma4Mains(['240v','9v']),['9v','240v']);
});

test('other models keep the supply the photo actually showed',function(){
  const clipsalOther={fields:{manufacturer:{v:'Clipsal'},model:{v:'755'},power:{v:['9v'],note:'power marking on label'}}};
  lr.correctReading(clipsalOther);
  assert.deepEqual(clipsalOther.fields.power.v,['9v']);
  const brooks={fields:{manufacturer:{v:'Brooks'},model:{v:'SMA4'},power:{v:['9v']}}};
  lr.correctReading(brooks);
  assert.deepEqual(brooks.fields.power.v,['9v']);
  const unknown={fields:{manufacturer:{v:'Kidde'},model:{v:'P3010'}}};
  lr.correctReading(unknown);
  assert.equal(unknown.fields.power,undefined);
});

test('Clipsal factory code 210119 is made 21 Jan 2019 and due 21 Jan 2029',function(){
  const hit=lr.clipsalFactoryExpiry('CLIPSAL\nDOM 210119',{nowYear:2026});
  assert.equal(hit.manufacture.iso,'2019-01-21');
  assert.equal(hit.manufacture.full,'21/01/2019');
  assert.equal(hit.manufacture.display,'01/2019');
  assert.equal(hit.expiry.iso,'2029-01-21');
  assert.equal(hit.expiry.display,'01/2029');
  assert.notEqual(hit.expiry.display,'21/01/2029');
  assert.equal(hit.expiry.derived,true);
  assert.equal(hit.explicit,false);
  assert.equal(hit.weak,false);
});

test('explicit expiry is not given another 10 years and beats a factory code',function(){
  const dated=lr.clipsalFactoryExpiry('CLIPSAL EXPIRY 21/01/2029\nDATE CODE 210119',{nowYear:2026});
  assert.equal(dated.explicit,true);
  assert.equal(dated.expiry.iso,'2029-01-21');
  assert.equal(dated.expiry.display,'01/2029');
  assert.equal(dated.expiry.derived,false);
  assert.equal(dated.manufacture.iso,'2019-01-21');
  assert.equal(dated.manufacture.display,'01/2019');
  const stamped=lr.clipsalFactoryExpiry('CLIPSAL EXP 210129',{nowYear:2026});
  assert.equal(stamped.explicit,true);
  assert.equal(stamped.expiry.iso,'2029-01-21');
  assert.equal(stamped.expiry.display,'01/2029');
  assert.equal(stamped.manufacture,null);
  const monthOnly=lr.clipsalFactoryExpiry('CLIPSAL REPLACE BY 01/2029',{nowYear:2026});
  assert.equal(monthOnly.expiry.display,'01/2029');
  assert.equal(monthOnly.expiry.derived,false);
  assert.notEqual(monthOnly.expiry.display,'01/2039');
});

test('bare or invalid codes are not treated as dates',function(){
  const bare=lr.clipsalFactoryExpiry('CLIPSAL\n210119',{nowYear:2026});
  assert.equal(bare.weak,true);
  assert.equal(bare.expiry.iso,'2029-01-21');
  assert.equal(bare.expiry.display,'01/2029');
  assert.equal(bare.manufacture.display,'01/2019');
  assert.equal(lr.clipsalFactoryExpiry('BROOKS DOM 210119',{nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL',{brand:'Brooks',nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL S/N 210119',{nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL MODEL 210119',{nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL DOM 21011988',{nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL DOM 320119',{nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL DOM 290221',{nowYear:2026}),null);
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL DOM 000119',{nowYear:2026}),null);
  const leap=lr.clipsalFactoryExpiry('CLIPSAL DOM 290220',{nowYear:2026});
  assert.equal(leap.manufacture.iso,'2020-02-29');
  assert.equal(leap.manufacture.display,'02/2020');
  assert.equal(leap.expiry.iso,'2030-02-28');
  assert.equal(leap.expiry.display,'02/2030');
  assert.equal(lr.clipsalFactoryExpiry('CLIPSAL DOM 210119\nDOM 150318',{nowYear:2026}),null);
  assert.equal(lr.normalizeExpiry('29/02/2021'),null);
  assert.equal(lr.normalizeExpiry('31/04/2029'),null);
  assert.equal(lr.normalizeExpiry('21/01/2029').iso,'2029-01-21');
  assert.equal(lr.normalizeExpiry('21/01/2029').display,'01/2029');
  assert.equal(lr.normalizeExpiry('01/2029').display,'01/2029');
  assert.equal(lr.formatExpiryTyping('21/01/2029',false),'01/2029');
  assert.equal(lr.formatExpiryTyping('29/02/2021',false),'29/02/2021');
});

test('handwritten date is expiry and is not given another 10 years',function(){
  const both=lr.reviewPhotoText('CLIPSAL SMA4\nDOM 210119\n03/2028',{nowYear:2026});
  assert.equal(both.expiry.display,'03/2028');
  assert.equal(both.expiry.derived,false);
  assert.notEqual(both.expiry.display,'03/2038');
  assert.notEqual(both.expiry.display,'01/2029');
  assert.equal(both.weak,true);
  assert.match(both.note,/Handwritten/);
  assert.match(both.note,/01\/2029/);
  assert.equal(both.manufacture.iso,'2019-01-21');
  assert.equal(both.manufacture.display,'01/2019');
  assert.equal(both.model,'SMA4');
  const only=lr.reviewPhotoText('03/2028',{nowYear:2026});
  assert.equal(only.expiry.display,'03/2028');
  assert.equal(only.expiry.derived,false);
  assert.equal(only.manufacture,null);
  const full=lr.handwrittenExpiry('21/01/2029',2026);
  assert.equal(full.expiry.display,'01/2029');
  assert.equal(full.expiry.iso,'2029-01-21');
  assert.equal(full.expiry.derived,false);
});

test('conflicting or unreadable dates and non-model numbers are not guessed',function(){
  const clash=lr.reviewPhotoText('03/2028\n06/2030',{nowYear:2026});
  assert.equal(clash.conflict,true);
  assert.equal(clash.expiry,null);
  assert.match(clash.note,/Confirm/);
  assert.equal(lr.handwrittenExpiry('03/12',2026).conflict,true);
  assert.equal(lr.readModel('CLIPSAL\nDOM 210119'),null);
  assert.equal(lr.readModel('CLIPSAL\nSERIAL AB12C\nS/N 998877'),null);
  assert.equal(lr.readModel('CAT NO 755PS'),null);
  assert.equal(lr.readModel('MODEL SMA4'),'SMA4');
  assert.equal(lr.readModel('CLIPSAL SMA-4'),'SMA4');
  const plan=lr.transferField({power:['9v'],model:''},{manufacturer:'Clipsal',model:'SMA4'},'model','SMA4');
  assert.equal(plan.value,'SMA4');
  assert.deepEqual(plan.power,['9v','240v']);
});

test('transfer sets 240V on that alarm only and does not invent unread fields',function(){
  const alarm={model:'',manufacturer:'',power:['9v'],expiry:''};
  const other={model:'755',power:['9v'],expiry:'01/2030'};
  const otherCopy=JSON.parse(JSON.stringify(other));
  const reading={manufacturer:'Clipsal',model:'SMA 4'};
  const powerPlan=lr.transferField(alarm,reading,'power',['9v']);
  assert.deepEqual(powerPlan.value,['9v','240v']);
  assert.equal(powerPlan.power,null);
  assert.deepEqual(other,otherCopy);
  assert.equal(alarm.expiry,'');
  const fromEmpty=lr.transferField({power:[]},reading,'model','SMA4');
  assert.equal(fromEmpty.value,'SMA4');
  assert.deepEqual(fromEmpty.power,['240v']);
  const keepBackup=lr.transferField({power:['Lithium']},{manufacturer:'Clipsal',model:'SMA4'},'model','SMA4');
  assert.deepEqual(keepBackup.power,['240v','Lithium']);
  const expiry=lr.transferField({power:['9v']},reading,'expiry','');
  assert.equal(expiry.value,'');
  assert.equal(expiry.power,null);
  const incomplete=lr.transferField({power:[]},{manufacturer:'',model:''},'power',[]);
  assert.deepEqual(incomplete.value,[]);
  assert.equal(incomplete.power,null);
});
