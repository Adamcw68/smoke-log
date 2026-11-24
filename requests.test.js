const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const requests=require('./requests.js');

const agency={id:'rwm',code:'Ray White Maclean/Yamba',name:'Ray White Maclean/Yamba'};

test('a request keeps the access phone off the agency record',function(){
  const built=requests.buildOne(agency,{
    address:'12 Request Lane, Maclean NSW 2463',
    tenancy:'Perm',
    contactName:'Sam Resident',
    contactPhone:'0412 555 019',
    timeframe:'Next fortnight',
    notes:'Two alarms'
  },'2026-11-14T01:00:00.000Z');
  assert.equal(built.ok,true);
  assert.equal(built.request.status,'new');
  assert.equal(built.request.tenancy,'Permanent');
  assert.equal(built.access.contactName,'Sam Resident');
  assert.equal(built.access.contactPhone,'0412 555 019');
  const pub=JSON.stringify(requests.publicRequest(built.request));
  assert.equal(pub.includes('Sam Resident'),false);
  assert.equal(pub.includes('0412 555 019'),false);
  assert.equal(pub.includes('contactPhone'),false);
  const job=requests.localJob(built.request,built.access);
  assert.equal(job.contact,'Sam Resident');
  assert.equal(job.p1,'0412 555 019');
  assert.equal(job.agent,'Ray White Maclean/Yamba');
  const done=requests.applyStatus(built.request,built.access,'completed');
  assert.equal(done.ok,false);
  const accepted=requests.applyStatus(built.request,built.access,'accepted');
  assert.equal(accepted.ok,true);
  assert.equal(accepted.access.contactPhone,'0412 555 019');
  const finished=requests.applyStatus(accepted.request,accepted.access,'completed');
  assert.equal(finished.ok,true);
  assert.equal(finished.request.status,'completed');
  assert.equal(finished.access,null);
  assert.equal(JSON.stringify(finished.request).includes('0412'),false);
});

test('notes cannot carry a phone or email, and a large file is refused',function(){
  const phone=requests.buildOne(agency,{address:'1 Test Street, Yamba NSW 2464',tenancy:'Holiday',contactName:'Sam Resident',contactPhone:'0412555019',notes:'Call 0412 555 019'},'2026-11-14T02:00:00.000Z');
  assert.equal(phone.ok,false);
  const mail=requests.buildOne(agency,{address:'1 Test Street, Yamba NSW 2464',tenancy:'Holiday',contactName:'sam@example.com',contactPhone:'0412555019',notes:''},'2026-11-14T02:00:00.000Z');
  assert.equal(mail.ok,false);
  const big=requests.buildOne(agency,{address:'1 Test Street, Yamba NSW 2464',tenancy:'Holiday',contactName:'Sam Resident',contactPhone:'0412555019',fileName:'big.pdf',fileType:'application/pdf',fileData:'A'.repeat(700000)},'2026-11-14T02:00:00.000Z');
  assert.equal(big.ok,false);
  assert.match(big.error,/450 KB/);
});

test('a CSV builds many requests and the template is downloadable',function(){
  const csv=requests.csvTemplate()+'"4 Booked Street, Maclean NSW 2463",Holiday,Sam Resident,02 6645 1234,This month,Gate code is with the office\n';
  const parsed=requests.parseCsv(csv);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.rows.length,2);
  const many=requests.buildMany(agency,parsed.rows,'2026-11-14T03:00:00.000Z');
  assert.equal(many.ok,true,many.error);
  assert.equal(many.items.length,2);
  assert.equal(many.items[0].request.address.includes('18 Example'),true);
  assert.equal(JSON.stringify(many.items.map(function(item){return item.request})).includes('0412000111'),false);
  assert.equal(many.items[0].access.contactPhone,'0412 000 111');
  assert.equal(many.items[0].access.accessSms,true);
  const too=requests.parseCsv('address,tenancy,contact name,contact phone,timeframe,notes\n'+Array(41).fill('1 St, Yamba NSW 2464,Permanent,Sam,0412000111,,').join('\n'));
  assert.equal(too.ok,false);
  const rules=fs.readFileSync('firestore.rules','utf8');
  const line=rules.split('\n').filter(function(row){return row.indexOf('portal-request-keys: ')>=0})[0];
  assert.deepEqual(line.split(': ')[1].trim().split(','),requests.REQUEST_KEYS);
  const access=rules.split('\n').filter(function(row){return row.indexOf('portal-access-keys: ')>=0})[0];
  assert.deepEqual(access.split(': ')[1].trim().split(','),requests.ACCESS_KEYS);
});

