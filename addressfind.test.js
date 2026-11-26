const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const find=require('./addressfind.js');

const river={id:'river',addr:'18 River Street, Maclean NSW 2463',street:'18 River Street',town:'Maclean',agent:'Ray White Maclean/Yamba',contact:'Pat Sample',ident:'',section:'Permanent',arch:null};
const unit={id:'queen',addr:'Unit 1, 14 Queen Street, Yamba NSW 2464',street:'Unit 1, 14 Queen Street',town:'Yamba',agent:'Lifestyle',contact:'',ident:'Lot 2',section:'Holiday',arch:'2026-11-01T01:00:00.000Z'};
const beach={id:'beach',addr:'8/5 Beach St, Yamba NSW 2464',street:'8/5 Beach St',town:'Yamba',agent:'Raine & Horne',section:'Holiday',arch:null};
const forms={beach:{addr:'8/5 Beach Street, Yamba',ident:'Beach house',done:true}};

test('a job header puts the unit and street above the suburb',function(){
  assert.deepEqual(find.addressLines('Unit 1, 14 Queen Street, Yamba NSW 2464','Unit 1, 14 Queen Street','Yamba'),{line1:'Unit 1, 14 Queen Street',line2:'Yamba NSW 2464'});
  assert.deepEqual(find.addressLines('18 River Street, Maclean NSW 2463','18 River Street','Maclean'),{line1:'18 River Street',line2:'Maclean NSW 2463'});
  assert.deepEqual(find.addressLines('8/5 Beach St, Yamba NSW 2464','8/5 Beach St','Yamba'),{line1:'8/5 Beach St',line2:'Yamba NSW 2464'});
  assert.deepEqual(find.addressLines('1 Sample St','1 Sample St',''),{line1:'1 Sample St',line2:''});
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/header \.jobst,\.joblead \.jobst\{[^}]*font-size:1\.5rem/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*header\{[^}]*padding:4px 8px/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*header img\{height:26px\}/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*header \.jobst\{[^}]*font-size:1\.15rem;font-weight:800[^}]*text-overflow:ellipsis/);
  assert.match(html,/@media \(max-width:430px\)\{[\s\S]*\.joblead \.jobst\{[^}]*font-size:1\.35rem;font-weight:800/);
  assert.match(html,/CCSAAddress\.addressLines/);
  const sync=html.slice(html.indexOf('function paintSync'),html.indexOf('async function backupForSync'));
  const applied=html.slice(html.indexOf('async function applySyncResult'),html.indexOf('function syncHooks'));
  assert.match(sync,/paintHead\(open\)/);
  assert.match(applied,/openJobId\(\)/);
  assert.match(applied,/paintHead\(open\)/);
  assert.doesNotMatch(applied,/&&CURJOB\)renderJob/);
  assert.match(html,/class="jobst"/);
  assert.match(html,/class="jobsub"/);
});

test('street suffix, unit wording, suburb and part of the street all match',function(){
  assert.equal(find.matches([river.addr,river.street,river.town],'18 river st'),true);
  assert.equal(find.matches([river.addr],'RIVER'),true);
  assert.equal(find.matches([river.addr],'maclean'),true);
  assert.equal(find.matches([river.addr],'18  River'),true);
  assert.equal(find.matches([unit.addr,unit.street,unit.town],'1/14 queen st'),true);
  assert.equal(find.matches([unit.addr],'unit 1 14 Queen Street'),true);
  assert.equal(find.matches([unit.addr],'14 queen yamba'),true);
  assert.equal(find.matches([beach.addr,beach.street],'unit 8 5 beach street'),true);
  assert.equal(find.matches([beach.addr],'8/5 Beach St'),true);
  assert.equal(find.matches([beach.street],'beach rd'),false);
  assert.equal(find.matches([river.addr],'queen'),false);
  assert.equal(find.matches([''],'...'),false);
  assert.equal(find.matches([river.addr],''),true);
  assert.equal(find.matches([river.addr,river.agent],'ray white'),true);
});

test('a search returns archived and completed jobs and ignores the status tab',function(){
  const jobs=[river,unit,beach];
  assert.deepEqual(find.searchJobs(jobs,forms,'queen st').map(function(j){return j.id}),['queen']);
  assert.equal(jobs[1].arch!==null,true);
  assert.deepEqual(find.searchJobs(jobs,forms,'beach street').map(function(j){return j.id}),['beach']);
  assert.deepEqual(find.searchJobs(jobs,forms,'beach house').map(function(j){return j.id}),['beach']);
  assert.deepEqual(find.searchJobs(jobs,forms,'').map(function(j){return j.id}),['river','queen','beach']);
  const html=fs.readFileSync('index.html','utf8');
  const list=html.slice(html.indexOf('function renderList'),html.indexOf('function card'));
  assert.match(list,/CCSAAddress\.searchJobs\(JOBS,FORMS,UI\.q\)/);
  assert.match(list,/if\(!searching\)list=list\.filter\(passesJobFilter\)/);
  assert.match(list,/Search includes to-do, completed and archived jobs/);
  const portal=fs.readFileSync('portal/app.js','utf8');
  assert.match(portal,/CCSAAddress\.matches/);
  assert.match(portal,/p\.address,p\.street,p\.town,p\.ident/);
  const typing=list.slice(list.indexOf("$('#q').oninput"),list.indexOf("$('#sort').onchange"));
  assert.match(typing,/paintJobCards\(\)/);
  assert.equal(typing.includes('renderList'),false);
  assert.equal(typing.includes('setSelectionRange'),false);
  const portalType=portal.slice(portal.indexOf('q.oninput'),portal.indexOf('bindResultControls();'));
  assert.match(portalType,/box\.innerHTML=resultsHTML\(\)/);
  assert.equal(portalType.includes('setSelectionRange'),false);
  assert.deepEqual(portalType.match(/paint\(\)/g),['paint()']);
});

