/* Synthetic Sync panel states. Firebase is not contacted. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8768;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
let browser,server;

test.before(async()=>{
  if(!puppeteer)return;
  fs.mkdirSync(ART,{recursive:true});
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch(e){}await new Promise(res=>setTimeout(res,150))}
  throw new Error('server did not start');
});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});

test('the sync panel shows each state without contacting Firebase',{timeout:60000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{window.CCSA_SYNC_DISABLED=true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#syncpanel');
  assert.match(await page.$eval('#syncstatus',el=>el.innerText),/Not signed in/);
  assert.equal(await page.$eval('#syncin',el=>el.textContent),'Sign in');
  await page.evaluate(()=>document.getElementById('syncpanel').scrollIntoView({block:'center'}));
  await (await page.$('#syncpanel')).screenshot({path:path.join(ART,'sync_panel_signed_out.png')});
  const shots=[
    ['sync_panel_not_configured.png',{configured:false}],
    ['sync_panel_syncing.png',{configured:true,user:{email:'synthetic@example.com',uid:'synthetic'},phase:'syncing'}],
    ['sync_panel_synced.png',{configured:true,user:{email:'synthetic@example.com',uid:'synthetic'},phase:'synced',lastSync:'2026-11-09T08:30:00.000Z'}],
    ['sync_panel_offline.png',{configured:true,user:{email:'synthetic@example.com',uid:'synthetic'},phase:'offline',unsyncedPhotos:1}]
  ];
  for(const pair of shots){
    await page.evaluate(state=>{
      document.getElementById('syncpanel').outerHTML=CCSASync.panelHTML(state);
    },pair[1]);
    await (await page.$('#syncpanel')).screenshot({path:path.join(ART,pair[0])});
  }
  const offline=await page.$eval('#syncstatus',el=>el.innerText);
  assert.match(offline,/Offline - changes saved on this device/);
  assert.match(await page.$eval('#syncpanel',el=>el.innerText),/Make PDF/);
  assert.match(await page.$eval('#syncpanel',el=>el.innerText),/only on this device/);
});
