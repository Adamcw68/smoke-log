const test=require('node:test');
const assert=require('node:assert/strict');
const portal=require('./portaldata.js');
const certs=require('./certificate.js');

function find(address){
  const view=portal.demoView('rwm');
  return view.certificates.filter(function(c){return c.address.indexOf(address)===0})[0];
}

test('a service report matches the agency layout and leaves the tenant off',function(){
  const cert=find('18 River');
  const view=certs.viewModel(Object.assign({},cert,{contact:'Jane Tenant',p1:'0400 111 222',postal:'0400 111 222\njane.tenant@example.com\nPO Box 1'}));
  assert.equal(view.title,'SERVICE REPORT');
  assert.equal(view.brand,'Clarence Coast Smoke Alarms');
  assert.equal(view.phone,'0412 092 233');
  assert.equal(view.attention,'c/- Ray White Maclean/Yamba');
  assert.doesNotMatch(view.complianceLead,/All alarms installed or serviced/);
  assert.doesNotMatch(view.legend,/Hardwired Alarm, Replaceable Battery/);
  assert.doesNotMatch(view.batteryNote,/New batteries have been installed in all alarms/);
  assert.deepEqual(view.postal,['PO Box 1']);
  assert.equal(view.reportDate,'12/08/2026');
  assert.equal(view.serviceAddress,'18 River Street, Maclean NSW 2463');
  assert.equal(view.serviceReason,'Subscription Service');
  assert.equal(view.inspector,'Adam Westerman');
  assert.equal(view.lastInspection,'12/08/2025');
  assert.equal(view.compliant,true);
  assert.equal(view.alarms[0].product,'240V Photoelectric Alarm');
  assert.equal(view.alarms[0].location,'Hallway');
  assert.equal(view.alarms[0].expiry,'08/2031');
  assert.equal(view.alarms[0].action,'Serviced');
  assert.equal(view.alarms[0].reason,'Annual Maintenance');
  assert.equal(view.alarms[1].product,'Lithium Battery Photoelectric Alarm');
  assert.equal(view.alarms[1].location,'Bedroom 1');
  assert.equal(view.alarms[1].action,'Serviced');
  assert.match(view.complianceLead,/Clarence Coast Smoke Alarms/);
  assert.ok(view.laws.some(function(law){return law.indexOf('Australian Standard 3786')>=0}));
  const bytes=certs.buildCertificatePdf(cert);
  const text=certs.pdfText(bytes);
  assert.match(text,/^%PDF-1\.4/);
  assert.match(text,/SERVICE REPORT/);
  assert.match(text,/Clarence Coast Smoke Alarms/);
  assert.match(text,/0412 092 233/);
  assert.match(text,/c\/- Ray White Maclean\/Yamba/);
  assert.match(text,/0\.94 0\.18 0\.20/);
  assert.match(text,/\/Subtype \/Image/);
  assert.equal(text.includes('(CC) Tj'),false);
  assert.equal(text.includes('(v) Tj'),false);
  assert.match(text,/ c\n/);
  assert.equal(text.includes(' arc\n'),false);
  assert.match(text,/Report Date: 12\/08\/2026/);
  assert.match(text,/Valid until: 12\/08\/2027/);
  assert.match(text,/SERVICE DETAILS/);
  assert.match(text,/18 River Street, Maclean NSW 2463/);
  assert.match(text,/Subscription Service/);
  assert.match(text,/Adam Westerman/);
  assert.match(text,/12\/08\/2025/);
  assert.match(text,/240V Photoelectric Alarm/);
  assert.match(text,/Hallway/);
  assert.match(text,/08\/2031/);
  assert.match(text,/Serviced/);
  assert.match(text,/Annual Maintenance/);
  assert.match(text,/Building Legislation Amendment/);
  assert.match(text,/Australian Standard 3786/);
  assert.match(text,/a new battery was fitted on this visit/);
  assert.match(text,/240V: mains-powered \\\(hard-wired\\\), battery can be changed/);
  assert.match(text,/240V lithium: mains-powered \\\(hard-wired\\\)/);
  assert.equal(/\bHW\b/.test(text),false);
  assert.equal(text.includes('All alarms installed or serviced'),false);
  assert.match(text,/0\.94 0\.18 0\.20/);
  assert.equal(text.includes('Smoke Alarms Australia'),false);
  assert.equal(text.includes('SMOKE ALARMS AUSTRALIA'),false);
  assert.equal(text.includes('Jane Tenant'),false);
  assert.equal(text.includes('0400 111 222'),false);
  assert.equal(text.includes('jane.tenant@example.com'),false);
  const owned=certs.viewModel({agencyCode:'Private Owner',address:'7 Owner Street, Yamba NSW 2464',date:'2026-08-12',owner:'Pat Owner',contact:'Jane Tenant',alarms:[]});
  assert.equal(owned.attention,'Attention: Pat Owner');
  assert.equal(owned.attention.includes('c/-'),false);
  const unnamed=certs.viewModel({agencyCode:'Private',address:'7 Owner Street, Yamba NSW 2464',date:'2026-08-12',contact:'Jane Tenant',alarms:[]});
  assert.equal(unnamed.attention,'Attention: The owner');
  const mains=certs.viewModel({agencyCode:'RWM',address:'1 Sample Street, Yamba NSW 2464',date:'2026-08-12',tech:'Craig Robinson',alarms:[{n:1,location:'Hallway',type:'Photo-Electric',power:'240v, Lithium',expiry:'08/2036',result:'pass'}]});
  assert.equal(mains.alarms[0].product,'240V Lithium Photoelectric Alarm');
  assert.equal(mains.inspector,'Craig Robinson');
  assert.match(mains.legend,/240V lithium: mains-powered \(hard-wired\), sealed battery/);
  assert.equal(/\bHW\b/.test(mains.legend+mains.alarms[0].product),false);
  const blank=certs.viewModel({agencyCode:'RWM',address:'1 Sample Street, Yamba NSW 2464',tech:'',ident:'',date:'',lastInspection:'',alarms:[]});
  assert.equal(blank.inspector,'');
  assert.equal(blank.jobNumber,'');
  assert.equal(blank.reportDate,'');
  assert.equal(blank.lastInspection,'');
  assert.equal(JSON.stringify(unnamed).includes('Jane Tenant'),false);
  const ownedPdf=certs.pdfText(certs.buildCertificatePdf({agencyCode:'Private Owner',address:'7 Owner Street, Yamba NSW 2464',date:'2026-08-12',owner:'0400 111 222',tech:'Adam Westerman',alarms:[{n:1,location:'Hallway',type:'Photo-Electric',power:'240v',expiry:'08/2031',result:'pass'}]}));
  assert.match(ownedPdf,/Attention: The owner/);
  assert.equal(ownedPdf.includes('c/-'),false);
  assert.equal(ownedPdf.includes('Private Owner'),false);
  const dueCert=certs.complianceModel(cert,{due:'2028-01-01'});
  assert.equal(dueCert.title,'COMPLIANCE CERTIFICATE');
  assert.equal(dueCert.validUntil,'12/08/2027');
  assert.equal(view.validUntil,'12/08/2027');
  assert.equal(certs.complianceModel({date:'2024-02-29',alarms:[{result:'pass'}]}).validUntil,'28/02/2025');
  assert.equal(certs.complianceModel({date:'2026-01-31',alarms:[{result:'pass'}]}).validUntil,'31/01/2027');
  const dueText=certs.pdfText(certs.buildCompliancePdf(cert,{due:'2027-08-12'}));
  assert.match(dueText,/COMPLIANCE CERTIFICATE/);
  assert.match(dueText,/SERVICE DETAILS/);
  assert.match(dueText,/Valid until/);
  assert.match(dueText,/12\/08\/2027/);
  assert.match(dueText,/240V Photoelectric Alarm/);
  assert.match(dueText,/240V: mains-powered \\\(hard-wired\\\), battery can be changed/);
  assert.match(dueText,/Clarence Coast Smoke Alarms/);
  assert.match(dueText,/0412 092 233/);
  assert.equal(dueText.includes('01/01/2028'),false);
  assert.equal(dueText.includes('Adam Westerman'),false);
  assert.equal(dueText.includes('Inspected by'),false);
  const ownedCompliance=certs.pdfText(certs.buildCompliancePdf({agencyCode:'Private Owner',address:'7 Owner Street, Yamba NSW 2464',date:'2026-08-12',owner:'Pat Owner',tech:'Adam Westerman',contact:'Jane Tenant',p1:'0400 111 222',alarms:[{n:1,location:'Hallway',type:'Photo-Electric',power:'240v',expiry:'08/2031',result:'pass'}]}));
  assert.match(ownedCompliance,/Attention: Pat Owner/);
  assert.match(ownedCompliance,/Valid until: 12\/08\/2027/);
  assert.match(ownedCompliance,/240V Photoelectric Alarm/);
  assert.equal(ownedCompliance.includes('c/-'),false);
  assert.equal(ownedCompliance.includes('Adam Westerman'),false);
  assert.equal(ownedCompliance.includes('Jane Tenant'),false);
  assert.equal(ownedCompliance.includes('0400 111 222'),false);
  const html=require('fs').readFileSync('index.html','utf8');
  assert.match(html,/id="ccopen">Compliance certificate/);
  assert.match(html,/h\.startsWith\('compliance\/'\)/);
  assert.match(dueText,/fitted or checked every alarm/);
  assert.equal(dueText.includes('Jane Tenant'),false);
  assert.equal(dueText.includes('Smoke Alarms Australia'),false);
  const failed=certs.complianceModel(find('9 Church'),{due:'2027-10-02'});
  assert.equal(failed.validUntil,'');
  assert.match(failed.statement,/did not pass the checks/);
  assert.equal(certs.fileName(cert),'CCSA-2026-08-12-18-River-Street.pdf');
  const start=text.match(/startxref\n(\d+)/);
  assert.equal(text.slice(+start[1],+start[1]+4),'xref');
});

