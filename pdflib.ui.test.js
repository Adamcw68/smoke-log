/* Browser checks for the PDF library. Addresses and photos are synthetic. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8765;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
const DAY='2026-11-08';

function alarm(over){
  return Object.assign({
    isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',
    power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'85',
    expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]
  },over||{});
}
function form(over){
  return Object.assign({
    techMode:'def',techOther:'',tech:'Adam Westerman',date:DAY,time:'',
    ident:'Sample',agent:'Sample Agency',addr:'1 Sample St, Yamba NSW 2464',
    ptype:'House',ptypeOther:'',levels:1,beds:3,alarms:1,ladder:'Sm',
    asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:'2026-11-08T01:00:00.000Z',
    al:[alarm()]
  },over||{});
}
function job(id,street,svc,order){
  return {
    id:id,row:order,section:'',agent:'Sample Agency',tech:'',last:'',due:DAY,ident:'',
    street:street,town:'Yamba',addr:street+', Yamba NSW 2464',directions:'',contact:'Sample Contact',
    p1:'0400000000',p2:'',ptype:'House',beds:3,alarms:1,ladder:'Sm',exp:['11/2036'],ic:'',notes:'',
    extra:[],svc:svc,order:order,arch:null,src:'Synthetic'
  };
}
function libraryData(){
  const ready=job('ready','1 Sample St','2026-11-08T09:00:00+11:00',1);
  const ready2=job('ready2','8 Second St','2026-11-08T16:00:00+11:00',6);
  const dirty=job('dirty','3 Dirty St','2026-11-08T11:00:00+11:00',3);
  const stale=job('stale','4 Stale St','2026-11-08T12:00:00+11:00',4);
  const late=job('late','2 Late St','2026-11-08T15:00:00+11:00',5);
  const night=job('night','6 Night St','2026-11-07T13:30:00Z',7);
  const before=job('before','7 Before St','2026-11-07T12:30:00Z',8);
  const moved=job('moved','5 Moved St','2026-11-01T09:00:00+11:00',2);
  const jobs=[ready,ready2,dirty,stale,late,night,before,moved];
  const forms={
    ready:form({addr:ready.addr}),
    ready2:form({addr:ready2.addr}),
    dirty:form({addr:dirty.addr,al:[alarm({yn:{cleaned:'',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'}})]}),
    stale:form({addr:stale.addr,comments:'Original note'}),
    late:form({addr:late.addr}),
    moved:form({addr:moved.addr,date:DAY})
  };
  return {jobs:jobs,forms:forms,settings:{tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}};
}
function photoData(){
  const j=job('photo','4 Photo St','2026-11-08T10:00:00+11:00',1);
  j.alarms=2;
  const f=form({
    addr:j.addr,alarms:2,comments:'Synthetic photo check',
    al:[
      alarm({power:['Lithium'],yn:{cleaned:'Yes',comply:'Yes',battery:'',located:'Yes',button:'Yes',affixed:'Yes'}}),
      alarm({isNew:true,newAns:'Yes',power:['240v'],yn:{cleaned:'',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'}})
    ]
  });
  return {jobs:[j],forms:{photo:f},settings:{tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}};
}

let browser, server;
async function startServer(){
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){
    try{const r=await fetch(BASE);if(r.ok)return}catch(e){}
    await new Promise(res=>setTimeout(res,150));
  }
  throw new Error('Test server did not start');
}
test.before(async()=>{
  if(!puppeteer)return;
  fs.mkdirSync(ART,{recursive:true});
  await startServer();
  browser=await puppeteer.launch({
    executablePath:'/usr/bin/google-chrome',
    headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
});
test.after(async()=>{
  if(browser)await browser.close();
  if(server)server.kill();
});

async function newPage(data,mode){
  const context=await browser.createBrowserContext();
  const page=await context.newPage();
  page.__context=context;
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument((payload,shareMode)=>{
    if(!localStorage.getItem('ccsa.jobs.v1')){
      localStorage.setItem('ccsa.jobs.v1',JSON.stringify(payload.jobs));
      localStorage.setItem('ccsa.forms.v1',JSON.stringify(payload.forms));
      localStorage.setItem('ccsa.settings.v1',JSON.stringify(payload.settings));
    }
    window.__shareMode=shareMode;
    window.__shares=[];
    window.__blobs=[];
    const share=async function(data){
      const files=[];
      for(const f of data.files||[]){
        const buf=new Uint8Array(await f.arrayBuffer());
        files.push({name:f.name,type:f.type,size:buf.length,head:Array.from(buf.slice(0,4))});
      }
      const rec={title:data.title||'',keys:Object.keys(data),url:data.url==null?null:String(data.url),text:data.text==null?null:String(data.text),files:files};
      window.__shares.push(rec);
      if(window.__shareMode==='abort'){const e=new Error('cancelled');e.name='AbortError';throw e}
      if(window.__shareMode==='fail'){const e=new Error('blocked');e.name='NotAllowedError';throw e}
    };
    const canShare=function(data){
      if(window.__shareMode==='unsupported')return false;
      if(!data||!data.files||!data.files.length)return false;
      if(window.__shareMode==='single'&&data.files.length>1)return false;
      return true;
    };
    Object.defineProperty(navigator,'share',{configurable:true,value:share});
    Object.defineProperty(navigator,'canShare',{configurable:true,value:canShare});
    const orig=URL.createObjectURL;
    URL.createObjectURL=function(obj){
      const url=orig.call(URL,obj);
      if(obj instanceof Blob){
        obj.arrayBuffer().then(buf=>{window.__blobs.push({type:obj.type||'',bytes:new Uint8Array(buf)})});
      }
      return url;
    };
  },data,mode);
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  page.__errors=errors;
  return page;
}
async function storeReady(page,ids,staleIds){
  await page.evaluate(async(ids,staleIds)=>{
    const jobs=JSON.parse(localStorage.getItem('ccsa.jobs.v1'));
    const forms=JSON.parse(localStorage.getItem('ccsa.forms.v1'));
    const dateOf=x=>{const f=forms[x.id];if(f&&f.date)return f.date;return ''};
    for(const id of ids){
      const j=jobs.find(x=>x.id===id);
      const f=forms[id];
      const doc=await PDFLib.PDFDocument.create();
      doc.addPage([595.28,841.89]);
      const bytes=await doc.save();
      const name=CCSAPdf.pdfFileName(jobs,j,f.date,dateOf);
      const stamp=staleIds.indexOf(id)>=0?'old-stamp':CCSAPdf.worksheetStamp(f);
      const kept=CCSAPdf.retainRecord({id:id,name:name,day:CCSAPdf.serviceDay(j,f),addr:f.addr,street:j.street,stamp:stamp,made:'2026-11-08T03:00:00.000Z',incomplete:false,bytes:bytes});
      if(!kept.ok)throw new Error(kept.reason);
      await pdfPut(kept.record);
    }
  },ids,staleIds||[]);
}
async function snap(page){
  return page.evaluate(()=>({jobs:localStorage.getItem('ccsa.jobs.v1'),forms:localStorage.getItem('ccsa.forms.v1')}));
}
async function checksum(page,id){
  return page.evaluate(async(id)=>{
    const rec=await pdfGet(id);
    if(!rec||!rec.bytes)return null;
    let s=0;const b=rec.bytes instanceof Uint8Array?rec.bytes:new Uint8Array(rec.bytes);
    for(let i=0;i<b.length;i++)s=(s+b[i])>>>0;
    return {len:b.length,sum:s,name:rec.name};
  },id);
}
function assertNoAppError(page){
  const bad=(page.__errors||[]).filter(e=>!/Google|gsi|accounts\.google/i.test(e));
  assert.deepEqual(bad,[]);
}

test('library groups a Sydney day and shares only saved current PDFs',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  const data=libraryData();
  const page=await newPage(data,'files');
  await page.goto(BASE+'#library/'+DAY,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#libroot');
  await storeReady(page,['ready','ready2','stale'],['stale']);
  const before=await snap(page);
  const sumReady=await checksum(page,'ready');
  const sumStale=await checksum(page,'stale');
  await page.evaluate(()=>{location.hash='#library/2026-11-07'});
  await page.waitForFunction(()=>document.querySelector('#libroot')&&document.querySelector('#libroot').dataset.day==='2026-11-07');
  assert.equal(await page.$eval('[data-id="before"]',el=>el.dataset.status),'noworksheet');
  assert.equal(await page.$('[data-id="night"]'),null);
  await page.click('#libnext');
  await page.waitForSelector('[data-id="ready"]');
  const ids=await page.$$eval('article.libcard',els=>els.map(el=>el.dataset.id));
  assert.deepEqual(ids,['moved','night','ready','dirty','stale','late','ready2']);
  assert.equal(await page.$eval('[data-id="night"]',el=>el.textContent.includes('00:30')),true);
  assert.equal(await page.$eval('[data-id="ready"]',el=>el.dataset.include),'1');
  assert.equal(await page.$eval('[data-id="ready2"]',el=>el.dataset.include),'1');
  assert.equal(await page.$eval('[data-id="stale"]',el=>el.dataset.status),'stale');
  assert.equal(await page.$eval('[data-id="stale"]',el=>el.dataset.include),'0');
  assert.equal(await page.$eval('[data-id="dirty"]',el=>el.dataset.status),'incomplete');
  assert.equal(await page.$eval('[data-id="late"]',el=>el.dataset.status),'missing');
  assert.equal(await page.$eval('[data-id="night"]',el=>el.dataset.status),'noworksheet');
  assert.match(await page.$eval('#libhelp',el=>el.textContent),/does not email/);
  assert.match(await page.$eval('[data-id="ready"] .fn',el=>el.textContent),/2026-11-08_1-Sample-St\.pdf/);
  assert.doesNotMatch(await page.$eval('[data-id="ready"] .fn',el=>el.textContent),/\d{2}:\d{2}/);
  assert.equal(await page.$eval('#libroot',el=>el.dataset.shareMode),'files');
  await page.screenshot({path:path.join(ART,'pdf_library_mobile.png'),fullPage:true});
  await page.setViewport({width:1280,height:800,deviceScaleFactor:1});
  await page.screenshot({path:path.join(ART,'pdf_library_desktop.png'),fullPage:true});
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluate(()=>{window.__blobs=[]});
  await page.click('#shareDay');
  await page.waitForFunction(()=>window.__shares.length===1);
  const share=await page.evaluate(()=>window.__shares[0]);
  assert.deepEqual(share.keys.sort(),['files','title']);
  assert.equal(share.url,null);
  assert.equal(share.text,null);
  assert.equal(share.title,'CCSA worksheets '+DAY);
  assert.deepEqual(share.files.map(f=>f.name),['2026-11-08_1-Sample-St.pdf','2026-11-08_8-Second-St.pdf']);
  assert.deepEqual(share.files[0].head,[0x25,0x50,0x44,0x46]);
  assert.match(await page.$eval('#libmsg',el=>el.textContent),/share sheet finished/);
  assert.equal((await page.evaluate(()=>window.__blobs.filter(b=>b.type==='application/zip').length)),0);
  await page.evaluate(()=>{window.__shareMode='abort'});
  await page.click('#shareDay');
  await page.waitForFunction(()=>/cancelled/i.test(document.querySelector('#libmsg').textContent));
  assert.match(await page.$eval('#libmsg',el=>el.textContent),/Nothing was sent/);
  await page.evaluate(()=>{window.__shareMode='fail'});
  await page.click('#shareDay');
  await page.waitForFunction(()=>/Share failed/.test(document.querySelector('#libmsg').textContent));
  assert.match(await page.$eval('#libmsg',el=>el.textContent),/Nothing was sent/);
  assert.match(await page.$eval('#libmsg',el=>el.textContent),/ZIP/);
  assert.deepEqual(await snap(page),before);
  assert.deepEqual(await checksum(page,'ready'),sumReady);
  assert.deepEqual(await checksum(page,'stale'),sumStale);
  await page.click('[data-id="stale"] [data-libopen]');
  await page.waitForSelector('#keptwarn');
  assert.match(await page.$eval('#keptwarn',el=>el.textContent),/not rebuilt/);
  assert.match(await page.$eval('#keptname',el=>el.textContent),/4-Stale-St\.pdf/);
  await page.waitForSelector('#prev img');
  assert.equal(await page.$eval('#ttl',el=>el.textContent),'Saved PDF');
  assert.deepEqual(await checksum(page,'stale'),sumStale);
  await page.goBack().catch(()=>{});
  await page.evaluate(()=>{location.hash='#library/'+'2026-11-08'});
  await page.waitForSelector('#shareDay');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-id="ready"]');
  assert.equal(await page.$eval('[data-id="ready"]',el=>el.dataset.include),'1');
  assert.equal(await page.$eval('[data-id="stale"]',el=>el.dataset.status),'stale');
  assert.deepEqual(await snap(page),before);
  assert.deepEqual(await checksum(page,'ready'),sumReady);
  const formKeys=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('ccsa.forms.v1'))).sort().join(','));
  assert.equal(formKeys,'dirty,late,moved,ready,ready2,stale');
  assertNoAppError(page);
  await page.__context.close();
});

test('empty day and unsupported or single-file share use ZIP and combined PDF',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  const page=await newPage(libraryData(),'unsupported');
  await page.goto(BASE+'#library/2026-01-01',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#libempty');
  assert.equal(await page.$('#shareDay'),null);
  assert.equal(await page.$('#zipDay'),null);
  assert.match(await page.$eval('#libsum',el=>el.textContent),/Nothing was generated/);
  await page.screenshot({path:path.join(ART,'pdf_library_empty_day.png'),fullPage:true});
  await page.evaluate(()=>{location.hash='#library/2026-11-08'});
  await page.waitForSelector('#libroot');
  await storeReady(page,['ready','ready2','stale'],['stale']);
  await page.evaluate(()=>{location.hash='#library/2026-11-07';});
  await page.waitForFunction(()=>document.querySelector('#libroot')&&document.querySelector('#libroot').dataset.day==='2026-11-07');
  await page.evaluate(()=>{location.hash='#library/2026-11-08'});
  await page.waitForSelector('[data-id="ready"]');
  assert.equal(await page.$('#shareDay'),null);
  assert.ok(await page.$('#zipDay'));
  assert.ok(await page.$('#combineDay'));
  assert.match(await page.$eval('#libchoice',el=>el.textContent),/cannot share files/);
  const sharesBefore=await page.evaluate(()=>window.__shares.length);
  await page.click('[data-id="ready"] [data-libshare]');
  await page.waitForFunction(()=>/cannot share|Nothing is emailed/.test(document.querySelector('#libmsg').textContent));
  assert.equal(await page.evaluate(()=>window.__shares.length),sharesBefore);
  await page.evaluate(()=>{window.__blobs=[]});
  await page.click('#zipDay');
  await page.waitForFunction(()=>window.__blobs.some(b=>b.type==='application/zip'&&b.bytes&&b.bytes.length>100));
  const zipCheck=await page.evaluate(async()=>{
    const blob=window.__blobs.filter(b=>b.type==='application/zip').pop();
    const entries=CCSAPdf.unzipStore(blob.bytes);
    const ready=await pdfGet('ready');
    const got=entries.find(e=>e.name==='2026-11-08_1-Sample-St.pdf');
    const rb=ready.bytes instanceof Uint8Array?ready.bytes:new Uint8Array(ready.bytes);
    let same=!!got&&got.data.length===rb.length;
    if(same){for(let i=0;i<rb.length;i++)if(got.data[i]!==rb[i]){same=false;break}}
    const notes=entries.find(e=>e.name==='day-notes.txt');
    return {names:entries.map(e=>e.name),same:same,hasNotes:!!notes};
  });
  assert.deepEqual(zipCheck.names,['2026-11-08_1-Sample-St.pdf','2026-11-08_8-Second-St.pdf']);
  assert.equal(zipCheck.same,true);
  assert.equal(zipCheck.hasNotes,false);
  await page.evaluate(()=>{window.__blobs=[]});
  await page.click('#combineDay');
  await page.waitForFunction(()=>window.__blobs.some(b=>b.type==='application/pdf'&&b.bytes&&b.bytes[0]===0x25));
  const combined=await page.evaluate(async()=>{
    const blob=window.__blobs.filter(b=>b.type==='application/pdf').pop();
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    }
    const doc=await pdfjsLib.getDocument({data:blob.bytes.slice(),isEvalSupported:false}).promise;
    let text='';
    for(let i=1;i<=doc.numPages;i++){
      const content=await (await doc.getPage(i)).getTextContent();
      const items=Array.isArray(content.items)?content.items:[];
      text+=' '+items.map(it=>it.str||'').join(' ');
    }
    return {pages:doc.numPages,text:text};
  });
  assert.equal(combined.pages,2);
  assert.doesNotMatch(combined.text,/This page is a list only/);
  assert.doesNotMatch(combined.text,/Left out/);
  assert.doesNotMatch(combined.text,/Photo page/);
  const single=await newPage(libraryData(),'single');
  await single.goto(BASE+'#library/'+DAY,{waitUntil:'domcontentloaded'});
  await single.waitForSelector('#libroot');
  await storeReady(single,['ready','ready2'],[]);
  await single.evaluate(()=>{location.hash='#library/2026-01-01'});
  await single.waitForSelector('#libempty');
  await single.evaluate(()=>{location.hash='#library/2026-11-08'});
  await single.waitForSelector('[data-id="ready2"]');
  assert.equal(await single.$('#shareDay'),null);
  assert.ok(await single.$('#shareCombined'));
  await single.click('#shareCombined');
  await single.waitForFunction(()=>window.__shares.length===1);
  const one=await single.evaluate(()=>window.__shares[0]);
  assert.equal(one.files.length,1);
  assert.equal(one.files[0].name,'CCSA-'+DAY+'-worksheets.pdf');
  assert.deepEqual(one.files[0].head,[0x25,0x50,0x44,0x46]);
  assert.equal(one.url,null);
  await single.click('#shareZip');
  await single.waitForFunction(()=>window.__shares.length===2);
  const zipShare=await single.evaluate(()=>window.__shares[1]);
  assert.equal(zipShare.files.length,1);
  assert.equal(zipShare.files[0].name,'CCSA-'+DAY+'-worksheets.zip');
  assert.deepEqual(zipShare.files[0].head,[0x50,0x4b,0x03,0x04]);
  assertNoAppError(page);
  assertNoAppError(single);
  await page.__context.close();
  await single.__context.close();
});

test('worksheet rules stay, photos stay in the saved PDF, and reload keeps them',{timeout:180000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  const page=await newPage(photoData(),'files');
  await page.goto(BASE+'#job/photo',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#gen');
  const body=await page.evaluate(()=>document.body.innerText);
  assert.match(body,/Adam Westerman/);
  assert.match(body,/N\/A \(lithium\)/);
  assert.match(body,/N\/A \(new\)/);
  assert.match(body,/Cleaned\?/);
  await page.screenshot({path:path.join(ART,'worksheet_checks_mobile.png'),fullPage:true});
  await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=80;c.height=60;
    const x=c.getContext('2d');x.fillStyle='#2457c5';x.fillRect(0,0,80,60);x.fillStyle='#fff';x.font='16px sans-serif';x.fillText('Sample',8,36);
    const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',0.85));
    const file=new File([blob],'sample.jpg',{type:'image/jpeg'});
    const input=document.querySelector('#quick input[type="file"][multiple]');
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForSelector('#th-al0 img');
  const photosBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('ccsa.forms.v1')).photo.al[0].photos.slice());
  assert.equal(photosBefore.length,1);
  await page.click('#gen');
  await page.waitForSelector('#keptnote',{timeout:90000});
  assert.match(await page.$eval('#keptnote',el=>el.textContent),/Saved on this phone/);
  const fname=await page.$eval('.fn',el=>el.textContent);
  assert.equal(fname,'2026-11-08_4-Photo-St.pdf');
  assert.doesNotMatch(fname,/\d{2}:\d{2}/);
  await page.waitForFunction(()=>{const box=document.querySelector('#prev');return box&&!/Rendering preview/.test(box.textContent)},{timeout:60000});
  const preview=await page.evaluate(async()=>{
    const rec=await pdfGet('photo');
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    }
    const doc=await pdfjsLib.getDocument({data:rec.bytes.slice(),isEvalSupported:false}).promise;
    return {pages:doc.numPages,imgs:document.querySelectorAll('#prev img').length,note:document.querySelector('.pdfbox').innerText};
  });
  assert.ok(preview.pages>=3,preview.note);
  assert.match(preview.note,/photo/i);
  await page.screenshot({path:path.join(ART,'saved_pdf_with_photo.png'),fullPage:false});
  const sum=await checksum(page,'photo');
  const jobs=await page.evaluate(()=>localStorage.getItem('ccsa.jobs.v1'));
  await page.evaluate(()=>{location.hash='#library/2026-11-08'});
  await page.waitForSelector('[data-id="photo"]');
  assert.equal(await page.$eval('[data-id="photo"]',el=>el.dataset.include),'1');
  assert.equal(await page.$eval('[data-id="photo"]',el=>el.dataset.status),'ready');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-id="photo"]');
  assert.equal(await page.$eval('[data-id="photo"]',el=>el.dataset.include),'1');
  assert.deepEqual(await checksum(page,'photo'),sum);
  const after=await page.evaluate(async(photoId)=>{
    const f=JSON.parse(localStorage.getItem('ccsa.forms.v1')).photo;
    const db=await new Promise((res,rej)=>{const r=indexedDB.open('ccsa-photos');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    const rec=await new Promise((res,rej)=>{const q=db.transaction('photos').objectStore('photos').get(photoId);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
    const bytes=rec&&rec.data? (rec.data.byteLength||rec.data.length||0):0;
    return {photos:f.al[0].photos,jobs:localStorage.getItem('ccsa.jobs.v1'),bytes:bytes,tech:f.tech,cleaned:f.al[0].yn.cleaned,isNew:f.al[1].isNew};
  },photosBefore[0]);
  assert.deepEqual(after.photos,photosBefore);
  assert.equal(after.jobs,jobs);
  assert.ok(after.bytes>50);
  assert.equal(after.tech,'Adam Westerman');
  assert.equal(after.cleaned,'Yes');
  assert.equal(after.isNew,true);
  const sw=await page.evaluate(async()=>await (await fetch('sw.js')).text());
  assert.match(sw,/ccsa-v2\.30\.0-20261114/);
  assert.match(sw,/pdflib\.js/);
  assert.match(sw,/sheetfill\.js/);
  assertNoAppError(page);
  await page.__context.close();
});
