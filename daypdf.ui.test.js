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
    const morning='2026-11-22T21:00:00.000Z';
    JOBS=[
      {id:'river',row:1,section:'Holiday',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'2026-11-23',ident:'',street:'12 River St',town:'Yamba',addr:'12 River St, Yamba NSW 2464',directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:morning,order:1,arch:null,src:'Calendar'},
      {id:'loose',row:2,section:'Permanent',agent:'Lifestyle Maclean/Yamba',tech:'',last:'',due:'',ident:'',street:'9 Loose St',town:'Yamba',addr:'9 Loose St, Yamba NSW 2464',directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:'',order:2,arch:null,src:'Sheet'},
      {id:'arch',row:3,section:'Holiday',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'',ident:'',street:'3 Archived St',town:'Maclean',addr:'3 Archived St, Maclean NSW 2463',directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-23T09:30:00+11:00',order:3,arch:'2026-11-23T00:30:00.000Z',src:'Calendar'},
      {id:'open',row:4,section:'Permanent',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'',ident:'',street:'8 Unfinished St',town:'Yamba',addr:'8 Unfinished St, Yamba NSW 2464',directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-23T10:00:00+11:00',order:4,arch:null,src:'Calendar'}
    ];
    const card=formFor(JOBS[0]);
    card.done=true;
    FORMS.loose={done:true,date:'23/11/2026',agent:'Lifestyle Maclean/Yamba',agentSet:true,addr:JOBS[1].addr,tech:'Craig Robinson',alarms:1,al:[alarm]};
    FORMS.open={done:false,date:'2026-11-23',agent:'Ray White Maclean/Yamba',addr:JOBS[3].addr,alarms:1,al:[alarm]};
    save(LS.jobs,JOBS);save(LS.forms,FORMS);
    renderList();
    openDayPdf();
    document.querySelector('#daydate').value='2026-11-23';
    paintDayPdf();
    return {
      cardDate:FORMS.river.date,
      count:document.querySelector('#daycount').textContent,
      included:document.querySelector('#dayin').innerText,
      skipped:document.querySelector('#dayskip').innerText
    };
  });
  assert.equal(shown.cardDate,'2026-11-23');
  assert.match(shown.count,/3 worksheets/);
  assert.match(shown.included,/12 River St/);
  assert.match(shown.included,/9 Loose St/);
  assert.match(shown.included,/3 Archived St/);
  assert.match(shown.skipped,/8 Unfinished St, Yamba NSW 2464 — Not finished/);
  assert.doesNotMatch(shown.included,/8 Unfinished/);
  await page.screenshot({path:path.join(ART,'day_pdf_phone.png')});
});
