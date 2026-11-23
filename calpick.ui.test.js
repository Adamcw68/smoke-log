/* Synthetic calendar picker. No Google requests. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8796;
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

test('each signed-in technician keeps their own calendar, and the picker survives reload',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const guard=()=>{
    window.CCSA_SYNC_DISABLED=true;
    const orig=window.fetch;
    window.fetch=function(url){
      const u=String(url&&url.url||url||'');
      if(/googleapis\.com/.test(u))return Promise.reject(new Error('synthetic test must not call Google'));
      return orig.apply(this,arguments);
    };
  };
  await page.evaluateOnNewDocument(guard);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof activeCalendarId==='function'&&window.CCSACalPick,{timeout:60000});
  const seeded=await page.evaluate(()=>{
    const craig='craig@clarencecoastsmokealarms.com.au';
    const adam='bearus69@gmail.com';
    const list=[
      {id:'craig@clarencecoastsmokealarms.com.au',summary:'Craig personal',primary:true},
      {id:'craig-jobs@group.calendar.google.com',summary:'Craig jobs',primary:false}
    ];
    GCAL.connected=true;GCAL.token='synthetic-token';GCAL.exp=Date.now()+3600000;GCAL.scope=GCAL_SCOPE;GCAL.ownerEmail=craig;GCAL.calendars=list;
    rememberCalendarChoice({id:'craig-jobs@group.calendar.google.com',summary:'Craig jobs',updated:'2026-11-23T01:00:00.000Z'});
    const craigJob={id:'craig-job',row:1,section:'Holiday',agent:'Ray White',tech:'',last:'',due:'2026-11-23',ident:'',street:'12 River St',town:'Yamba',addr:'12 River St, Yamba',directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:null,order:1,arch:null,src:'Calendar',calCalendarId:'craig-jobs@group.calendar.google.com'};
    const adamJob={id:'adam-job',row:2,section:'Permanent',agent:'LJ Hooker',tech:'',last:'',due:'2026-11-23',ident:'',street:'4 Beach Pde',town:'Iluka',addr:'4 Beach Pde, Iluka',directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:null,order:2,arch:null,src:'Calendar',calCalendarId:'a7rbih2gfr6rcfol434u08lt4k@group.calendar.google.com'};
    JOBS=[craigJob,adamJob];save(LS.jobs,JOBS);
    const r=ingestCalendar([
      {id:'ev-craig',summary:'12 River St, Yamba',location:'12 River St, Yamba',description:'',colorId:'7',iso:'2026-11-23T09:00:00+11:00',start:Date.parse('2026-11-23T09:00:00+11:00')}
    ],'craig-jobs@group.calendar.google.com');
    renderList();
    const adamDefault=CCSACalPick.defaultChoice(adam).id;
    const craigDefault=CCSACalPick.defaultChoice(craig).id;
    return {
      selected:document.querySelector('#calpick').value,
      label:document.querySelector('.calpick').innerText,
      button:document.querySelector('#calchoose').textContent,
      adamDefault,
      craigDefault,
      craigMay:jobMayPatch(JOBS.find(j=>j.id==='craig-job')),
      adamMay:jobMayPatch(JOBS.find(j=>j.id==='adam-job')),
      stamped:JOBS.find(j=>/River/.test(j.addr)).calCalendarId,
      ready:r.ready,
      googleCalls:0
    };
  });
  assert.equal(seeded.selected,'craig-jobs@group.calendar.google.com');
  assert.match(seeded.label,/Calendar/);
  assert.equal(seeded.button,'Choose calendar');
  assert.equal(seeded.adamDefault,'a7rbih2gfr6rcfol434u08lt4k@group.calendar.google.com');
  assert.equal(seeded.craigDefault,'primary');
  assert.equal(seeded.craigMay,true);
  assert.equal(seeded.adamMay,false);
  assert.equal(seeded.stamped,'craig-jobs@group.calendar.google.com');
  assert.equal(seeded.ready,1);
  await page.waitForSelector('#calpick');
  assert.equal(await page.$eval('#calpick',el=>el.selectedOptions[0].textContent),'Craig jobs');
  await page.evaluate(()=>{
    const el=document.querySelector('.calpick');
    window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+window.scrollY-150));
  });
  await page.screenshot({path:path.join(ART,'calendar_picker_phone.png')});
  await page.select('#calpick','craig@clarencecoastsmokealarms.com.au');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof activeCalendarId==='function'&&document.querySelector('#calpick'),{timeout:60000});
  const kept=await page.evaluate(()=>{
    const craig=CCSACalPick.recall(localStorage,'craig@clarencecoastsmokealarms.com.au');
    const adam=CCSACalPick.defaultChoice('bearus69@gmail.com');
    return {selected:document.querySelector('#calpick').value,saved:craig.id,adam:adam.id,active:activeCalendarId()};
  });
  assert.equal(kept.selected,'craig@clarencecoastsmokealarms.com.au');
  assert.equal(kept.saved,'craig@clarencecoastsmokealarms.com.au');
  assert.equal(kept.active,'craig@clarencecoastsmokealarms.com.au');
  assert.equal(kept.adam,'a7rbih2gfr6rcfol434u08lt4k@group.calendar.google.com');
});
