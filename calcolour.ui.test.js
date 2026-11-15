/* Synthetic calendar colours. Peacock and Sage come in. Cocoa stays out. Nothing is written to Google. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8784;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
let browser,server;

function ev(id,street,colorId){
  return {id:id,summary:street+', Yamba, RWY, Holiday',location:street+', Yamba NSW 2464',description:'',colorId:colorId,iso:'2026-11-15T09:00:00+11:00',start:Date.parse('2026-11-15T09:00:00+11:00')};
}

test.before(async()=>{
  if(!puppeteer)return;
  fs.mkdirSync(ART,{recursive:true});
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch(e){}await new Promise(res=>setTimeout(res,150))}
  throw new Error('server did not start');
});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});

test('only peacock and sage appointments come in, and a later cocoa colour keeps the job',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{window.CCSA_SYNC_DISABLED=true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SheetFill&&window.ingestCalendar);
  const first=await page.evaluate((events)=>{
    const r=ingestCalendar(events);
    storeCalendarEvents(events);
    LASTIMP={msg:r.summary,bad:[],ok:true};
    renderList();
    return {summary:r.summary,jobs:JOBS.map(j=>({addr:j.addr,visit:j.visit,notReady:!!j.notReady})),forms:Object.keys(FORMS).length};
  },[ev('home','1 Peacock St','7'),ev('keys','2 Sage St','2'),ev('wait','3 Cocoa St',''),ev('other','4 Basil St','10')]);
  assert.equal(first.summary,'2 ready, 2 skipped (1 waiting on tenant)');
  assert.equal(first.jobs.length,2);
  assert.equal(first.jobs.find(j=>/Peacock/.test(j.addr)).visit,'tenant');
  assert.equal(first.jobs.find(j=>/Sage/.test(j.addr)).visit,'keys');
  assert.equal(first.forms,0);
  await page.waitForSelector('[data-visit="tenant"]');
  await page.waitForSelector('[data-visit="keys"]');
  assert.match(await page.$eval('#impsum',el=>el.innerText),/2 ready, 2 skipped \(1 waiting on tenant\)/);
  await page.evaluate(()=>{
    const el=document.querySelector('#impsum');
    const header=document.querySelector('header').offsetHeight;
    const filt=document.querySelector('.jobfilt').offsetHeight;
    const y=el.getBoundingClientRect().top+window.scrollY;
    window.scrollTo(0,Math.max(0,y-header-filt-8));
  });
  await page.screenshot({path:path.join(ART,'calendar_ready_jobs.png'),fullPage:false});
  const kept=await page.evaluate((events)=>{
    const home=JOBS.find(j=>/Peacock/.test(j.addr));
    FORMS[home.id]={tech:'Craig Robinson',date:'2026-11-15',agent:'RWY',agentSet:true,tenancy:'Holiday',tenancySet:true,addr:home.addr,alarms:1,al:[{yn:{cleaned:'Yes'},photos:['shot-1']}],photos:[],comments:'Keep me',done:false,updated:'2026-11-15T01:00:00.000Z'};
    const again=ingestCalendar(events);
    const still=JOBS.find(j=>j.id===home.id);
    return {count:JOBS.length,notReady:!!still.notReady,tech:FORMS[home.id].tech,photos:FORMS[home.id].al[0].photos.slice(),comments:FORMS[home.id].comments,summary:again.summary};
  },[ev('home','1 Peacock St',''),ev('keys','2 Sage St','2')]);
  assert.equal(kept.count,2);
  assert.equal(kept.notReady,true);
  assert.equal(kept.tech,'Craig Robinson');
  assert.deepEqual(kept.photos,['shot-1']);
  assert.equal(kept.comments,'Keep me');
  const back=await page.evaluate((events)=>{
    const again=ingestCalendar(events);
    const home=JOBS.find(j=>/Peacock/.test(j.addr));
    return {notReady:!!home.notReady,visit:home.visit,tech:FORMS[home.id].tech,summary:again.summary};
  },[ev('home','1 Peacock St','7'),ev('keys','2 Sage St','2')]);
  assert.equal(back.notReady,false);
  assert.equal(back.visit,'tenant');
  assert.equal(back.tech,'Craig Robinson');
  assert.equal(back.summary,'2 ready');
});
