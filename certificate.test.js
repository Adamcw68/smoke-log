const test=require('node:test');
const assert=require('node:assert/strict');
const portal=require('./portaldata.js');
const certs=require('./certificate.js');

function find(address){
  const view=portal.demoView('rwm');
  return view.certificates.filter(function(c){return c.address.indexOf(address)===0})[0];
}

test('a compliance certificate names the property, alarms and result',function(){
  const cert=find('18 River');
  const view=certs.viewModel(cert);
  assert.equal(view.brand,'Clarence Coast Smoke Alarms');
  assert.equal(view.title,'Compliance certificate');
  assert.equal(view.address,'18 River Street, Maclean NSW 2463');
  assert.equal(view.date,'12 Aug 2026');
  assert.equal(view.agency,'RWM');
  assert.equal(view.tenancy,'Permanent');
  assert.equal(view.result,'Pass');
  assert.equal(view.alarms[0].location,'Ceiling, Hallway');
  assert.equal(view.alarms[0].type,'Photo-Electric');
  assert.equal(view.alarms[0].power,'240v');
  assert.equal(view.alarms[0].expiry,'08/2031');
  assert.equal(view.alarms[0].result,'Pass');
  assert.equal(view.alarms[1].location,'Ceiling, Bedroom 1');
  assert.equal(view.alarms[1].power,'Lithium');
  assert.equal(view.alarms[1].result,'Pass');
  assert.match(view.statement,/Adam Westerman/);
  assert.match(view.statement,/does not include tenant names, phone numbers or email addresses/);
  const bytes=certs.buildCertificatePdf(cert);
  const text=certs.pdfText(bytes);
  assert.match(text,/^%PDF-1\.4/);
  assert.match(text,/%%EOF/);
  assert.match(text,/CLARENCE COAST SMOKE ALARMS/);
  assert.match(text,/Compliance certificate/);
  assert.match(text,/18 River Street, Maclean NSW 2463/);
  assert.match(text,/12 Aug 2026/);
  assert.match(text,/Photo-Electric/);
  assert.match(text,/08\/2031/);
  assert.match(text,/Bedroom 1/);
  assert.match(text,/Lithium/);
  assert.match(text,/Pass/);
  assert.match(text,/Adam Westerman/);
  assert.match(text,/Tenant contact details are not included/);
  assert.equal(text.includes('Jane Tenant'),false);
  assert.equal(text.includes('0400 111 222'),false);
  assert.equal(text.includes('jane.tenant@example.com'),false);
  assert.equal(certs.fileName(cert),'CCSA-2026-08-12-18-River-Street.pdf');
  const start=text.match(/startxref\n(\d+)/);
  assert.equal(text.slice(+start[1],+start[1]+4),'xref');
});

test('replace and fail are printed and a long visit stays a valid PDF',function(){
  const replaced=find('15 Short');
  const failed=find('9 Church');
  const replaceText=certs.pdfText(certs.buildCertificatePdf(replaced));
  const failText=certs.pdfText(certs.buildCertificatePdf(failed));
  assert.match(replaceText,/Replace/);
  assert.match(replaceText,/07\/2036/);
  assert.match(failText,/Fail/);
  assert.match(failText,/Lounge/);
  assert.match(failText,/9v/);
  assert.match(failText,/10\/2026/);
  assert.equal(failText.includes('0400 111 222'),false);
  const alarms=[];
  for(let i=0;i<30;i++)alarms.push({n:i+1,location:'Ceiling, Bedroom '+(i+1)+' near the long hallway outside the laundry and beside the stair',type:'Photo-Electric',power:'240v',expiry:'08/2031',result:i===4?'fail':'pass'});
  const many=Object.assign({},failed,{alarms:alarms,result:'fail',statement:failed.statement});
  const manyText=certs.pdfText(certs.buildCertificatePdf(many));
  assert.match(manyText,/^%PDF-1\.4/);
  assert.match(manyText,/Bedroom 30/);
  assert.match(manyText,/continued/);
  assert.equal((manyText.match(/endobj/g)||[]).length>=6,true);
});
