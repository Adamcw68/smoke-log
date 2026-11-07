const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const si=require('./gsignin.js');

const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');

test('an empty job list still includes the Google connect control',function(){
  assert.equal(si.connectBarOnList({jobs:0,live:true}),true);
  const start=html.indexOf('if(!JOBS.length)');
  assert.ok(start>0);
  const branch=html.slice(start,html.indexOf('return}',start));
  assert.match(branch,/calBarHTML\(\)/);
  assert.match(branch,/bindCalendarControls\(\)/);
  assert.match(html,/src="gsignin\.js"/);
  assert.doesNotMatch(html,/Tap Refresh order from calendar again to sign in/);
});

test('the connect label is used until a token is fresh',function(){
  assert.equal(si.calendarButtonLabel({live:true,connected:false,tokenFresh:false,syncing:false}),'🔗 Connect Google Calendar');
  assert.equal(si.calendarButtonLabel({live:true,connected:true,tokenFresh:false,syncing:false}),'🔗 Connect Google Calendar');
  assert.equal(si.calendarButtonLabel({live:true,connected:true,tokenFresh:true,syncing:false}),'📅 Refresh order from calendar');
  assert.equal(si.calendarButtonLabel({live:false,connected:false,tokenFresh:false,syncing:false}),'📅 Refresh order from calendar');
  assert.equal(si.calendarButtonLabel({live:true,connected:false,tokenFresh:false,syncing:true}),'Syncing calendar…');
});

test('a missing Google script continues into sign-in instead of stopping',function(){
  const plan=si.signInAction({live:true,connected:false,tokenFresh:false,gisReady:false});
  assert.equal(plan.action,'sign-in');
  assert.equal(plan.prompt,'consent');
  assert.equal(plan.waitForGis,true);
  assert.equal(plan.writes,false);
  const again=si.signInAction({live:true,connected:true,tokenFresh:false,gisReady:true});
  assert.equal(again.prompt,'');
  assert.equal(again.waitForGis,false);
  assert.equal(si.signInAction({live:true,connected:true,tokenFresh:true,gisReady:true}).action,'sync');
  assert.equal(si.signInAction({live:false}).action,'import-file');
});

test('a worksheet read opens sign-in when the session cannot read, and never writes',function(){
  const signedOut=si.jobReadAction({live:true,connected:false,tokenFresh:false,gisReady:true,offline:false,syncing:false});
  assert.equal(signedOut.action,'sign-in-then-read');
  assert.equal(signedOut.prompt,'consent');
  assert.equal(signedOut.writes,false);
  const expired=si.jobReadAction({live:true,connected:true,tokenFresh:false,gisReady:false,offline:false,syncing:false});
  assert.equal(expired.action,'sign-in-then-read');
  assert.equal(expired.waitForGis,true);
  assert.equal(expired.writes,false);
  assert.equal(si.jobReadAction({live:true,connected:true,tokenFresh:true,gisReady:true}).action,'read');
  assert.equal(si.jobReadAction({live:true,offline:true,connected:false,tokenFresh:false}).reason,'offline');
  assert.equal(si.jobReadAction({live:true,syncing:true,connected:false,tokenFresh:false}).reason,'busy');
});

test('write consent stays a separate step and the client id and scope are unchanged',function(){
  assert.equal(si.showWriteConsent({live:true,connected:true,canWrite:false}),true);
  assert.equal(si.showWriteConsent({live:true,connected:true,canWrite:true}),false);
  assert.equal(si.showWriteConsent({live:true,connected:false,canWrite:false}),false);
  assert.equal(si.WRITE_SCOPE,'https://www.googleapis.com/auth/calendar.events');
  assert.match(html,/const GCAL_SCOPE='https:\/\/www\.googleapis\.com\/auth\/calendar\.events'/);
  assert.match(html,/initTokenClient\(\{client_id:GOOGLE_CLIENT_ID,scope:GCAL_SCOPE/);
  assert.match(html,/const GOOGLE_CLIENT_ID='1053644978631-3bdmfafhlc6c1d30kq4k0ru64s5v8tbk\.apps\.googleusercontent\.com'/);
  assert.doesNotMatch(html,/GOOGLE_CLIENT_ID='(?:'|placeholder|YOUR_)/);
});

test('deciding to show sign-in does not change jobs or the saved session',function(){
  const jobs=[{id:'a',arch:null,notes:'keep'}];
  const forms={a:{done:true,comments:'gate',photos:['p1'],al:[{expiry:'01/2029'}]}};
  const gcal={connected:true,token:'saved-token',exp:1,scope:''};
  const before=JSON.stringify({jobs:jobs,forms:forms,gcal:gcal});
  si.calendarButtonLabel({live:true,connected:true,tokenFresh:false});
  si.signInAction({live:true,connected:false,tokenFresh:false,gisReady:false});
  si.jobReadAction({live:true,connected:false,tokenFresh:false,gisReady:true,offline:false,syncing:false});
  si.showWriteConsent({live:true,connected:true,canWrite:false});
  si.connectBarOnList({jobs:0});
  assert.equal(JSON.stringify({jobs:jobs,forms:forms,gcal:gcal}),before);
});
