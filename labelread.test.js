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
