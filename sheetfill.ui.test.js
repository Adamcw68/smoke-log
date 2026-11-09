/* Browser checks for agency codes, struck smoke and insect rows, and the measured dB field.
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

test('worksheet PDF prints agency codes, strikes obsolete rows through Yes and No, and keeps a real dB',{timeout:120000},async(t)=>{
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
    const names=[['Ray White Yamba','RWY'],['Ray White Maclean','RWM'],['Raine & Horne','R&H'],['Lifestyle','Lifestyle'],['McGrath','McGrath']];
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
    function dark(canvas,x0,x1,pdfY){
      const y=(841.89-pdfY)*scale;
      const g=canvas.getContext('2d').getImageData(Math.floor(x0),Math.max(0,Math.floor(y)-1),Math.max(1,Math.ceil(x1-x0)),3).data;
      let n=0;for(let i=0;i<g.length;i+=4)if(g[i]<90&&g[i+1]<90&&g[i+2]<90)n++;
      return n;
    }
    const scale=1.6;
    const sx=x=>x*scale;
    const diff=(x0,x1,pdfY)=>dark(c,sx(x0),sx(x1),pdfY)-dark(bc,sx(x0),sx(x1),pdfY);
    const rows={
      smokeGap:diff(438,456,179.4),
      smokeChoices:diff(459,530,179.4),
      insectGap:Math.abs(diff(400,455,150.7)),
      insectYes:dark(c,sx(462),sx(486),156),
      insectNo:dark(c,sx(516),sx(538),156),
      cleaned:Math.abs(diff(200,285,150.7)),
      affixed:Math.abs(diff(200,285,179.4)),
      aboveInsectNo:dark(c,sx(522),sx(533),155.4)
    };
    const crop=document.createElement('canvas');
    const top=(841.89-220)*scale, bot=(841.89-125)*scale;
    crop.width=c.width;crop.height=Math.ceil(bot-top);
    crop.getContext('2d').drawImage(c,0,top,c.width,bot-top,0,0,c.width,bot-top);
    return {rows,png:c.toDataURL('image/png'),crop:crop.toDataURL('image/png')};
  },found.png);
  assert.ok(pngBytes.rows.smokeGap>8,'smoke line continues through the gap before Yes '+pngBytes.rows.smokeGap);
  assert.ok(pngBytes.rows.smokeChoices>8,'smoke line crosses Yes and No '+pngBytes.rows.smokeChoices);
  assert.ok(pngBytes.rows.insectGap<20,'insect question is not struck through '+pngBytes.rows.insectGap);
  assert.ok(pngBytes.rows.insectNo>8,'insect No is circled '+pngBytes.rows.insectNo);
  assert.ok(pngBytes.rows.insectYes<8,'insect Yes is not circled '+pngBytes.rows.insectYes);
  assert.ok(pngBytes.rows.cleaned<30,'line must not cross the cleaned row '+pngBytes.rows.cleaned);
  assert.ok(pngBytes.rows.affixed<30,'line must not cross the affixed row '+pngBytes.rows.affixed);
  assert.ok(pngBytes.rows.aboveInsectNo>6,'the insect No circle sits on that choice '+pngBytes.rows.aboveInsectNo);
  fs.writeFileSync(path.join(ART,'synthetic_worksheet_obsolete_rows.png'),Buffer.from(pngBytes.png.split(',')[1],'base64'));
  fs.writeFileSync(path.join(ART,'synthetic_obsolete_check_rows.png'),Buffer.from(pngBytes.crop.split(',')[1],'base64'));
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

test('an old blank worksheet picks up a comma calendar title without changing house or unit',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=browser||await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const j=job('');
  j.agent='';j.section='';j.src='Earlier import';j.notes='Gate code 1234';j.ptype='House';
  const f=form('','');
  f.agent='';f.ptype='House';
  delete f.tenancy;delete f.tenancySet;delete f.agentSet;
  const ev={id:'ev-sample',summary:'1 Sample St, Yamba, RWY, Holiday',location:'1 Sample St, Yamba NSW 2464',description:'',iso:'2026-11-08T09:00:00+11:00',start:Date.parse('2026-11-08T09:00:00+11:00')};
  const context=await browser.createBrowserContext();
  const page=await context.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument((payload)=>{
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify(payload.jobs));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify(payload.forms));
    localStorage.setItem('ccsa.calevents.v1',JSON.stringify(payload.events));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify({tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}));
  },{jobs:[j],forms:{sample:f},events:[ev]});
  await page.goto(BASE+'#job/sample',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#agent');
  assert.equal(await page.$eval('#agent',el=>el.value),'RWY');
  assert.equal(await page.$eval('[data-tenancy] [data-v="Holiday"]',el=>el.classList.contains('on')),true);
  assert.equal(await page.$eval('[data-tenancy] [data-v="Permanent"]',el=>el.classList.contains('on')),false);
  assert.equal(await page.$eval('[data-chips="ptype"] [data-v="House"]',el=>el.classList.contains('on')),true);
  assert.equal(await page.$eval('[data-chips="ptype"] [data-v="Unit"]',el=>el.classList.contains('on')),false);
  await page.evaluate(()=>document.getElementById('agent').scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(ART,'worksheet_agency_tenancy_mobile.png')});
  const placed=await page.evaluate(async()=>{
    const j=JSON.parse(localStorage.getItem('ccsa.jobs.v1'))[0];
    const f=JSON.parse(localStorage.getItem('ccsa.forms.v1')).sample;
    const built=await buildPDF(j,f);
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    const doc=await pdfjsLib.getDocument({data:built.bytes.slice(),isEvalSupported:false}).promise;
    const pg=await doc.getPage(1);
    const tc=await pg.getTextContent();
    const items=tc.items.map(it=>({s:it.str,x:+it.transform[4].toFixed(1),y:+it.transform[5].toFixed(1)}));
    const ten=items.find(it=>/Tenancy:/.test(it.s));
    const agent=items.find(it=>it.s==='RWY Holiday');
    const vp=pg.getViewport({scale:1.7});
    const full=document.createElement('canvas');full.width=vp.width;full.height=vp.height;
    await pg.render({canvasContext:full.getContext('2d'),viewport:vp}).promise;
    const h=Math.round((841.89-500)*1.7);
    const c=document.createElement('canvas');c.width=full.width;c.height=h;
    c.getContext('2d').drawImage(full,0,0,full.width,h,0,0,full.width,h);
    const top=Math.round((841.89-210)*1.7), bot=Math.round((841.89-120)*1.7);
    const rows=document.createElement('canvas');rows.width=full.width;rows.height=bot-top;
    rows.getContext('2d').drawImage(full,0,top,full.width,bot-top,0,0,full.width,bot-top);
    const oldStamp=CCSAPdf.worksheetStamp(Object.assign({},f,{agent:'',tenancy:''}));
    const doc0=await PDFLib.PDFDocument.create();doc0.addPage();
    const bytes=await doc0.save();
    const kept=CCSAPdf.retainRecord({id:'sample',name:'2026-11-08_1-Sample-St.pdf',day:'2026-11-08',addr:f.addr,street:j.street,stamp:oldStamp,made:'2026-11-08T01:00:00.000Z',incomplete:false,bytes});
    await pdfPut(kept.record);
    const st=CCSAPdf.statusOf(j,f,await pdfGet('sample'));
    return {ten,agent,ptype:f.ptype,section:j.section,status:st.status,kept:kept.record.bytes.byteLength,still:(await pdfGet('sample')).bytes.byteLength,png:c.toDataURL('image/png'),rows:rows.toDataURL('image/png')};
  });
  assert.equal(placed.ptype,'House');
  assert.equal(placed.section,'Holiday');
  assert.equal(placed.ten,undefined);
  assert.ok(placed.agent&&placed.agent.y>600&&placed.agent.x>400,'combined agency and tenancy sit in the agent slot');
  assert.equal(placed.agent.s,'RWY Holiday');
  assert.equal(placed.status,'stale');
  assert.equal(placed.still,placed.kept);
  fs.writeFileSync(path.join(ART,'synthetic_agent_slot_pdf.png'),Buffer.from(placed.png.split(',')[1],'base64'));
  fs.writeFileSync(path.join(ART,'synthetic_check_rows_pdf.png'),Buffer.from(placed.rows.split(',')[1],'base64'));
  await context.close();
});

test('a sheet import fills a blank worksheet, keeps the mobile, and prints the agent with status',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=browser||await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.createBrowserContext();
  const page=await context.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SheetFill&&window.XLSX&&window.PDFLib);
  const found=await page.evaluate(async()=>{
    const header=['Agent','Address','Town','Phone 1','Phone 2','Annual Due','Property','Contact'];
    const preview=parseRows([header,['Lifestyle','1 Sample St','Yamba',400111222,'0266490000','2026-11-08','','Pat Sample'],['Ray White Maclean','4 Fresh St','Maclean','61400222333','+61 2 6649 1111','2026-11-08','','Fresh']]);
    const addr=preview[0].addr,id=jobKey(addr,preview[0].ident||'');
    const keptAddr='9 Kept St, Yamba NSW 2464',keptId=jobKey(keptAddr,'');
    const alarm={isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'',expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]};
    const blank={techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-08',time:'',ident:'Sample',agent:'',addr:addr,ptype:'House',ptypeOther:'',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:null,al:[alarm]};
    JOBS=[{id:id,row:1,section:'Holiday',agent:'',tech:'',last:'',due:'2026-11-08',ident:preview[0].ident||'',street:'1 Sample St',town:'Yamba',addr:addr,directions:'',contact:'Pat Sample',p1:'',p2:'pat@example.com',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:['11/2036'],ic:'',notes:'',extra:[],svc:'2026-11-08T09:00:00+11:00',order:1,arch:null,src:'Earlier import'},
      {id:keptId,row:2,section:'Permanent',agent:'McGrath',tech:'',last:'',due:'2026-11-08',ident:'',street:'9 Kept St',town:'Yamba',addr:keptAddr,directions:'',contact:'Kept',p1:'0411222333',p2:'',ptype:'Unit',beds:1,alarms:1,ladder:'Sm',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-08T10:00:00+11:00',order:2,arch:null,src:'Earlier import'}];
    FORMS[id]=Object.assign({},blank);
    FORMS[keptId]=Object.assign({},blank,{ident:'Kept',agent:'McGrath',agentSet:true,addr:keptAddr,ptype:'Unit',tenancy:'Permanent',tenancySet:true});
    save(LS.jobs,JOBS);save(LS.forms,FORMS);
    const doc0=await PDFLib.PDFDocument.create();doc0.addPage();
    const oldBytes=await doc0.save();
    const keptPdf=CCSAPdf.retainRecord({id:id,name:'2026-11-08_1-Sample-St.pdf',day:'2026-11-08',addr:addr,street:'1 Sample St',stamp:'old',made:'2026-11-08T01:00:00.000Z',incomplete:false,bytes:oldBytes});
    await pdfPut(keptPdf.record);
    const csv=[header.join(','),'Lifestyle,1 Sample St,Yamba,400111222,0266490000,2026-11-08,,Pat Sample','Ray White Yamba,9 Kept St,Yamba,+61 400 333 444,,2026-11-08,,Kept','Ray White Maclean,4 Fresh St,Maclean,61400222333,+61 2 6649 1111,2026-11-08,,Fresh'].join('\n');
    const st=await importFiles([new File([csv],'synthetic-jobs.csv',{type:'text/csv'})],'add');
    const job=JOBS.find(x=>x.id===id);
    const locked=JOBS.find(x=>x.id===keptId);
    const fresh=JOBS.find(x=>/Fresh/.test(x.street||''));
    const form=formFor(job);
    const freshForm=formFor(fresh);
    const built=await buildPDF(job,form);
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    const doc=await pdfjsLib.getDocument({data:built.bytes.slice(),isEvalSupported:false}).promise;
    const pg=await doc.getPage(1);
    const items=(await pg.getTextContent()).items.map(it=>({s:it.str,x:+it.transform[4].toFixed(1),y:+it.transform[5].toFixed(1)}));
    const notes=await doc.getPage(2);
    const noteText=(await notes.getTextContent()).items.map(it=>it.str).join(' | ');
    const vp=pg.getViewport({scale:1.7});
    const full=document.createElement('canvas');full.width=vp.width;full.height=vp.height;
    await pg.render({canvasContext:full.getContext('2d'),viewport:vp}).promise;
    const h=Math.round((841.89-500)*1.7);
    const head=document.createElement('canvas');head.width=full.width;head.height=h;
    head.getContext('2d').drawImage(full,0,0,full.width,h,0,0,full.width,h);
    const nvp=notes.getViewport({scale:1.6});
    const noteCanvas=document.createElement('canvas');noteCanvas.width=nvp.width;noteCanvas.height=Math.round(150);
    const nfull=document.createElement('canvas');nfull.width=nvp.width;nfull.height=nvp.height;
    await notes.render({canvasContext:nfull.getContext('2d'),viewport:nvp}).promise;
    noteCanvas.getContext('2d').drawImage(nfull,0,nfull.height-150,nfull.width,150,0,0,nfull.width,150);
    const still=await pdfGet(id);
    return {
      previewAgent:preview[0].agent,previewP1:preview[0].p1,previewP2:preview[0].p2,previewFresh:preview[1].agent,previewFreshP1:preview[1].p1,previewFreshP2:preview[1].p2,
      dup:st.dup,add:st.add,
      agent:job.agent,p1:job.p1,p2:job.p2,section:job.section,ptype:form.ptype,formAgent:form.agent,tenancy:form.tenancy,
      lockedAgent:locked.agent,lockedForm:FORMS[keptId].agent,lockedP1:locked.p1,lockedType:FORMS[keptId].ptype,
      freshAgent:fresh.agent,freshP1:fresh.p1,freshP2:fresh.p2,freshForm:freshForm.agent,
      slot:(items.find(it=>it.s==='Lifestyle Holiday')||null),
      tenancyLabel:items.some(it=>/Tenancy:/.test(it.s)),
      noteText:noteText,kept:keptPdf.record.bytes.byteLength,still:still.bytes.byteLength,
      head:head.toDataURL('image/png'),notes:noteCanvas.toDataURL('image/png'),id:id
    };
  });
  assert.equal(found.previewAgent,'Lifestyle');
  assert.equal(found.previewP1,'0400 111 222');
  assert.equal(found.previewP2,'02 6649 0000');
  assert.equal(found.previewFresh,'RWM');
  assert.equal(found.previewFreshP1,'0400 222 333');
  assert.equal(found.previewFreshP2,'02 6649 1111');
  assert.ok(found.dup>=1,'the existing address was updated, not skipped empty');
  assert.ok(found.add>=1);
  assert.equal(found.agent,'Lifestyle');
  assert.equal(found.formAgent,'Lifestyle');
  assert.equal(found.tenancy,'Holiday');
  assert.equal(found.section,'Holiday');
  assert.equal(found.ptype,'House');
  assert.equal(found.p1,'0400 111 222');
  assert.equal(found.p2,'pat@example.com');
  assert.equal(found.lockedAgent,'McGrath');
  assert.equal(found.lockedForm,'McGrath');
  assert.equal(found.lockedP1,'0411 222 333');
  assert.equal(found.lockedType,'Unit');
  assert.equal(found.freshAgent,'RWM');
  assert.equal(found.freshForm,'RWM');
  assert.equal(found.freshP1,'0400 222 333');
  assert.equal(found.freshP2,'02 6649 1111');
  assert.ok(found.slot&&found.slot.y>600&&found.slot.x>380,'Lifestyle Holiday is in the agent slot');
  assert.equal(found.tenancyLabel,false);
  assert.match(found.noteText,/0400 111 222/);
  assert.match(found.noteText,/pat@example.com/);
  assert.equal(found.still,found.kept);
  fs.writeFileSync(path.join(ART,'synthetic_lifestyle_phone_pdf.png'),Buffer.from(found.head.split(',')[1],'base64'));
  fs.writeFileSync(path.join(ART,'synthetic_phone_notes_pdf.png'),Buffer.from(found.notes.split(',')[1],'base64'));
  await page.goto(BASE+'#job/'+encodeURIComponent(found.id),{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#agent');
  assert.equal(await page.$eval('#agent',el=>el.value),'Lifestyle');
  assert.equal(await page.$eval('[data-tenancy] [data-v="Holiday"]',el=>el.classList.contains('on')),true);
  assert.equal(await page.$eval('[data-chips="ptype"] [data-v="House"]',el=>el.classList.contains('on')),true);
  assert.match(await page.$eval('main',el=>el.innerText),/0400 111 222/);
  await page.evaluate(()=>document.getElementById('agent').scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(ART,'worksheet_phone_agent_mobile.png')});
  await context.close();
});

test('insect No is circled, battery follows the answer, and the agency stays first',{timeout:120000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=browser||await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.createBrowserContext();
  const page=await context.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SheetFill&&window.PDFLib);
  await page.evaluate(()=>{
    const id='circle';
    const job={id:id,row:1,section:'',agent:'',tech:'',last:'',due:'2026-11-09',ident:'',street:'1 Circle St',town:'Yamba',addr:'1 Circle St, Yamba NSW 2464',directions:'',contact:'',p1:'0400111222',p2:'',ptype:'House',beds:2,alarms:1,ladder:'Sm',exp:[],ic:'',notes:'',extra:[],svc:'2026-11-09T09:00:00+11:00',order:1,arch:null,src:'Synthetic'};
    const alarm={isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'',expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]};
    const form={techMode:'def',techOther:'',tech:'Adam Westerman',date:'2026-11-09',time:'',ident:'Circle',agent:'',addr:job.addr,ptype:'House',ptypeOther:'',levels:1,beds:2,alarms:1,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',done:false,updated:null,al:[alarm]};
    localStorage.setItem('ccsa.jobs.v1',JSON.stringify([job]));
    localStorage.setItem('ccsa.forms.v1',JSON.stringify({[id]:form}));
    localStorage.setItem('ccsa.settings.v1',JSON.stringify({tech:'Adam Westerman',techV:2,techRecent:[],ocr:false}));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SheetFill);
  await page.evaluate(()=>{location.hash='#job/circle'});
  await page.waitForSelector('#agent');
  assert.equal(await page.$eval('body',el=>/Insect surface spray/.test(el.innerText)),false);
  await page.$eval('#agent',el=>{el.value='Holiday RWY';el.dispatchEvent(new Event('change',{bubbles:true}))});
  assert.equal(await page.$eval('#agent',el=>el.value),'RWY');
  assert.equal(await page.$eval('[data-tenancy] [data-v="Holiday"]',el=>el.classList.contains('on')),true);
  const found=await page.evaluate(async()=>{
    function alarm(over){
      return Object.assign({isNew:false,newAns:'No',mount:'Ceiling',room:'Hallway',bedno:'',other:'',adjacent:'',power:['240v'],sensor:['Photo-Electric'],manufacturer:'Brooks',model:'Sample',db:'',expiry:'11/2036',yn:{cleaned:'Yes',comply:'Yes',battery:'',located:'Yes',button:'Yes',affixed:'Yes'},photos:[]},over||{});
    }
    const j={id:'s',street:'1 Circle St',addr:'1 Circle St, Yamba NSW 2464',agent:'Holiday RWY',section:'',exp:[],src:'Synthetic',notes:'',p1:'',p2:''};
    const f={tech:'Adam Westerman',date:'2026-11-09',ident:'Circle',agent:'Holiday RWY',tenancy:'',addr:j.addr,ptype:'House',levels:1,beds:2,alarms:3,ladder:'Sm',asPrev:false,asPhotos:false,asPhotosSet:false,photos:[],comments:'',al:[
      alarm({yn:{cleaned:'Yes',comply:'Yes',battery:'Yes',located:'Yes',button:'Yes',affixed:'Yes'}}),
      alarm({power:['Lithium'],yn:{cleaned:'Yes',comply:'Yes',battery:'',located:'Yes',button:'Yes',affixed:'Yes'}}),
      alarm({power:['9v'],yn:{cleaned:'Yes',comply:'Yes',battery:'',located:'Yes',button:'Yes',affixed:'Yes'}})
    ]};
    const noBatt=await buildPDF(j,Object.assign({},f,{alarms:1,al:[alarm({yn:{cleaned:'Yes',comply:'Yes',battery:'No',located:'Yes',button:'Yes',affixed:'Yes'}})]}));
    const built=await buildPDF(j,f);
    const fourth=await buildPDF(j,Object.assign({},f,{alarms:4,al:f.al.concat([alarm({power:['Lithium'],yn:{cleaned:'',comply:'Yes',battery:'',located:'Yes',button:'Yes',affixed:'Yes'}})])}));
    if(!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'text/javascript'}));
    async function text(bytes,n){
      const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
      const pg=await doc.getPage(n);
      return (await pg.getTextContent()).items.map(it=>it.str).join(' | ');
    }
    async function paint(bytes,pageNo){
      const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
      const pg=await doc.getPage(pageNo);
      const vp=pg.getViewport({scale:2});
      const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      return c;
    }
    const tplBin=atob(document.getElementById('tpl').textContent.trim());
    const tpl=new Uint8Array(tplBin.length);for(let i=0;i<tplBin.length;i++)tpl[i]=tplBin.charCodeAt(i);
    const baseDoc=await pdfjsLib.getDocument({data:tpl,isEvalSupported:false}).promise;
    async function basePaint(pageNo){
      const pg=await baseDoc.getPage(pageNo);
      const vp=pg.getViewport({scale:2});
      const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      return c;
    }
    function dark(canvas,x0,y0,x1,y1){
      const g=canvas.getContext('2d').getImageData(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0)).data;
      let n=0;for(let i=0;i<g.length;i+=4)if(g[i]<80&&g[i+1]<80&&g[i+2]<80)n++;
      return n;
    }
    function extra(canvas,base,box){
      const s=2,x0=Math.floor((box[0]-8)*s),y0=Math.floor((box[1]-8)*s),x1=Math.ceil((box[2]+8)*s),y1=Math.ceil((box[3]+6)*s);
      return dark(canvas,x0,y0,x1,y1)-dark(base,x0,y0,x1,y1);
    }
    function crop(canvas,y0,y1){
      const c=document.createElement('canvas');c.width=canvas.width;c.height=Math.ceil(y1-y0);
      c.getContext('2d').drawImage(canvas,0,y0,canvas.width,y1-y0,0,0,canvas.width,y1-y0);
      return c.toDataURL('image/png');
    }
    const page1=await paint(built.bytes,1);
    const base1=await basePaint(1);
    const page2=await paint(built.bytes,2);
    const base2=await basePaint(2);
    const noPage=await paint(noBatt.bytes,1);
    const g=JSON.parse(document.getElementById('geom').textContent);
    const b0=g.blocks[0].yn,b1=g.blocks[1].yn,b2=g.blocks[2].yn;
    const head=document.createElement('canvas');
    const h=Math.round((841.89-500)*2);
    head.width=page1.width;head.height=h;
    head.getContext('2d').drawImage(page1,0,0,page1.width,h,0,0,page1.width,h);
    return {
      slot:await text(built.bytes,1),
      lithiumText:await text(built.bytes,2),
      notes:await text(fourth.bytes,2),
      yesBatt:extra(page1,base1,b0.battery.Yes),
      yesBattNo:extra(page1,base1,b0.battery.No),
      insectNo:extra(page1,base1,b0.insect.No),
      insectYes:extra(page1,base1,b0.insect.Yes),
      lithNo:extra(page2,base2,b1.battery.No),
      lithYes:extra(page2,base2,b1.battery.Yes),
      lithInsect:extra(page2,base2,b1.insect.No),
      blankYes:extra(page2,base2,b2.battery.Yes),
      blankNo:extra(page2,base2,b2.battery.No),
      blankInsect:extra(page2,base2,b2.insect.No),
      recordedNo:extra(noPage,base1,b0.battery.No),
      recordedNoYes:extra(noPage,base1,b0.battery.Yes),
      head:head.toDataURL('image/png'),
      rows:crop(page1,590*2,710*2),
      lith:crop(page2,230*2,360*2)
    };
  });
  assert.match(found.slot,/RWY Holiday/);
  assert.doesNotMatch(found.slot,/Holiday RWY/);
  assert.doesNotMatch(found.slot+' '+found.lithiumText,/N\/A \(lithium\)/);
  assert.ok(found.yesBatt>20,'battery Yes is circled '+found.yesBatt);
  assert.ok(found.yesBattNo<25,'battery No is not circled when the answer is Yes '+found.yesBattNo);
  assert.ok(found.recordedNo>20,'battery No is circled when that answer was recorded '+found.recordedNo);
  assert.ok(found.recordedNoYes<25,'battery Yes stays open when the answer is No '+found.recordedNoYes);
  assert.ok(found.lithNo>20,'lithium circles battery No '+found.lithNo);
  assert.ok(found.lithYes<25,'lithium does not circle battery Yes '+found.lithYes);
  assert.ok(Math.abs(found.blankYes)<25,'a blank battery Yes stays open '+found.blankYes);
  assert.ok(Math.abs(found.blankNo)<25,'a blank battery No stays open '+found.blankNo);
  assert.ok(found.insectNo>20,'insect No is circled '+found.insectNo);
  assert.ok(found.insectYes<25,'insect Yes is not circled '+found.insectYes);
  assert.ok(found.lithInsect>20,'insect No is circled on the lithium alarm '+found.lithInsect);
  assert.ok(found.blankInsect>20,'insect No is circled when battery was not answered '+found.blankInsect);
  assert.match(found.notes,/insect spray No/);
  assert.match(found.notes,/new battery No/);
  fs.writeFileSync(path.join(ART,'synthetic_agent_order_pdf.png'),Buffer.from(found.head.split(',')[1],'base64'));
  fs.writeFileSync(path.join(ART,'synthetic_battery_insect_rows.png'),Buffer.from(found.rows.split(',')[1],'base64'));
  fs.writeFileSync(path.join(ART,'synthetic_lithium_battery_rows.png'),Buffer.from(found.lith.split(',')[1],'base64'));
  await context.close();
});
