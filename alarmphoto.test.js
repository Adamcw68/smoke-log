/* Each alarm offers the camera before the worksheet fields.
   Photo reading still suggests a value and does not replace one already entered. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const lr=require('./labelread.js');

function alarmBlock(){
  const html=fs.readFileSync('index.html','utf8');
  const start=html.indexOf('function alarmHTML');
  const end=html.indexOf('function serviceCert');
  assert.ok(start>0&&end>start);
  return html.slice(start,end);
}

test('the camera sits at the top of every alarm, before the fields it can fill',function(){
  const fn=alarmBlock();
  const photo=fn.indexOf("photoBox('al'+i");
  const reading=fn.indexOf('ocr-al');
  const place=['Location','Power','Model','Expiry (MM/YYYY)','Checks'].map(function(label){
    return fn.indexOf('>'+label+'<');
  });
  assert.ok(photo>0);
  assert.ok(reading>photo);
  place.forEach(function(at){assert.ok(at>reading, 'field should follow the photo control')});
  assert.equal(fn.indexOf("photoBox('al'+i",photo+1),-1);
  const html=fs.readFileSync('index.html','utf8');
  const box=html.slice(html.indexOf('function photoBox'),html.indexOf('async function paintThumbs'));
  assert.match(box,/Take photo/);
  assert.match(box,/capture="environment"/);
  assert.match(box,/Gallery/);
  assert.match(box,/lead/);
  const job=html.indexOf('<h2>Job photos</h2>');
  assert.ok(job>0);
  assert.ok(html.indexOf("photoBox('job'",job)>job);
  assert.ok(html.indexOf("photoBox('job'",job)<html.indexOf('Photos are compressed',job));
  const sheet=html.slice(html.indexOf('function renderJob'),html.indexOf('function paintYn'));
  const alarmsAt=sheet.indexOf('<h2>Smoke alarm locations</h2>');
  assert.ok(alarmsAt>0);
  assert.equal(sheet.slice(0,alarmsAt).indexOf('quickHTML'),-1);
  assert.equal(sheet.indexOf('id="quick"'),-1);
  assert.ok(sheet.indexOf('alarmHTML')>alarmsAt);
  assert.match(box,/data-photo="\$\{slot\}"/);
});

test('a label reading still has to be applied, and an existing answer is not replaced quietly',function(){
  const html=fs.readFileSync('index.html','utf8');
  const start=html.indexOf('function ocrApply');
  const end=html.indexOf('/* ---------- archive',start);
  const fn=html.slice(start,end);
  const ask=fn.indexOf('if(!confirm(`Replace');
  const write=fn.indexOf('a[k]=v');
  assert.ok(ask>0&&write>ask);
  assert.match(fn,/Nothing is changed until you tap Apply|Nothing changes until you tap Apply|if\(!confirm/);
  assert.match(html,/Check each value against the label before applying/);
  const other={power:['9v'],expiry:'01/2030',model:'755'};
  const copy=JSON.parse(JSON.stringify(other));
  const plan=lr.transferField({power:['9v'],expiry:'11/2036',model:'EIB650i'},{manufacturer:'Clipsal',model:'SMA4'},'model','SMA4');
  assert.equal(plan.value,'SMA4');
  assert.deepEqual(other,copy);
  assert.equal(plan.mfd,null);
});

test('photo reading still keeps Clipsal date codes, handwritten expiry, SMA4 mains and MM/YYYY',function(){
  const factory=lr.clipsalFactoryExpiry('CLIPSAL\nDOM 210119',{nowYear:2026});
  assert.equal(factory.manufacture.display,'01/2019');
  assert.equal(factory.expiry.display,'01/2029');
  assert.equal(factory.expiry.derived,true);
  const written=lr.handwrittenExpiry('replace 08/2027',2026);
  assert.equal(written.expiry.display,'08/2027');
  assert.equal(written.expiry.derived,false);
  assert.equal(lr.normalizeExpiry('21/01/2029').display,'01/2029');
  assert.equal(lr.normalizeExpiry('08/2027').display,'08/2027');
  assert.deepEqual(lr.ensureSma4Mains(['9v']),['9v','240v']);
  assert.match(lr.correctReading({fields:{manufacturer:{v:'Clipsal'},model:{v:'SMA4'},power:{v:['9v'],note:''}}}).fields.power.note,/240V mains/);
});
