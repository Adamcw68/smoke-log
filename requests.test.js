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
  assert.equal(many.items[0].access.contactPhone,'0412000111');
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
  assert.equal(access[rows[0].id].contactPhone,'0412 555 019');
});
