/* Synthetic portal publish. Does not call Firebase or Google Calendar. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8788;
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

test('the publish result names what was sent and what still needs an agency',{timeout:90000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{window.CCSA_SYNC_DISABLED=true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CCSAPortal&&window.CCSAPortalData);
  const message=await page.evaluate(async()=>{
    const jobs=[
      {id:'sea',agent:'RWM',addr:'1 Seaview Street, Iluka NSW 2466',street:'1 Seaview Street',town:'Iluka',ident:'Seaview @ Iluka',section:'Permanent',alarms:1,arch:'2026-11-15T01:00:00.000Z',due:'2027-11-15',last:'2025-11-15',tech:'Adam Westerman'},
      {id:'other',agent:'Coast Homes',addr:'9 Other Street, Yamba NSW 2464',street:'9 Other Street',town:'Yamba',ident:'',section:'Permanent',alarms:0,arch:null}
    ];
    const forms={sea:{agent:'RWM',agentSet:true,addr:'1 Seaview Street, Iluka NSW 2466',ident:'Seaview @ Iluka',tenancy:'Permanent',date:'2026-11-15',done:true,tech:'Adam Westerman',alarms:1,al:[{room:'Hallway',power:['240v'],sensor:['Photo-Electric'],expiry:'11/2036',yn:{comply:'Yes',located:'Yes',button:'Yes',affixed:'Yes'}}]}};
    const written=[];
    CCSAPortal.boot({
      getJobs:function(){return jobs},
      getForms:function(){return forms},
      storage:localStorage,
      toast:function(){},
      config:function(){return {apiKey:'demo',authDomain:'demo',projectId:'demo'}},
      client:function(){return {
        ready:true,
        auth:{currentUser:{uid:'adam',email:'adam@example.com'}},
        db:{},
        fb:{
          getDoc:async function(){return {exists:function(){return true},data:function(){return {email:'adam@example.com'}}}},
          getDocs:async function(){return {forEach:function(){}}},
          doc:function(){return {}},
          collection:function(){return {}},
          writeBatch:function(){return {set:function(_ref,data){written.push(data)},delete:function(){},commit:async function(){}}}
        }
      }}
    });
    CCSAPortal.onSync();
    for(let i=0;i<50&&!CCSAPortal.state().isAdmin;i++)await new Promise(function(r){setTimeout(r,20)});
    await CCSAPortal.publishAll();
    const ident=written.map(function(row){return row.ident}).filter(function(v){return v&&v.indexOf('Seaview')===0})[0];
    return {message:CCSAPortal.state().message,ident:ident,text:document.getElementById('portalmsg')?document.getElementById('portalmsg').innerText:''};
  });
  assert.match(message.message,/Published \d+ records to 1 agencies/);
  assert.match(message.message,/Needs agency: 9 Other Street, Yamba NSW 2464 \(Coast Homes\)/);
  assert.equal(message.message.indexOf('admins'),-1);
  assert.equal(message.ident,'Seaview at Iluka');
  assert.equal(message.text,message.message);
  await page.waitForSelector('#portalmsg');
  await page.$eval('#portalmsg',function(el){el.scrollIntoView({block:'center'})});
  const box=await page.$('#portalmsg');
  await box.screenshot({path:path.join(ART,'portal_publish_result.png')});
});
