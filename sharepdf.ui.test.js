/* Shared PDFs are worksheet pages only. Photos stay stored. Synthetic data only. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8773;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
const DAY='2026-11-13';

function alarm(over){
  return Object.assign({
    isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',
    power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'92',
    expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]
  },over||{});
}
function form(over){
  return Object.assign({
    techMode:'def',techOther:'',tech:'Adam Westerman',date:DAY,time:'',
    ident:'Synthetic',agent:'RWY',agentSet:true,tenancy:'Holiday',tenancySet:true,
    addr:'9 Synthetic St, Yamba NSW 2464',
    ptype:'House',ptypeOther:'',levels:1,beds:3,alarms:1,ladder:'Sm',
    asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'Synthetic share check',done:false,updated:'2026-11-13T01:00:00.000Z',
    al:[alarm()]
  },over||{});
}
function job(id,street,order){
  return {
    id:id,row:order,section:'Holiday',agent:'RWY',tech:'',last:'',due:DAY,ident:'',
    street:street,town:'Yamba',addr:street+', Yamba NSW 2464',directions:'',contact:'Synthetic Contact',
    p1:'0400111222',p2:'',ptype:'House',beds:3,alarms:1,ladder:'Sm',exp:['11/2036'],ic:'',notes:'',
    extra:[],svc:'2026-11-13T00:00:00+11:00',order:order,arch:null,src:'Synthetic'
  };
}
function sampleData(){
  const withPhoto=job('withphoto','9 Synthetic St',1);
  const plain=job('plain','10 Synthetic St',2);
  plain.addr='10 Synthetic St, Yamba NSW 2464';
  const photoForm=form({
    addr:withPhoto.addr,
    photos:['withphoto|job|sample'],
    al:[alarm({photos:['withphoto|al0|sample'],db:'92'})]
  });
  const plainForm=form({
    addr:plain.addr,photos:[],comments:'Second synthetic job',
    al:[alarm({photos:[],db:'88'})]
  });
  return {
    jobs:[withPhoto,plain],
    forms:{withphoto:photoForm,plain:plainForm},
    settings:{tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}
  };
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

async function newPage(data){
  const context=await browser.createBrowserContext();
  const page=await context.newPage();
  page.__context=context;
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(payload=>{
    window.CCSA_SYNC_DISABLED=true;
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify(payload.jobs));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify(payload.forms));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify(payload.settings));
    window.__shares=[];
    window.__blobs=[];
    const share=async function(data){
      const files=[];
      for(const f of data.files||[]){
        const buf=new Uint8Array(await f.arrayBuffer());
        files.push({name:f.name,type:f.type,size:buf.length,bytes:buf});
      }
      window.__shares.push({title:data.title||'',text:data.text==null?null:String(data.text),files:files});
    };
    const canShare=function(data){return !!(data&&data.files&&data.files.length)};
    Object.defineProperty(navigator,'share',{configurable:true,value:share});
    Object.defineProperty(navigator,'canShare',{configurable:true,value:canShare});
    const orig=URL.createObjectURL;
    URL.createObjectURL=function(obj){
      const url=orig.call(URL,obj);
      if(obj instanceof Blob)obj.arrayBuffer().then(buf=>{window.__blobs.push({type:obj.type||'',bytes:new Uint8Array(buf)})});
      return url;
    };
  },data);
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  page.__errors=errors;
  return page;
}
function assertNoAppError(page){
  const bad=(page.__errors||[]).filter(e=>!/Google|gsi|accounts\.google|firebase/i.test(e));
  assert.deepEqual(bad,[]);
}
function writePngs(prefix,dataUrls){
  const files=[];
  dataUrls.forEach((url,i)=>{
    const b64=String(url).replace(/^data:image\/png;base64,/,'');
    const name=prefix+'-page-'+(i+1)+'.png';
    fs.writeFileSync(path.join(ART,name),Buffer.from(b64,'base64'));
    files.push(name);
  });
  return files;
}

test('shared single-job and day PDFs contain worksheet pages only',{timeout:240000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  const page=await newPage(sampleData());
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#openlib',{timeout:30000});
  await page.evaluate(async()=>{
    async function jpeg(label,color){
      const c=document.createElement('canvas');c.width=120;c.height=80;
      const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,120,80);x.fillStyle='#fff';x.font='20px sans-serif';x.fillText(label,12,48);
      const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',0.9));
      return blob.arrayBuffer();
    }
    await photoPut({id:'withphoto|al0|sample',job:'withphoto',slot:'al0',type:'image/jpeg',data:await jpeg('Alarm','#2457c5'),w:120,h:80,ts:'2026-11-13T01:00:00.000Z'});
    await photoPut({id:'withphoto|job|sample',job:'withphoto',slot:'job',type:'image/jpeg',data:await jpeg('House','#c45a24'),w:120,h:80,ts:'2026-11-13T01:00:01.000Z'});
  });
  await page.evaluate(()=>{location.hash='#pdf/withphoto'});
  await page.waitForSelector('#share',{timeout:90000});
  await page.waitForSelector('#sendnote');
  await page.waitForFunction(()=>document.querySelectorAll('#prev img').length>=3,{timeout:90000});
  const note=await page.$('#sendnote');
  await note.screenshot({path:path.join(ART,'share-send-note.png')});
  const storedBefore=await page.evaluate(async()=>{
    const rec=await pdfGet('withphoto');
    const bytes=rec.bytes instanceof Uint8Array?rec.bytes:new Uint8Array(rec.bytes);
    const roles=await pageRoles(bytes);
    const described=await (async function describe(raw){
      const doc=await pdfjsLib.getDocument({data:raw.slice(),isEvalSupported:false}).promise;
      const OPS=pdfjsLib.OPS||{};
      const paint=new Set([OPS.paintImageXObject,OPS.paintJpegXObject,OPS.paintImageXObjectRepeat,OPS.paintImageMaskXObject].filter(v=>typeof v==='number'));
      let images=0,text='';
      for(let i=1;i<=doc.numPages;i++){
        const pg=await doc.getPage(i);
        const tc=await pg.getTextContent();
        const items=Array.isArray(tc.items)?tc.items:[];
        text+='\n'+items.map(it=>it.str||'').join(' ');
        const ops=await pg.getOperatorList();
        for(const fn of ops.fnArray)if(paint.has(fn))images++;
      }
      const pages=doc.numPages;
      try{await doc.destroy()}catch(e){}
      return {pages,images,text};
    })(bytes);
    return {pages:described.pages,images:described.images,roles:roles,len:bytes.length,text:described.text};
  });
  assert.equal(storedBefore.pages,3);
  assert.equal(storedBefore.roles.filter(r=>r==='worksheet').length,2);
  assert.equal(storedBefore.roles.filter(r=>r==='photo').length,1);
  assert.equal(storedBefore.roles.filter(r=>r==='summary').length,0);
  assert.match(storedBefore.text,/Photo page/);
  assert.match(storedBefore.text,/92/);
  await page.evaluate(()=>{window.__blobs=[]});
  await page.click('#share');
  await page.waitForFunction(()=>window.__shares.length===1);
  await page.click('#dl');
  await page.waitForFunction(()=>window.__blobs.some(b=>b.type==='application/pdf'&&b.bytes&&b.bytes[0]===0x25));
  const single=await page.evaluate(async()=>{
    async function describe(raw){
      const doc=await pdfjsLib.getDocument({data:raw.slice(),isEvalSupported:false}).promise;
      const OPS=pdfjsLib.OPS||{};
      const paint=new Set([OPS.paintImageXObject,OPS.paintJpegXObject,OPS.paintImageXObjectRepeat,OPS.paintImageMaskXObject].filter(v=>typeof v==='number'));
      let images=0,text='';
      const pngs=[];
      for(let i=1;i<=doc.numPages;i++){
        const pg=await doc.getPage(i);
        const tc=await pg.getTextContent();
        const items=Array.isArray(tc.items)?tc.items:[];
        const pageText=items.map(it=>it.str||'').join(' ');
        text+='\n'+pageText;
        const ops=await pg.getOperatorList();
        for(const fn of ops.fnArray)if(paint.has(fn))images++;
        const vp=pg.getViewport({scale:1.35});
        const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
        await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
        pngs.push(c.toDataURL('image/png'));
      }
      const pages=doc.numPages;
      try{await doc.destroy()}catch(e){}
      return {pages,images,text,pngs};
    }
    const shared=window.__shares[0].files[0];
    const downloaded=window.__blobs.filter(b=>b.type==='application/pdf').pop();
    const shareInfo=await describe(shared.bytes);
    const dlInfo=await describe(downloaded.bytes);
    const rec=await pdfGet('withphoto');
    const kept=rec.bytes instanceof Uint8Array?rec.bytes:new Uint8Array(rec.bytes);
    const keptDoc=await pdfjsLib.getDocument({data:kept.slice(),isEvalSupported:false}).promise;
    const keptPages=keptDoc.numPages;
    try{await keptDoc.destroy()}catch(e){}
    const db=await new Promise((res,rej)=>{const r=indexedDB.open('ccsa-photos');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    async function photoLen(id){
      const rec=await new Promise((res,rej)=>{const q=db.transaction('photos').objectStore('photos').get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
      const data=rec&&rec.data;
      return data?(data.byteLength||data.length||0):0;
    }
    return {
      name:shared.name,
      sharePages:shareInfo.pages,shareImages:shareInfo.images,shareText:shareInfo.text,sharePngs:shareInfo.pngs,
      dlPages:dlInfo.pages,dlText:dlInfo.text,
      keptPages:keptPages,
      alarmPhoto:await photoLen('withphoto|al0|sample'),
      housePhoto:await photoLen('withphoto|job|sample')
    };
  });
  assert.equal(single.name,'2026-11-13_9-Synthetic-St.pdf');
  assert.equal(single.sharePages,2);
  assert.equal(single.dlPages,2);
  assert.equal(single.keptPages,3);
  const jobShots=writePngs('shared-worksheet',single.sharePngs);
  assert.equal(jobShots.length,2);
  assert.ok(single.shareImages<storedBefore.images,'photo images stayed in the shared PDF: stored '+storedBefore.images+' shared '+single.shareImages);
  assert.match(single.shareText,/9 Synthetic St/);
  assert.match(single.shareText,/Ray White Maclean\/Yamba Holiday/);
  assert.match(single.shareText,/92/);
  assert.match(single.shareText,/0400 111 222/);
  assert.doesNotMatch(single.shareText,/Photo page/);
  assert.doesNotMatch(single.shareText,/(^|\n)\s*Photos\s*(\n|$)/);
  assert.doesNotMatch(single.shareText,/This page is a list only/);
  assert.doesNotMatch(single.shareText,/Alarm 1 .{0,3} photo/);
  assert.doesNotMatch(single.dlText,/Photo page/);
  assert.doesNotMatch(single.dlText,/This page is a list only/);
  assert.ok(single.alarmPhoto>50);
  assert.ok(single.housePhoto>50);

  await page.evaluate(()=>{location.hash='#pdf/plain'});
  await page.waitForSelector('#keptnote',{timeout:90000});
  await page.waitForFunction(()=>/Saved on this phone/.test(document.querySelector('#keptnote').textContent));
  await page.evaluate(()=>{location.hash='#library/2026-11-13'});
  await page.waitForSelector('#shareDay');
  await page.click('#shareDay');
  await page.waitForFunction(()=>window.__shares.length===2);
  await page.evaluate(()=>{window.__blobs=[]});
  await page.click('#combineDay');
  await page.waitForFunction(()=>window.__blobs.some(b=>b.type==='application/pdf'&&b.bytes&&b.bytes[0]===0x25));
  await page.click('#zipDay');
  await page.waitForFunction(()=>window.__blobs.some(b=>b.type==='application/zip'&&b.bytes&&b.bytes.length>100));
  await page.click('[data-id="withphoto"] [data-libshare]');
  await page.waitForFunction(()=>window.__shares.length===3);
  const day=await page.evaluate(async()=>{
    async function describe(raw,shots){
      const doc=await pdfjsLib.getDocument({data:raw.slice(),isEvalSupported:false}).promise;
      let text='';
      const kinds=[];
      const pngs=[];
      for(let i=1;i<=doc.numPages;i++){
        const pg=await doc.getPage(i);
        const tc=await pg.getTextContent();
        const items=Array.isArray(tc.items)?tc.items:[];
        const pageText=items.map(it=>it.str||'').join('\n');
        const flat=items.map(it=>it.str||'').join(' ');
        kinds.push(CCSAPdf.sharePageKind(pageText+'\n'+flat));
        text+='\n'+flat;
        if(shots){
          const vp=pg.getViewport({scale:1.2});
          const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
          await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
          pngs.push(c.toDataURL('image/png'));
        }
      }
      const pages=doc.numPages;
      try{await doc.destroy()}catch(e){}
      return {pages,text,kinds,pngs};
    }
    const files=window.__shares[1].files;
    const described=[];
    for(const f of files)described.push(Object.assign({name:f.name},await describe(f.bytes,false)));
    const combinedBlob=window.__blobs.filter(b=>b.type==='application/pdf').pop();
    const combined=await describe(combinedBlob.bytes,true);
    const zipBlob=window.__blobs.filter(b=>b.type==='application/zip').pop();
    const entries=CCSAPdf.unzipStore(zipBlob.bytes);
    const unzipped=[];
    for(const e of entries){
      if(!/\.pdf$/i.test(e.name)){unzipped.push({name:e.name,pages:0,text:''});continue}
      const info=await describe(e.data,false);
      unzipped.push({name:e.name,pages:info.pages,text:info.text});
    }
    const card=window.__shares[2].files[0];
    const cardInfo=await describe(card.bytes,false);
    const rec=await pdfGet('withphoto');
    const kept=rec.bytes instanceof Uint8Array?rec.bytes:new Uint8Array(rec.bytes);
    const keptDoc=await pdfjsLib.getDocument({data:kept.slice(),isEvalSupported:false}).promise;
    const keptPages=keptDoc.numPages;
    try{await keptDoc.destroy()}catch(e){}
    const plain=await pdfGet('plain');
    const plainBytes=plain.bytes instanceof Uint8Array?plain.bytes:new Uint8Array(plain.bytes);
    const plainDoc=await pdfjsLib.getDocument({data:plainBytes.slice(),isEvalSupported:false}).promise;
    const plainPages=plainDoc.numPages;
    try{await plainDoc.destroy()}catch(e){}
    return {files:described,combined,unzipped,cardPages:cardInfo.pages,cardText:cardInfo.text,keptPages,plainPages};
  });
  assert.deepEqual(day.files.map(f=>f.name),['2026-11-13_9-Synthetic-St.pdf','2026-11-13_10-Synthetic-St.pdf']);
  assert.deepEqual(day.files.map(f=>f.pages),[2,2]);
  day.files.forEach(f=>{
    assert.deepEqual(f.kinds,['worksheet','worksheet']);
    assert.doesNotMatch(f.text,/Photo page/);
    assert.doesNotMatch(f.text,/This page is a list only/);
  });
  assert.match(day.files[0].text,/92/);
  assert.match(day.files[1].text,/88/);
  assert.equal(day.combined.pages,4);
  assert.deepEqual(day.combined.kinds,['worksheet','worksheet','worksheet','worksheet']);
  assert.match(day.combined.text,/9 Synthetic St/);
  assert.match(day.combined.text,/10 Synthetic St/);
  assert.match(day.combined.text,/Ray White Maclean\/Yamba Holiday/);
  assert.doesNotMatch(day.combined.text,/Photo page/);
  assert.doesNotMatch(day.combined.text,/This page is a list only/);
  assert.doesNotMatch(day.combined.text,/Included in this pack/);
  assert.doesNotMatch(day.combined.text,/Left out/);
  const dayShots=writePngs('shared-day',day.combined.pngs);
  assert.equal(dayShots.length,4);
  assert.deepEqual(day.unzipped.map(e=>e.name),['2026-11-13_9-Synthetic-St.pdf','2026-11-13_10-Synthetic-St.pdf']);
  assert.deepEqual(day.unzipped.map(e=>e.pages),[2,2]);
  day.unzipped.forEach(e=>{
    assert.doesNotMatch(e.text,/Photo page/);
    assert.doesNotMatch(e.text,/This page is a list only/);
  });
  assert.equal(day.cardPages,2);
  assert.doesNotMatch(day.cardText,/Photo page/);
  assert.equal(day.keptPages,3);
  assert.equal(day.plainPages,2);
  const counts=[
    'Single job stored PDF (preview, photos kept): '+storedBefore.pages+' pages',
    'Single job shared PDF (share sheet and download): '+single.sharePages+' pages',
    'Worksheet pages in that stored PDF: 2',
    'Photo pages omitted from the share: 1',
    'Day group stored pages if sent whole, plus the old summary cover: '+(day.keptPages+day.plainPages+1),
    'Day group shared combined PDF: '+day.combined.pages+' pages',
    'Day group shared files: '+day.files.map(f=>f.name+' '+f.pages+' pages').join('; ')
  ].join('\n')+'\n';
  fs.writeFileSync(path.join(ART,'share-pdf-page-counts.txt'),counts);
  assert.equal(day.combined.pages,2+2);
  assert.ok(day.combined.pages<day.keptPages+day.plainPages+1);
  assertNoAppError(page);
  await page.__context.close();
});
