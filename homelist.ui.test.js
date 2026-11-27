/* Home list. Archived jobs stay off All, To do and Done, including the day's calendar count.
   The Archived tab and address search still find them. Archiving still calls the calendar sync. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8776;
const BASE='http://127.0.0.1:'+PORT+'/';
let browser,server;

function job(id,addr,extra){
  return Object.assign({id:id,row:1,section:'Permanent',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'',ident:'',street:addr.split(',')[0],town:'Yamba',addr:addr,directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-26T09:00:00+11:00',order:1,arch:null,src:'Sheet'},extra||{});
}

test.before(async()=>{
  if(!puppeteer)return;
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch(e){}await new Promise(res=>setTimeout(res,150))}
  throw new Error('server did not start');
});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});

test('the home list leaves archived jobs out, and search and Archived still find them',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  const html=fs.readFileSync('index.html','utf8');
  const archFn=html.slice(html.indexOf('function archiveJobs'),html.indexOf('function restoreJobs'));
  assert.match(archFn,/pushArchivedIds\(ids\)/);
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:900,deviceScaleFactor:2});
  await page.evaluateOnNewDocument(()=>{window.CCSA_SYNC_DISABLED=true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof renderList==='function'&&window.CCSAAddress);
  const home=await page.evaluate((openJob,doneJob,archJob)=>{
    JOBS=[openJob,doneJob,archJob];
    FORMS={
      done:{done:true,date:'2026-11-26',addr:doneJob.addr,alarms:1,al:[],photos:[],comments:''},
      arch:{done:true,date:'2026-11-26',addr:archJob.addr,alarms:1,al:[],photos:[],comments:''}
    };
    CAL_EVENTS=[
      {id:'e-arch',summary:'9 Church Street, Yamba, RWY, PERM',location:archJob.addr,description:'',colorId:'',iso:'2026-11-26T09:30:00+11:00',start:Date.parse('2026-11-26T09:30:00+11:00')},
      {id:'e-open',summary:'18 River Street, Yamba, RWY, PERM',location:openJob.addr,description:'',colorId:'7',iso:'2026-11-26T10:00:00+11:00',start:Date.parse('2026-11-26T10:00:00+11:00')}
    ];
    UI.q='';UI.filter='all';UI.calDay='2026-11-26';
    renderList();
    const text=document.querySelector('main').innerText;
    return {
      cards:[].map.call(document.querySelectorAll('#cards .addr'),el=>el.textContent),
      cal:document.querySelector('#calents').innerText,
      tabs:document.querySelector('.seg').innerText
    };
  },job('open','18 River Street, Yamba NSW 2464'),job('done','4 Beach St, Yamba NSW 2464',{order:2}),job('arch','9 Church Street, Yamba NSW 2464',{arch:'2026-11-26T02:00:00.000Z',order:3}));
  assert.deepEqual(home.cards,['18 River Street, Yamba NSW 2464','4 Beach St, Yamba NSW 2464']);
  assert.equal(home.cards.some(addr=>/Church/.test(addr)),false);
  assert.match(home.cal,/1 on this day/);
  assert.equal(home.cal.includes('Church'),false);
  assert.match(home.cal,/18 River Street/);
  assert.match(home.tabs,/Archived \(1\)/);
  await page.evaluate(()=>{const box=document.getElementById('q');const y=box.getBoundingClientRect().top+window.scrollY-8;window.scrollTo(0,Math.max(0,y))});
  fs.mkdirSync('/opt/cursor/artifacts',{recursive:true});
  await page.screenshot({path:path.join('/opt/cursor/artifacts','home-hides-archived.png')});
  await page.click('[data-f="arch"]');
  await page.waitForFunction(()=>document.querySelector('#cards .addr')&&/Church/.test(document.querySelector('#cards .addr').textContent));
  const archived=await page.evaluate(()=>[].map.call(document.querySelectorAll('#cards .addr'),el=>el.textContent));
  assert.deepEqual(archived,['9 Church Street, Yamba NSW 2464']);
  await page.click('[data-f="all"]');
  await page.waitForSelector('#q');
  const found=await page.evaluate(()=>{
    const box=document.getElementById('q');
    box.value='church';
    box.dispatchEvent(new Event('input',{bubbles:true}));
    return [].map.call(document.querySelectorAll('#cards .addr'),el=>el.textContent);
  });
  assert.deepEqual(found,['9 Church Street, Yamba NSW 2464']);
});