test('demo requests shown to an agency do not include the access phone',function(){
  const rows=requests.demoPublic('rwm');
  assert.equal(rows.length,2);
  assert.equal(rows[0].status,'new');
  assert.equal(rows[1].status,'accepted');
  const text=JSON.stringify(rows);
  assert.equal(text.includes('Sam Resident'),false);
  assert.equal(text.includes('0412 555 019'),false);
  const access=requests.demoAccess('rwm');
  assert.equal(access[Object.keys(access)[0]].accessSms,true);
});

test('a spreadsheet preview reports each bad row and a holiday job gets no access SMS',function(){
  const csv=requests.submissionTemplate()+'"",Perm,Alex,0412 000 333,alex@example.com,Gate,no,24/12/2026,Ok\n"9 Broken Street, Yamba NSW 2464",Holiday,Alex,123,not-an-email,Call 0412 000 111,maybe,32/13/2026,Note\n';
  const parsed=requests.parseCsv(csv);
  assert.equal(parsed.ok,true);
  const preview=requests.previewRows(agency,parsed.rows,'2026-11-24T01:00:00.000Z');
  assert.equal(preview[0].ok,true);
  assert.equal(preview[0].item.access.contactPhone,'0412 000 111');
  assert.equal(preview[0].item.access.tenantEmail,'alex@example.com');
  assert.equal(preview[0].item.request.preferredDate,'2026-12-24');
  assert.equal(JSON.stringify(preview[0].item.request).includes('alex@example.com'),false);
  assert.equal(preview[1].ok,true);
  assert.equal(preview[1].item.access.accessSms,false);
  assert.equal(preview[1].item.request.vacant,'yes');
  assert.equal(preview[2].ok,false);
  assert.match(preview[3].error,/phone|email|date|Vacant/);
  const job=requests.localJob(preview[1].item.request,preview[1].item.access);
  assert.match(job.notes,/No access SMS/);
  assert.equal(job.notes.includes('0412'),false);
  assert.equal(job.agent,'Ray White Maclean/Yamba');
});

test('Adam sees only the chosen number of jobs from each agent',function(){
  const rows=[];
  for(let i=0;i<6;i++){
    const built=requests.buildOne(agency,{address:(10+i)+' Queue Street, Yamba NSW 2464',tenancy:'Permanent',contactName:'Sam Resident',contactPhone:'0412 000 11'+i,timeframe:'Next week'},'2026-11-24T0'+i+':00:00.000Z');
    assert.equal(built.ok,true,built.error);
    rows.push(built.request);
  }
  const other=requests.buildOne({id:'lifestyle',code:'Lifestyle Maclean/Yamba'},{address:'2 Other Street, Maclean NSW 2463',tenancy:'Holiday',contactName:'Office',contactPhone:'0412 111 222'},'2026-11-24T00:30:00.000Z');
  rows.push(other.request);
  const four=requests.agentQueue(rows,4);
  assert.equal(four.limit,4);
  assert.equal(four.visible.filter(function(row){return row.agencyId==='rwm'}).length,4);
  assert.equal(four.queued.rwm,2);
  assert.equal(four.visible.filter(function(row){return row.agencyId==='lifestyle'}).length,1);
  assert.equal(four.queued.lifestyle,0);
  rows[0].status='scheduled';
  const after=requests.agentQueue(rows,4);
  assert.equal(after.visible.filter(function(row){return row.agencyId==='rwm'}).length,4);
  assert.equal(after.queued.rwm,1);
  assert.equal(requests.queueLimit(3),3);
  assert.equal(requests.queueLimit(9),4);
  assert.equal(other.access.accessSms,false);
});
