const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const portal=require('./portaldata.js');
const certs=require('./certificate.js');
const inv=require('./invoice.js');

function job(over){
  return Object.assign({id:'river',agent:'RWM',section:'Permanent',addr:'18 River Street, Maclean NSW 2463',street:'18 River Street',town:'Maclean',contact:'Jane Tenant',p1:'0400 111 222',p2:'02 6645 1234',arch:'2026-08-12T00:00:00.000Z'},over||{});
}
function form(over){
  return Object.assign({agent:'RWM',tenancy:'Permanent',addr:'18 River Street, Maclean NSW 2463',date:'2026-08-12',done:true,phoneLine:'0400 111 222',comments:'Email jane.tenant@example.com',tech:'Adam Westerman',alarms:3,al:[
    {isNew:true,newAns:'Yes',power:['240v'],yn:{battery:'No',comply:'Yes'}},
    {isNew:false,newAns:'No',power:['9v'],yn:{battery:'Yes',comply:'Yes'}},
    {isNew:false,newAns:'No',power:['Lithium'],yn:{battery:'Yes',comply:'Yes'}}
  ]},over||{});
}

test('GST is 10 percent of the ex-GST total and is omitted when not registered',function(){
  const plain=inv.totals([{description:'Visit',qty:1,unitCents:10000}],false);
  assert.equal(plain.exCents,10000);
  assert.equal(plain.gstCents,0);
  assert.equal(plain.totalCents,10000);
  const tax=inv.totals([{description:'Visit',qty:1,unitCents:10000}],true);
  assert.equal(tax.gstCents,1000);
  assert.equal(tax.totalCents,11000);
  assert.equal(inv.totals([{description:'Odd',qty:1,unitCents:333}],true).gstCents,33);
  const lines=inv.totals([{description:'A',qty:1,unitCents:1000},{description:'B',qty:2,unitCents:2500}],true);
  assert.equal(lines.exCents,6000);
  assert.equal(lines.gstCents,600);
  assert.equal(lines.totalCents,6600);
  assert.equal(inv.money(16500),'$165.00');
  assert.equal(inv.dollarsToCents('120.5'),12050);
  assert.equal(inv.dollarsToCents('12.345'),null);
});

test('invoice numbers are sequential and are not reused',function(){
  const settings=inv.defaultSettings();
  const first=inv.draftFromJob(job(),form(),settings);
  const opened=inv.issue(first,settings,[],'2026-11-13');
  assert.equal(opened.invoice.number,'INV-0001');
  assert.equal(opened.invoice.draft,false);
  assert.equal(opened.settings.nextNumber,2);
  const second=inv.draftFromJob(job({id:'next',addr:'6 Wharf Street, Maclean NSW 2463'}),form({addr:'6 Wharf Street, Maclean NSW 2463',date:'2026-11-01'}),opened.settings);
  const again=inv.issue(second,opened.settings,[opened.invoice],'2026-11-13');
  assert.equal(again.invoice.number,'INV-0002');
  const kept=inv.issue(again.invoice,again.settings,[opened.invoice,again.invoice],'2026-11-13');
  assert.equal(kept.invoice.number,'INV-0002');
  assert.equal(inv.nextFree({nextNumber:1},[{number:'INV-0001'},{number:'INV-0002'}]),3);
  assert.equal(inv.formatNumber(7),'INV-0007');
});

test('a worksheet suggests the service, replacements and batteries, and drops tenant details',function(){
  const settings=inv.normaliseSettings({prices:{service:15000,replace:4500,battery:500},gstRegistered:true});
  const lines=inv.suggestLines(form(),settings.prices);
  assert.deepEqual(lines.map(function(line){return line.description+' x'+line.qty}),[
    inv.SERVICE+' x1',
    inv.REPLACE+' x1',
    inv.BATTERY+' x1'
  ]);
  const draft=inv.draftFromJob(job(),form(),settings);
  const issued=inv.issue(draft,settings,[],'2026-08-12').invoice;
  const doc=inv.toPortal(issued,settings,'2026-11-13','2026-11-13T00:00:00.000Z');
  const raw=JSON.stringify(doc);
  assert.equal(inv.tenantHits(doc).length,0);
  assert.equal(raw.includes('Jane Tenant'),false);
  assert.equal(raw.includes('0400 111 222'),false);
  assert.equal(raw.includes('jane.tenant@example.com'),false);
  assert.equal(raw.includes('6645'),false);
  assert.equal(doc.gstRegistered,true);
  assert.equal(doc.exCents,20000);
  assert.equal(doc.gstCents,2000);
  assert.equal(doc.totalCents,22000);
  assert.equal(inv.sameKeys(doc,inv.KEYS),true);
  doc.lines.forEach(function(line){assert.equal(inv.sameKeys(line,inv.LINE_KEYS),true)});
});