test('typing an address keeps the search field and narrows the list',{timeout:90000},async function(t){
  let puppeteer=null;
  try{puppeteer=require('puppeteer-core')}catch(e){return t.skip('puppeteer-core is not installed')}
  const {spawn}=require('child_process');
  const path=require('path');
  const port=8772;
  const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:'/workspace',stdio:'ignore'});
  const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/');if(r.ok)break}catch(e){}await new Promise(function(res){setTimeout(res,150)})}
    const page=await browser.newPage();
    await page.setViewport({width:390,height:844,deviceScaleFactor:2});
    await page.evaluateOnNewDocument(function(){window.CCSA_SYNC_DISABLED=true});
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(function(){return window.CCSAAddress&&typeof renderList==='function'});
    await page.evaluate(function(){
      function job(id,addr,arch){return {id:id,row:1,section:'Permanent',agent:'Ray White Maclean/Yamba',tech:'',last:'',due:'',ident:'',street:addr,town:'Yamba',addr:addr,directions:'',contact:'',p1:'',p2:'',ptype:'',beds:null,alarms:1,ladder:'',exp:[],ic:'',notes:'',extra:[],svc:null,order:1,arch:arch||null,src:'Sheet'}}
      JOBS=[job('river','18 River Street, Maclean NSW 2463'),job('queen','Unit 1, 14 Queen Street, Yamba NSW 2464','2026-11-01T01:00:00.000Z'),job('beach','8/5 Beach St, Yamba NSW 2464')];
      UI.q='';UI.filter='todo';
      renderList();
    });
    const field=await page.$('#q');
    await page.evaluate(function(){window.__search=document.getElementById('q')});
    await field.click();
    await page.keyboard.type('queen',{delay:20});
    const narrowed=await page.evaluate(function(){
      const box=document.getElementById('q');
      return {same:box===window.__search,value:box.value,focused:document.activeElement===box,cards:[].map.call(document.querySelectorAll('#cards .addr'),function(el){return el.textContent}),note:document.getElementById('qnote')?document.getElementById('qnote').textContent:''};
    });
    assert.equal(narrowed.same,true);
    assert.equal(narrowed.value,'queen');
    assert.equal(narrowed.focused,true);
    assert.deepEqual(narrowed.cards,['Unit 1, 14 Queen Street, Yamba NSW 2464']);
    assert.match(narrowed.note,/archived/);
    await page.keyboard.press('Enter');
    const afterEnter=await page.evaluate(function(){return {url:location.href,same:document.getElementById('q')===window.__search,value:document.getElementById('q').value}});
    assert.equal(afterEnter.url.includes('#'),false);
    assert.equal(afterEnter.same,true);
    assert.equal(afterEnter.value,'queen');
    await page.evaluate(function(){const box=document.getElementById('q');box.value='18 r';box.dispatchEvent(new Event('input',{bubbles:true}))});
    const partial=await page.evaluate(function(){return [].map.call(document.querySelectorAll('#cards .addr'),function(el){return el.textContent})});
    assert.deepEqual(partial,['18 River Street, Maclean NSW 2463']);
    await page.evaluate(function(){const box=document.getElementById('q');box.value='';box.dispatchEvent(new Event('input',{bubbles:true}))});
    const cleared=await page.evaluate(function(){return {note:!!document.getElementById('qnote'),n:document.querySelectorAll('#cards .card').length,same:document.getElementById('q')===window.__search}});
    assert.equal(cleared.note,false);
    assert.equal(cleared.n,2);
    assert.equal(cleared.same,true);
    await page.evaluate(function(){const box=document.getElementById('q');box.value='queen';box.dispatchEvent(new Event('input',{bubbles:true}));box.scrollIntoView({block:'start'})});
    await page.screenshot({path:path.join('/opt/cursor/artifacts','address-search.png')});
    const portal=await browser.newPage();
    await portal.setViewport({width:390,height:844,deviceScaleFactor:2});
    await portal.goto('http://127.0.0.1:'+port+'/portal/?demo=1',{waitUntil:'domcontentloaded'});
    await portal.waitForSelector('#q');
    await portal.evaluate(function(){window.__search=document.getElementById('q')});
    await portal.click('#q');
    await portal.keyboard.type('church',{delay:15});
    const found=await portal.evaluate(function(){
      return {same:document.getElementById('q')===window.__search,value:document.getElementById('q').value,text:document.getElementById('results').innerText};
    });
    assert.equal(found.same,true);
    assert.equal(found.value,'church');
    assert.match(found.text,/Church Street/);
    assert.equal(found.text.includes('River Street'),false);
  }finally{
    await browser.close();
    server.kill();
  }
});
