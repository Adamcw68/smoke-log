/* Archiving must keep synthetic photos visible. No Google Calendar and no Firebase. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8789;
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

test('an archived job still shows its photos after reload and after unarchive',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{window.CCSA_SYNC_DISABLED=true});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof photoPut==='function'&&typeof archiveJobs==='function',{timeout:60000});
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');
    canvas.width=24;canvas.height=24;
    const g=canvas.getContext('2d');
    g.fillStyle='#c8191f';g.fillRect(0,0,24,24);
    g.fillStyle='#fff';g.fillRect(6,6,12,12);
    const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.85));
    const data=await blob.arrayBuffer();
    const id='archjob|al0|shot';
    await photoPut({id:id,job:'archjob',slot:'al0',type:'image/jpeg',data:data,w:24,h:24,ts:'2026-11-17T01:00:00.000Z'});
    const house=id+'house';
    await photoPut({id:house,job:'archjob',slot:'job',type:'image/jpeg',data:data,w:24,h:24,ts:'2026-11-17T01:00:01.000Z'});
    JOBS=[{id:'archjob',row:1,section:'Holiday',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'2026-11-17',ident:'',street:'1 Archive St',town:'Yamba',addr:'1 Archive St, Yamba NSW 2464',directions:'',contact:'',p1:'',p2:'',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-17T09:00:00+11:00',order:1,arch:null,src:'Synthetic'}];
    FORMS={archjob:{tech:'Adam Westerman',date:'2026-11-17',agent:'Ray White Maclean/Yamba',agentSet:true,tenancy:'Holiday',tenancySet:true,addr:'1 Archive St, Yamba NSW 2464',ptype:'House',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:true,asPhotosSet:true,photos:[house],comments:'',done:true,updated:'2026-11-17T01:00:00.000Z',al:[{isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',power:['240v'],sensor:['Photo-Electric'],yn:{cleaned:'Yes'},photos:[id]}]}};
    save(LS.jobs,JOBS);save(LS.forms,FORMS);
    archiveJobs(['archjob'],'Job archived');
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof JOBS!=='undefined'&&JOBS.length,{timeout:60000});
  const kept=await page.evaluate(async()=>{
    const rows=await photoAll();
    return {arch:JOBS[0].arch,ids:FORMS.archjob.al[0].photos.slice(),house:FORMS.archjob.photos.slice(),stored:rows.map(p=>p.id).sort()};
  });
  assert.ok(kept.arch);
  assert.deepEqual(kept.ids,['archjob|al0|shot']);
  assert.deepEqual(kept.house,['archjob|al0|shothouse']);
  assert.deepEqual(kept.stored,['archjob|al0|shot','archjob|al0|shothouse']);
  await page.evaluate(()=>{location.hash='#job/archjob'});
  await page.waitForSelector('#archphotos img');
  await page.waitForFunction(()=>{const img=document.querySelector('#archphotos img');return img&&img.src.indexOf('blob:')===0});
  const view=await page.evaluate(()=>({
    gallery:document.querySelectorAll('#archphotos img').length,
    alarm:document.querySelectorAll('#th-al0 img').length,
    add:document.querySelectorAll('#archphotos input, #th-al0 input, [data-photo]').length,
    note:document.querySelector('#archphotos').innerText
  }));
  assert.equal(view.gallery,2);
  assert.equal(view.alarm,1);
  assert.equal(view.add,0);
  assert.match(view.note,/Archiving does not delete/);
  await page.$eval('#archphotos',el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(ART,'archived_job_photos.png'),fullPage:false});
  await page.click('#jrest');
  await page.waitForFunction(()=>!JOBS[0].arch);
  const back=await page.evaluate(()=>({
    ids:FORMS.archjob.al[0].photos.slice(),
    thumbs:document.querySelectorAll('#th-al0 img').length,
    src:document.querySelector('#th-al0 img')&&document.querySelector('#th-al0 img').src.slice(0,5)
  }));
  assert.deepEqual(back.ids,['archjob|al0|shot']);
  assert.equal(back.thumbs,1);
  assert.equal(back.src,'blob:');
});