test('paid, unpaid and overdue stay inside one agency',function(){
  const built=portal.demoPortal();
  const today=built.today;
  const rwm=inv.demoInvoices(built.agencies.rwm,today);
  const life=inv.demoInvoices(built.agencies.lifestyle,today);
  assert.equal(inv.tenantHits(rwm.concat(life)).length,0);
  assert.ok(rwm.every(function(row){return row.agencyId==='rwm'}));
  assert.ok(life.every(function(row){return row.agencyId==='lifestyle'}));
  assert.equal(JSON.stringify(rwm).includes('21 Yamba Street'),false);
  assert.equal(JSON.stringify(life).includes('18 River Street'),false);
  assert.equal(JSON.stringify(life).includes('Jane Tenant'),false);
  const paid=inv.filterInvoices(rwm,{status:'paid',today:today,agencyId:'rwm'});
  const unpaid=inv.filterInvoices(rwm,{status:'unpaid',today:today});
  const overdue=inv.filterInvoices(rwm,{status:'overdue',today:today});
  assert.equal(paid.length,1);
  assert.match(paid[0].address,/18 River Street/);
  assert.equal(unpaid.length,1);
  assert.match(unpaid[0].address,/15 Short Street/);
  assert.equal(overdue.length,1);
  assert.match(overdue[0].address,/9 Church Street/);
  const later=inv.filterInvoices(rwm,{from:'2026-08-01',to:'2026-08-31',today:today});
  assert.equal(later.length,1);
  assert.equal(later[0].number,'INV-0002');
  const marked=inv.markPaid(unpaid[0],today,true);
  assert.equal(inv.displayStatus(marked,today),'paid');
  assert.equal(inv.displayStatus(inv.markPaid(marked,today,false),today),'unpaid');
});

test('the sample invoice PDF is a tax invoice without a tenant or a hard-coded ABN',function(){
  const defaults=inv.defaultSettings();
  assert.equal(defaults.businessName,'Clarence Coast Smoke Alarms');
  assert.equal(defaults.phone,'0412 092 233');
  assert.equal(defaults.abn,'');
  assert.equal(defaults.bsb,'');
  assert.equal(defaults.accountNumber,'');
  assert.equal(defaults.prices.service,0);
  assert.equal(defaults.prices.replace,0);
  assert.equal(defaults.prices.battery,0);
  assert.equal(defaults.gstRegistered,false);
  const built=portal.demoPortal();
  const river=inv.demoInvoices(built.agencies.rwm,built.today).filter(function(row){return row.address.indexOf('18 River')===0})[0];
  const text=certs.pdfText(inv.buildInvoicePdf(Object.assign({today:built.today},river)));
  assert.match(text,/^%PDF-1\.4/);
  assert.match(text,/TAX INVOICE|Tax Invoice/);
  assert.match(text,/INV-0002/);
  assert.match(text,/18 River Street, Maclean NSW 2463/);
  assert.match(text,/Annual smoke alarm and compliance service/);
  assert.match(text,/\$150\.00/);
  assert.match(text,/GST 10%/);
  assert.match(text,/\$15\.00/);
  assert.match(text,/\$165\.00/);
  assert.match(text,/0412 092 233/);
  assert.match(text,/Bank details have not been added/);
  assert.equal(text.includes('ABN'),false);
  assert.equal(text.includes('Jane Tenant'),false);
  assert.equal(text.includes('0400 111 222'),false);
  assert.equal(text.includes('jane.tenant@example.com'),false);
  const rules=fs.readFileSync('firestore.rules','utf8');
  const line=rules.split('\n').filter(function(row){return row.indexOf('portal-invoice-keys: ')>=0})[0];
  assert.deepEqual(line.split(': ')[1].trim().split(','),inv.KEYS);
});
