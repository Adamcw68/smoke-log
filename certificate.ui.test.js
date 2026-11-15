/* Synthetic service report. Nothing is written to Google Calendar or Firebase. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8786;
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

test('the portal service report says 240V and the PDF page matches',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:1100,height:1400,deviceScaleFactor:1});
  await page.goto(BASE+'portal/?demo=1#certificate/18-river-street-maclean-nsw-2463-2026-08-12',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#certificate');
  const view=await page.$eval('#certificate',el=>el.innerText);
  assert.match(view,/SERVICE REPORT/);
  assert.match(view,/Clarence Coast Smoke Alarms/);
  assert.match(view,/0412 092 233/);
  assert.match(view,/c\/- Ray White Maclean\/Yamba/);
  assert.match(view,/240V Photoelectric Alarm/);
  assert.match(view,/Lithium Battery Photoelectric Alarm/);
  assert.match(view,/240V: hard-wired, battery can be changed/);
  assert.match(view,/240V lithium: hard-wired, sealed battery/);
  assert.equal(/\bHW\b/.test(view),false);
  assert.equal(view.includes('Jane Tenant'),false);
  assert.equal(view.includes('0400 111 222'),false);
  assert.match(await page.$eval('[data-download]',el=>el.textContent),/Download PDF/);
  const report=await page.$('#certificate');
  await report.screenshot({path:path.join(ART,'service_report_portal.png')});

  const pdfPage=await browser.newPage();
  await pdfPage.setViewport({width:900,height:1300,deviceScaleFactor:1});
  await pdfPage.goto(BASE,{waitUntil:'domcontentloaded'});
  await pdfPage.waitForFunction(()=>window.CCSACertificate&&window.pdfjsLib);
  const drawn=await pdfPage.evaluate(async()=>{
    const certs=(window.CCSAPortalData.demoView('rwm').certificates||[]).filter(function(c){return c.address.indexOf('18 River')===0});
    const bytes=CCSACertificate.buildCertificatePdf(certs[0]);
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    }
    const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
    const pg=await doc.getPage(1);
    const viewport=pg.getViewport({scale:1.35});
    const canvas=document.createElement('canvas');
    canvas.width=viewport.width;canvas.height=viewport.height;
    await pg.render({canvasContext:canvas.getContext('2d'),viewport:viewport}).promise;
    document.body.innerHTML='';
    document.body.style.margin='0';
    document.body.appendChild(canvas);
    const text=await pg.getTextContent();
    return text.items.map(function(item){return item.str}).join(' ');
  });
  assert.match(drawn,/SERVICE REPORT/);
  assert.match(drawn,/240V Photoelectric Alarm/);
  assert.match(drawn,/240V: hard-wired/);
  assert.equal(/\bHW\b/.test(drawn),false);
  assert.equal(drawn.includes('Jane Tenant'),false);
  const canvas=await pdfPage.$('canvas');
  await canvas.screenshot({path:path.join(ART,'service_report_pdf.png')});
  await pdfPage.close();
});
