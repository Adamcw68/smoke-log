/* Phone-sized check of the portal password eye. The password is synthetic. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
let puppeteer=null;
try{puppeteer=require('puppeteer-core')}catch(e){puppeteer=null}

const PORT=8779;
const BASE='http://127.0.0.1:'+PORT+'/portal/';
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

test('the portal password stays hidden until the eye is tapped',{timeout:60000},async(t)=>{
  if(!puppeteer)return t.skip('puppeteer-core is not installed');
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#password');
  await page.type('#email','synthetic@example.com');
  await page.type('#password','synthetic-pass');
  const hidden=await page.evaluate(()=>{
    const input=document.getElementById('password');
    const eye=document.querySelector('.pweye');
    const box=eye.getBoundingClientRect();
    return {type:input.type,value:input.value,label:eye.getAttribute('aria-label'),pressed:eye.getAttribute('aria-pressed'),auto:input.getAttribute('autocomplete'),name:input.name,button:eye.type,w:box.width,h:box.height};
  });
  assert.equal(hidden.type,'password');
  assert.equal(hidden.value,'synthetic-pass');
  assert.equal(hidden.label,'Show password');
  assert.equal(hidden.pressed,'false');
  assert.equal(hidden.auto,'current-password');
  assert.equal(hidden.name,'password');
  assert.equal(hidden.button,'button');
  assert.ok(hidden.w>=44&&hidden.h>=44);
  await (await page.$('.login')).screenshot({path:path.join(ART,'password_hidden_phone.png')});
  await page.click('.pweye');
  const shown=await page.evaluate(()=>{
    const input=document.getElementById('password');
    const eye=document.querySelector('.pweye');
    return {type:input.type,value:input.value,label:eye.getAttribute('aria-label'),pressed:eye.getAttribute('aria-pressed')};
  });
  assert.equal(shown.type,'text');
  assert.equal(shown.value,'synthetic-pass');
  assert.equal(shown.label,'Hide password');
  assert.equal(shown.pressed,'true');
  await (await page.$('.login')).screenshot({path:path.join(ART,'password_shown_phone.png')});
  await page.click('.pweye');
  const again=await page.evaluate(()=>{
    const input=document.getElementById('password');
    return {type:input.type,value:input.value,label:document.querySelector('.pweye').getAttribute('aria-label')};
  });
  assert.equal(again.type,'password');
  assert.equal(again.value,'synthetic-pass');
  assert.equal(again.label,'Show password');
  await page.evaluate(()=>{
    const form=document.getElementById('loginform');
    form.noValidate=true;
    form.onsubmit=function(e){e.preventDefault();window.__submitted=form.password.value};
  });
  await page.focus('#password');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__submitted==='synthetic-pass');
  assert.equal(await page.evaluate(()=>window.__submitted),'synthetic-pass');
});
