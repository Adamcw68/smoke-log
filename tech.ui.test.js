/* Synthetic worksheet: Craig is filled on the form and on the PDF. Firebase is not contacted. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8781;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
let browser,server;

function alarm(){
  return {isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'92',expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]};
}

test.before(async()=>{
  if(!puppeteer)return;
  fs.mkdirSync(ART,{recursive:true});
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch(e){}await new Promise(res=>setTimeout(res,150))}
  throw new Error('server did not start');
});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});

test('a signed-in Craig fills a blank worksheet and its PDF',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const job={id:'craigjob',row:1,section:'Holiday',agent:'RWY',tech:'',last:'',due:'2026-11-14',ident:'Synthetic',street:'9 Synthetic St',town:'Yamba',addr:'9 Synthetic St, Yamba NSW 2464',directions:'',contact:'Synthetic Contact',p1:'0400111222',p2:'',ptype:'House',beds:3,alarms:1,ladder:'Sm',exp:['11/2036'],ic:'',notes:'',extra:[],svc:'2026-11-14T01:00:00+11:00',order:1,arch:null,src:'Synthetic'};
  const kept={id:'keptjob',row:2,section:'Holiday',agent:'RWY',tech:'',street:'10 Kept St',town:'Yamba',addr:'10 Kept St, Yamba NSW 2464',contact:'Synthetic',p1:'0400111222',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:['11/2036'],svc:'2026-11-14T02:00:00+11:00',order:2,arch:null,src:'Synthetic'};
  const keptForm={techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-14',ident:'Kept',agent:'RWY',agentSet:true,tenancy:'Holiday',tenancySet:true,addr:kept.addr,ptype:'House',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:'2026-11-14T01:00:00.000Z',al:[alarm()]};
  await page.evaluateOnNewDocument((jobs,forms)=>{
    window.CCSA_SYNC_DISABLED=true;
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify(jobs));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify(forms));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify({tech:'Adam',techV:2,techRecent:[],ocr:false}));
  },[job,kept],{keptjob:keptForm});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#settech');
  assert.match(await page.$eval('#settech',el=>el.innerText),/Adam/);
  await page.evaluate(()=>{
    const orig=CCSASync.state.bind(CCSASync);
    CCSASync.state=function(){const s=orig();s.user={email:'craig@clarencecoastsmokealarms.com.au',displayName:'Someone Else',uid:'synthetic'};return s};
    if(typeof paintSync==='function')paintSync();
  });
  await page.waitForFunction(()=>/Signed in as Craig/.test(document.getElementById('settech').innerText));
  await page.evaluate(()=>{location.hash='#job/craigjob'});
  await page.waitForSelector('#techctl');
  const formName=await page.$eval('#tprint',el=>el.innerText);
  assert.match(formName,/Craig/);
  assert.equal(await page.evaluate(()=>FORMS.craigjob.tech),'Craig');
  await page.evaluate(()=>{location.hash='#job/keptjob'});
  await page.waitForFunction(()=>/Adam Westerman/.test(document.getElementById('tprint').innerText));
  assert.equal(await page.evaluate(()=>FORMS.keptjob.tech),'Adam Westerman');
  await page.evaluate(()=>{location.hash='#job/craigjob'});
  await page.waitForSelector('#techctl');
  await page.evaluate(()=>document.getElementById('techctl').scrollIntoView({block:'center'}));
  await (await page.$('#techctl')).screenshot({path:path.join(ART,'technician_form_craig.png')});
  await page.evaluate(()=>{location.hash='#pdf/craigjob'});
  await page.waitForSelector('#prev img',{timeout:90000});
  const text=await page.evaluate(async()=>{
    const rec=window.__lastPdf;
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    const doc=await pdfjsLib.getDocument({data:rec.slice(),isEvalSupported:false}).promise;
    const content=await (await doc.getPage(1)).getTextContent();
    const items=Array.isArray(content.items)?content.items:[];
    return items.map(it=>it.str||'').join(' ');
  });
  assert.match(text,/Craig/);
  await (await page.$('#prev img')).screenshot({path:path.join(ART,'technician_pdf_craig.png')});
});
