/* Day PDF screen with synthetic jobs. Nothing is sent to Google. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8798;
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

test('finished jobs on the Sydney day are listed on the Day PDF screen',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.emulateTimezone('UTC');
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{window.CCSA_SYNC_DISABLED=true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof openDayPdf==='function'&&window.CCSACertificate,{timeout:60000});
  const shown=await page.evaluate(()=>{
    const alarm={room:'Hallway',power:['240v'],yn:{comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes'}};
    const today='2026-11-23T06:00:00.000Z';
    function job(id,addr,street,svc,order){
      return {id:id,row:order,section:'Holiday',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'',ident:'',street:street,town:'Yamba',addr:addr,directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:svc,order:order,arch:null,src:'Calendar'};
    }
    JOBS=[
      job('afternoon','12 River St, Yamba NSW 2464','12 River St','2026-11-23T16:15:00+11:00',1),
      job('later','14 Beach Pde, Iluka NSW 2466','14 Beach Pde','2026-11-23T16:30:00+11:00',2),
      job('morning','7 Early St, Yamba NSW 2464','7 Early St','2026-11-23T08:30:00+11:00',3),
      job('early','4 Early Visit St, Maclean NSW 2463','4 Early Visit St','2026-11-28T09:00:00+11:00',4),
      job('open','8 Unfinished St, Yamba NSW 2464','8 Unfinished St','2026-11-23T10:00:00+11:00',5)
    ];
    JOBS[3].arch='2026-11-23T05:00:00.000Z';
    function done(addr,date){return {done:true,date:date,agent:'Ray White Maclean/Yamba',agentSet:true,addr:addr,tech:'Craig Robinson',alarms:1,al:[alarm],updated:today}}
    FORMS.afternoon=done(JOBS[0].addr,'2026-11-19');
    FORMS.later=done(JOBS[1].addr,'2026-11-09');
    FORMS.morning=done(JOBS[2].addr,'2026-11-07');
    FORMS.early=done(JOBS[3].addr,'2026-11-23');
    FORMS.open={done:false,date:'2026-11-23',agent:'Ray White Maclean/Yamba',addr:JOBS[4].addr,alarms:1,al:[alarm],updated:today};
    save(LS.jobs,JOBS);save(LS.forms,FORMS);
    renderList();
    openDayPdf();
    document.querySelector('#daydate').value='2026-11-23';
    paintDayPdf();
    return {
      count:document.querySelector('#daycount').textContent,
      included:document.querySelector('#dayin').innerText,
      skipped:document.querySelector('#dayskip').innerText,
      hint:document.querySelector('#dayhint').textContent
    };
  });
  assert.match(shown.count,/4 worksheets/);
  assert.match(shown.included,/12 River St/);
  assert.match(shown.included,/14 Beach Pde/);
  assert.match(shown.included,/7 Early St/);
  assert.match(shown.included,/4 Early Visit St/);
  assert.match(shown.skipped,/8 Unfinished St, Yamba NSW 2464 — Not finished/);
  assert.match(shown.hint,/Check its worksheet date/);
  await page.screenshot({path:path.join(ART,'day_pdf_phone.png')});
});
