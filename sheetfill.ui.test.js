/* Browser checks for agency codes, the smoke line, insect spray No, and the measured dB field.
   Addresses are synthetic. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8766;
const BASE='http://127.0.0.1:'+PORT+'/';
const ART='/opt/cursor/artifacts';
let browser, server;

function alarm(over){
  return Object.assign({isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'',expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]},over||{});
}
function form(agent,db){
  return {techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-08',time:'',ident:'Sample',agent:agent,addr:'1 Sample St, Yamba NSW 2464',ptype:'House',ptypeOther:'',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:'2026-11-08T01:00:00.000Z',al:[alarm(db==null?{}:{db:db})]};
}
function job(agent){
  return {id:'sample',row:1,section:'',agent:agent,tech:'',last:'',due:'2026-11-08',ident:'',street:'1 Sample St',town:'Yamba',addr:'1 Sample St, Yamba NSW 2464',directions:'',contact:'Sample Contact',p1:'0400000000',p2:'',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:['11/2036'],ic:'',notes:'',extra:[],svc:'2026-11-08T09:00:00+11:00',order:1,arch:null,src:'Synthetic'};
}

test.before(async()=>{
  if(!puppeteer)return;
  fs.mkdirSync(ART,{recursive:true});
  server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch(e){}await new Promise(res=>setTimeout(res,150))}
  throw new Error('server did not start');
});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});

async function pageWith(data){
  const context=await browser.createBrowserContext();
  const page=await context.newPage();
  page.__context=context;
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(payload=>{
    if(localStorage.getItem('ccsa.jobs.v1'))return;
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify(payload.jobs));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify(payload.forms));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify({tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}));
  },data);
  return page;
}

test('worksheet PDF prints agency codes, strikes smoke, marks insect No, and keeps a real dB',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=browser||await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PDFLib&&window.pdfjsLib&&window.SheetFill);
  const found=await page.evaluate(async()=>{
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    async function textOf(bytes){
      const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
      const pg=await doc.getPage(1);
      const tc=await pg.getTextContent();
      return tc.items.map(it=>it.str).join(' | ');
    }
    async function build(agent,db){
      const j={id:'s',street:'1 Sample St',addr:'1 Sample St, Yamba NSW 2464',agent:agent,exp:[],src:'Synthetic',notes:''};
      const f={tech:'Adam Westerman',date:'2026-11-08',ident:'Sample',agent:SheetFill.forForm(agent,j),addr:j.addr,ptype:'House',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',al:[{isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:db,expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]}]};
      const r=await buildPDF(j,f);
      return {text:await textOf(r.bytes),bytes:Array.from(r.bytes)};
    }
    const names=[['Ray White Yamba','RWY'],['Ray White Maclean','RWM'],['Raine & Horne','R&H'],['Lifestyle','LIFE'],['McGrath','McGrath']];
    const out=[];
    for(const pair of names){
      const made=await build(pair[0], pair[0]==='Ray White Yamba'?'99.5':'');
      out.push({in:pair[0],code:pair[1],text:made.text,bytes:pair[0]==='Ray White Yamba'?made.bytes:null,blank:pair[0]==='McGrath'?made.text:''});
    }
    const blank=await build('RWY','');
    return {out:out.map(x=>({in:x.in,code:x.code,has:x.text.includes(x.code),long:x.text.includes(x.in)&&x.in!==x.code,text:x.text})),blank:blank.text,png:out[0].bytes};
  });
  found.out.forEach(row=>{
    assert.equal(row.has,true,row.in+' should print '+row.code);
    assert.equal(row.long,false,row.in+' should not be left as the long name');
  });
  assert.match(found.out[0].text,/99\.5/);
  assert.doesNotMatch(found.blank,/\b99\.5\b|\b97\b|\b100\b|\b103\b/);
  assert.match(found.out.find(r=>r.in==='McGrath').text,/McGrath/);
  const pngBytes=await page.evaluate(async(bytes)=>{
    const data=new Uint8Array(bytes);
    const doc=await pdfjsLib.getDocument({data,isEvalSupported:false}).promise;
    const pg=await doc.getPage(1);
    const vp=pg.getViewport({scale:1.6});
    const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
    await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
    const tplBin=atob(document.getElementById('tpl').textContent.trim());
    const tpl=new Uint8Array(tplBin.length);for(let i=0;i<tplBin.length;i++)tpl[i]=tplBin.charCodeAt(i);
    const baseDoc=await pdfjsLib.getDocument({data:tpl,isEvalSupported:false}).promise;
    const base=await baseDoc.getPage(1);
    const bc=document.createElement('canvas');bc.width=vp.width;bc.height=vp.height;
    await base.render({canvasContext:bc.getContext('2d'),viewport:vp}).promise;
    function dark(canvas,x0,x1,y){
      const g=canvas.getContext('2d').getImageData(Math.floor(x0),Math.floor(y),Math.max(1,Math.ceil(x1-x0)),2).data;
      let n=0;for(let i=0;i<g.length;i+=4)if(g[i]<80&&g[i+1]<80&&g[i+2]<80)n++;
      return n;
    }
    const scale=1.6, y=(841.89-(176.2+3.2))*scale;
    const x0=301.5*scale, x1=(301.5+132.7)*scale;
    const strike=dark(c,x0,x1,y)-dark(bc,x0,x1,y);
    const blob=c.toDataURL('image/png');
    return {strike,png:blob};
  },found.png);
  assert.ok(pngBytes.strike>40,'smoke line should be struck, extra dark pixels '+pngBytes.strike);
  const buf=Buffer.from(pngBytes.png.split(',')[1],'base64');
  fs.writeFileSync(path.join(ART,'synthetic_worksheet_pdf.png'),buf);
  await page.close();
});

test('measured sound level is one field, persists, and a changed reading marks the saved PDF stale',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=browser||await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const data={jobs:[job('Ray White Yamba')],forms:{sample:form('Ray White Yamba','')}};
  const page=await pageWith(data);
  await page.goto(BASE+'#job/sample',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#db0');
  assert.equal(await page.$$eval('[data-path="al.0.db"]',els=>els.length),1);
  assert.match(await page.$eval('label[for="db0"]',el=>el.textContent),/Measured sound level/);
  assert.equal(await page.$eval('#db0',el=>el.value),'');
  assert.equal(await page.$eval('#agent',el=>el.value),'RWY');
  assert.equal(await page.$eval('body',el=>/insect surface|Responds to synthetic smoke|All Yes/.test(el.innerText)&&!/Insect surface spray/.test(el.innerText)),true);
  await page.click('#db0');
  await page.type('#db0','99.5');
  await page.evaluate(()=>{const el=document.getElementById('db0');el.dispatchEvent(new Event('change',{bubbles:true}))});
  assert.equal(await page.$eval('#db0',el=>el.value),'99.5');
  await page.screenshot({path:path.join(ART,'worksheet_measured_db_mobile.png'),fullPage:false});
  const before=await page.evaluate(()=>localStorage.getItem('ccsa.forms.v1'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#db0');
  assert.equal(await page.$eval('#db0',el=>el.value),'99.5');
  assert.equal(await page.$eval('#agent',el=>el.value),'RWY');
  await page.evaluate(()=>{const el=document.getElementById('db0');el.value='97-103';el.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.equal(await page.$eval('#db0',el=>el.value),'99.5');
  await page.evaluate(()=>{const el=document.getElementById('db0');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.equal(await page.$eval('#db0',el=>el.value),'');
  const jobs=await page.evaluate(()=>localStorage.getItem('ccsa.jobs.v1'));
  assert.match(jobs,/1 Sample St/);
  assert.doesNotMatch(before,/97-103/);
  const stale=await page.evaluate(async()=>{
    const j=JSON.parse(localStorage.getItem('ccsa.jobs.v1'))[0];
    const forms=JSON.parse(localStorage.getItem('ccsa.forms.v1'));
    const f=forms.sample;
    f.al[0].db='';
    const quiet=CCSAPdf.worksheetStamp(f);
    const doc=await PDFLib.PDFDocument.create();doc.addPage();
    const bytes=await doc.save();
    const kept=CCSAPdf.retainRecord({id:'sample',name:'2026-11-08_1-Sample-St.pdf',day:'2026-11-08',addr:f.addr,street:'1 Sample St',stamp:quiet,made:'2026-11-08T03:00:00.000Z',incomplete:false,bytes});
    await pdfPut(kept.record);
    const len=kept.record.bytes.byteLength;
    f.al[0].db='101.5';
    const st=CCSAPdf.statusOf(j,f,await pdfGet('sample'));
    const still=await pdfGet('sample');
    return {status:st.status,include:st.include,len:still.bytes.byteLength,same:still.bytes.byteLength===len};
  });
  assert.equal(stale.status,'stale');
  assert.equal(stale.include,false);
  assert.equal(stale.same,true);
  assert.ok(stale.len>5);
  await page.__context.close();
});