test('replace and fail are printed and a long visit stays a valid PDF',function(){
  const replaced=find('15 Short');
  const failed=find('9 Church');
  const replaceText=certs.pdfText(certs.buildCertificatePdf(replaced));
  const failText=certs.pdfText(certs.buildCertificatePdf(failed));
  assert.match(replaceText,/Replaced/);
  assert.match(replaceText,/07\/2036/);
  assert.match(failText,/Failed/);
  assert.equal(failText.includes('fitted or checked every alarm'),false);
  assert.equal(failText.includes('All alarms installed or serviced'),false);
  assert.match(failText,/Lounge/);
  assert.match(failText,/9V Photoelectric Alarm/);
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

test('a day export is a worksheets PDF and a separate certificates PDF',function(){
  const passYn={comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes'};
  const alarm=function(extra){return Object.assign({room:'Hallway',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'PE123',expiry:'8/2031',yn:passYn},extra||{})};
  const jobs=[
    {id:'late',agent:'Ray White Maclean/Yamba',addr:'4 Afternoon Street, Yamba NSW 2464',section:'Permanent',svc:'2026-08-12T14:00:00',order:2,row:2,contact:'Jane Tenant',p1:'0400 111 222'},
    {id:'early',agent:'Lifestyle Maclean/Yamba',addr:'1 Morning Street, Maclean NSW 2463',section:'Holiday',svc:'2026-08-12T09:00:00',order:1,row:1,contact:'Jane Tenant',p1:'0400 111 222',tech:'Adam Westerman'},
    {id:'own',agent:'Private Owner',addr:'7 Owner Street, Yamba NSW 2464',section:'Permanent',svc:'2026-08-12T11:00:00',order:3,row:3,contact:'Jane Tenant',p1:'0400 111 222'},
    {id:'open',agent:'Ray White Maclean/Yamba',addr:'8 Unfinished Street, Yamba NSW 2464',svc:'2026-08-12T10:00:00',order:4,row:4},
    {id:'other',agent:'Ray White Maclean/Yamba',addr:'2 Other Day Street, Yamba NSW 2464',svc:'2026-08-13T09:00:00',order:1,row:1},
    {id:'fail',agent:'Ray White Maclean/Yamba',addr:'9 Church Street, Maclean NSW 2463',section:'Permanent',svc:'2026-08-12T15:30:00',order:5,row:5,tech:'Adam Westerman'}
  ];
  const forms={
    late:{done:true,agent:'Ray White Maclean/Yamba',agentSet:true,tenancy:'Permanent',addr:jobs[0].addr,date:'2026-08-12',tech:'Adam Westerman',alarms:1,comments:'0400 111 222\nBattery changed',al:[alarm()]},
    early:{done:true,agent:'Lifestyle Maclean/Yamba',agentSet:true,tenancy:'Holiday',addr:jobs[1].addr,date:'2026-08-12',tech:'Adam Westerman',alarms:1,al:[alarm({power:['HW']})]},
    own:{done:true,agent:'Private Owner',agentSet:true,tenancy:'Permanent',addr:jobs[2].addr,date:'2026-08-12',tech:'Adam Westerman',alarms:1,al:[alarm()]},
    open:{done:false,agent:'Ray White Maclean/Yamba',addr:jobs[3].addr,date:'2026-08-12',tech:'Adam Westerman',alarms:1,al:[alarm()]},
    other:{done:true,agent:'Ray White Maclean/Yamba',addr:jobs[4].addr,date:'2026-08-13',tech:'Adam Westerman',alarms:1,al:[alarm()]},
    fail:{done:true,agent:'Ray White Maclean/Yamba',addr:jobs[5].addr,date:'2026-08-12',tech:'Adam Westerman',alarms:1,al:[alarm({yn:{comply:'No',located:'Yes',button:'Yes',affixed:'Yes'}})]}
  };
  const plan=certs.dayPlan(jobs,forms,{date:'2026-08-12',agency:''});
  assert.equal(plan.worksheetFile,'CCSA-worksheets-2026-08-12.pdf');
  assert.equal(plan.certificateFile,'CCSA-certificates-2026-08-12.pdf');
  assert.deepEqual(plan.worksheets.map(function(item){return item.id}),['early','own','late','fail']);
  assert.deepEqual(plan.certificates.map(function(item){return item.id}),['early','own','late']);
  assert.deepEqual(plan.notes.map(function(item){return item.id+':'+item.reason}),['fail:No compliance certificate']);
  assert.deepEqual(plan.skipped.map(function(item){return item.id+':'+item.reason}),['open:Not finished']);
  const files=certs.buildDayFiles(jobs,forms,{date:'2026-08-12',photos:{early:[{caption:'Hallway photo',bytes:Buffer.from([0xff,0xd8])}]}});
  const sheets=certs.pdfText(files.worksheetBytes);
  const certText=certs.pdfText(files.certificateBytes);
  assert.match(sheets,/\/Count 4/);
  assert.match(sheets,/WORKSHEET/);
  assert.equal(sheets.includes('SERVICE REPORT'),false);
  assert.equal(sheets.includes('COMPLIANCE CERTIFICATE'),false);
  assert.ok(sheets.indexOf('1 Morning Street')<sheets.indexOf('7 Owner Street'));
  assert.ok(sheets.indexOf('7 Owner Street')<sheets.indexOf('4 Afternoon Street'));
  assert.ok(sheets.indexOf('4 Afternoon Street')<sheets.indexOf('9 Church Street'));
  assert.match(sheets,/Holiday/);
  assert.match(sheets,/Permanent/);
  assert.match(sheets,/Brooks PE123/);
  assert.match(sheets,/240V/);
  assert.match(sheets,/08\/2031/);
  assert.match(sheets,/Serviced/);
  assert.match(sheets,/Failed/);
  assert.equal(sheets.includes('Hallway photo'),false);
  assert.equal(sheets.includes('DCTDecode'),false);
  assert.equal(/\bHW\b/.test(sheets),false);
  assert.equal(sheets.includes('Jane Tenant'),false);
  assert.equal(sheets.includes('0400 111 222'),false);
  assert.equal(sheets.includes('2 Other Day Street'),false);
  assert.equal(sheets.includes('8 Unfinished Street'),false);
  assert.match(certText,/\/Count 3/);
  assert.match(certText,/COMPLIANCE CERTIFICATE/);
  assert.equal(certText.includes('SERVICE REPORT'),false);
  assert.equal(certText.includes('WORKSHEET'),false);
  assert.equal(certText.includes('Inspected by'),false);
  assert.equal(certText.includes('Adam Westerman'),false);
  assert.equal(certText.includes('9 Church Street'),false);
  assert.match(certText,/Valid until: 12\/08\/2027/);
  assert.match(certText,/Attention: The owner/);
  assert.match(certText,/240V Photoelectric Alarm/);
  assert.equal(certText.includes('Jane Tenant'),false);
  assert.equal(certText.includes('0400 111 222'),false);
  const html=require('fs').readFileSync('index.html','utf8');
  assert.match(html,/id="dayopen">Day PDF/);
  assert.match(html,/id="dayws">Download worksheets PDF/);
  assert.match(html,/id="daycc">Download certificates PDF/);
  assert.match(html,/CCSACertificate\.buildDayFiles/);
  assert.equal(html.includes('dayWorksheetPhotos'),false);
  assert.equal(html.includes('Service reports only'),false);
});
