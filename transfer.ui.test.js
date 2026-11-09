/* Phone export of synthetic worksheets, then a desktop import into a different profile. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8767;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
let browser,server;

function alarm(db){
  return {isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:db,expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:db==='99.5'?['shot']:[]};
}
function form(updated,db,agent){
  return {techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-09',time:'',ident:'',agent:agent,tenancy:'Holiday',addr:'',ptype:'House',ptypeOther:'',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:updated,al:[alarm(db)]};
}

test.before(async()=>{
  if(!puppeteer)return;
  fs.mkdirSync(ART,{recursive:true});
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch(e){}await new Promise(res=>setTimeout(res,150))}
  throw new Error('server did not start');
});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});

test('a phone share exports the worksheets and a desktop import keeps the newer copy',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const phone=await browser.createBrowserContext();
  const mobile=await phone.newPage();
  await mobile.setViewport({width:390,height:844,deviceScaleFactor:1});
  await mobile.evaluateOnNewDocument(()=>{
    const job={id:'circle',row:1,section:'Holiday',agent:'RWY',tech:'',last:'',due:'2026-11-09',ident:'',street:'1 Circle St',town:'Yamba',addr:'1 Circle St, Yamba NSW 2464',directions:'',contact:'Pat Sample',p1:'0400 111 222',p2:'',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-09T09:00:00+11:00',order:1,arch:null,src:'Synthetic'};
    const f={techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-09',time:'',ident:'',agent:'RWY',tenancy:'Holiday',addr:job.addr,ptype:'House',ptypeOther:'',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:'2026-11-09T01:00:00.000Z',al:[{isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'99.5',expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:['shot']}]};
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify([job]));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify({circle:f}));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify({tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}));
  });
  await mobile.goto(BASE,{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.pdfPut&&window.CCSAPdf);
  await mobile.evaluate(async()=>{
    const db=await new Promise((res,rej)=>{const r=indexedDB.open('ccsa-photos',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos',{keyPath:'id'}).createIndex('job','job')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    await new Promise((res,rej)=>{const t=db.transaction('photos','readwrite');t.objectStore('photos').put({id:'shot',job:'circle',slot:'al0',type:'image/jpeg',data:new Uint8Array([1,2,3,4,5]).buffer,w:2,h:2,ts:'2026-11-09T01:00:00.000Z'});t.oncomplete=()=>res();t.onerror=()=>rej(t.error)});
    const bytes=new TextEncoder().encode('%PDF-1.4\n% synthetic\n');
    const kept=CCSAPdf.retainRecord({id:'circle',name:'2026-11-09_1-Circle-St.pdf',day:'2026-11-09',addr:'1 Circle St, Yamba NSW 2464',street:'1 Circle St',stamp:'phone',made:'2026-11-09T02:00:00.000Z',incomplete:false,bytes:bytes});
    await pdfPut(kept.record);
  });
  await mobile.waitForSelector('#exp');
  await mobile.evaluate(()=>document.getElementById('exp').scrollIntoView({block:'center'}));
  await mobile.screenshot({path:path.join(ART,'worksheet_export_mobile.png')});
  await mobile.evaluate(()=>{
    window.__shared=null;
    window.__download=null;
    navigator.canShare=()=>true;
    navigator.share=async(data)=>{window.__shared={name:data.files[0].name,text:null,file:data.files[0]};};
  });
  await mobile.click('#exp');
  await mobile.waitForFunction(()=>window.__shared&&window.__shared.file);
  const packText=await mobile.evaluate(async()=>window.__shared.file.text());
  const pack=JSON.parse(packText);
  assert.equal(pack.version,4);
  assert.equal(pack.forms.circle.al[0].db,'99.5');
  assert.equal(pack.forms.circle.agent,'RWY');
  assert.equal(pack.photos.length,1);
  assert.equal(pack.pdfs.length,1);
  assert.match(await mobile.evaluate(()=>document.body.innerText),/does not send it/);
  await mobile.evaluate(()=>{
    navigator.canShare=()=>false;
    downloadBytes=function(data,name){window.__download={name:name,text:String(data)};};
  });
  await mobile.click('#expxls');
  await mobile.waitForFunction(()=>window.__download&&/\.xlsx$/.test(window.__download.name));
  const xlsxName=await mobile.evaluate(()=>window.__download.name);
  assert.match(xlsxName,/\.xlsx$/);

  const desk=await browser.createBrowserContext();
  const desktop=await desk.newPage();
  await desktop.setViewport({width:1280,height:800,deviceScaleFactor:1});
  await desktop.evaluateOnNewDocument(()=>{
    const older={id:'circle',row:1,section:'',agent:'Old',tech:'',last:'',due:'2026-11-09',ident:'',street:'1 Circle St',town:'Yamba',addr:'1 Circle St, Yamba NSW 2464',directions:'',contact:'',p1:'',p2:'',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-09T09:00:00+11:00',order:1,arch:null,src:'Desktop'};
    const other={id:'desk',row:2,section:'',agent:'Desk',tech:'',last:'',due:'2026-11-09',ident:'',street:'9 Desk St',town:'Yamba',addr:'9 Desk St, Yamba NSW 2464',directions:'',contact:'',p1:'',p2:'',ptype:'Unit',beds:1,alarms:1,ladder:'Sm',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-09T10:00:00+11:00',order:2,arch:null,src:'Desktop'};
    const fa={techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-09',time:'',ident:'',agent:'Old',tenancy:'',addr:older.addr,ptype:'House',ptypeOther:'',levels:1,beds:1,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:'2026-11-01T00:00:00.000Z',al:[{isNew:false,newAns:'No',mount:'',room:'',bedno:'',other:'',adjacent:'',power:['240v'],sensor:[],manufacturer:'',model:'',db:'80',expiry:'',yn:{cleaned:'Yes'},photos:[]}]};
    const fd=Object.assign({},fa,{agent:'Desk',addr:other.addr,ptype:'Unit',updated:'2026-11-08T00:00:00.000Z',al:[Object.assign({},fa.al[0],{db:'70'})]});
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify([older,other]));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify({circle:fa,desk:fd}));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify({tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}));
  });
  await desktop.goto(BASE,{waitUntil:'domcontentloaded'});
  await desktop.waitForSelector('#impws');
  await desktop.evaluate(text=>{
    const file=new File([text],'ccsa-worksheets-2026-11-09.json',{type:'application/json'});
    const dt=new DataTransfer();dt.items.add(file);
    const input=document.getElementById('xfer');
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  },packText);
  await desktop.waitForFunction(()=>/Nothing already on this device was deleted/.test(document.body.innerText));
  const after=await desktop.evaluate(async()=>{
    const jobs=JSON.parse(localStorage.getItem('ccsa.jobs.v1'));
    const forms=JSON.parse(localStorage.getItem('ccsa.forms.v1'));
    const photo=await new Promise((res,rej)=>{const r=indexedDB.open('ccsa-photos',1);r.onsuccess=()=>{const t=r.result.transaction('photos','readonly');const g=t.objectStore('photos').get('shot');g.onsuccess=()=>res(g.result||null);g.onerror=()=>rej(g.error)};r.onerror=()=>rej(r.error)});
    const pdf=await pdfGet('circle');
    return {
      addrs:jobs.map(j=>j.addr),
      agent:forms.circle.agent,
      db:forms.circle.al[0].db,
      desk:forms.desk.al[0].db,
      photo:photo&&photo.data?photo.data.byteLength:0,
      pdf:pdf&&pdf.bytes?pdf.bytes.byteLength:0,
      magic:pdf&&pdf.bytes?pdf.bytes[0]:0
    };
  });
  assert.ok(after.addrs.some(a=>a.indexOf('1 Circle')===0));
  assert.ok(after.addrs.some(a=>a.indexOf('9 Desk')===0));
  assert.equal(after.agent,'RWY');
  assert.equal(after.db,'99.5');
  assert.equal(after.desk,'70');
  assert.equal(after.photo,5);
  assert.ok(after.pdf>5);
  assert.equal(after.magic,0x25);
  const older=JSON.parse(packText);
  older.forms.circle.updated='2026-11-08T00:00:00.000Z';
  older.forms.circle.al[0].db='1';
  older.forms.circle.agent='Old';
  await desktop.evaluate(text=>{
    const file=new File([text],'ccsa-worksheets-older.json',{type:'application/json'});
    const dt=new DataTransfer();dt.items.add(file);
    const input=document.getElementById('xfer');
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  },JSON.stringify(older));
  await desktop.waitForFunction(()=>/kept its worksheet/.test(document.body.innerText));
  assert.equal(await desktop.evaluate(()=>JSON.parse(localStorage.getItem('ccsa.forms.v1')).circle.al[0].db),'99.5');
  await desktop.evaluate(()=>document.getElementById('impws').scrollIntoView({block:'center'}));
  await desktop.screenshot({path:path.join(ART,'worksheet_import_desktop.png')});
  await phone.close();
  await desk.close();
});
