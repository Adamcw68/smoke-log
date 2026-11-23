const test=require('node:test');
const assert=require('node:assert/strict');
const pick=require('./calpick.js');

function memory(){
  const box={};
  return {getItem:function(k){return box[k]||null},setItem:function(k,v){box[k]=v}};
}

test('Adam keeps the shared calendar and Craig starts on his primary calendar',function(){
  const adam=pick.defaultChoice('bearus69@gmail.com');
  const craig=pick.defaultChoice('craig@clarencecoastsmokealarms.com.au');
  assert.equal(adam.id,pick.SHARED_ID);
  assert.equal(craig.id,'primary');
  assert.equal(pick.loginHint(' Craig@ClarenceCoastSmokeAlarms.com.au '),'craig@clarencecoastsmokealarms.com.au');
  assert.equal(pick.loginHint(''),'');
});

test('two technicians keep different calendars, and a choice survives a new store read',function(){
  const store=memory();
  const craigList=[
    {id:'craig@clarencecoastsmokealarms.com.au',summary:'Craig',primary:true},
    {id:'craig-jobs@group.calendar.google.com',summary:'Craig jobs',primary:false}
  ];
  const adamList=[{id:pick.SHARED_ID,summary:'Smoke alarms',primary:false}];
  assert.equal(pick.chooseFromList('bearus69@gmail.com',adamList).id,pick.SHARED_ID);
  const chosen=pick.chooseFromList('craig@clarencecoastsmokealarms.com.au',craigList);
  assert.equal(chosen.id,'craig@clarencecoastsmokealarms.com.au');
  pick.remember(store,'craig@clarencecoastsmokealarms.com.au',{id:'craig-jobs@group.calendar.google.com',summary:'Craig jobs',updated:'2026-11-23T01:00:00.000Z'});
  pick.remember(store,'bearus69@gmail.com',{id:pick.SHARED_ID,summary:'Smoke alarm calendar',updated:'2026-11-23T01:00:00.000Z'});
  const again=pick.recall(store,'craig@clarencecoastsmokealarms.com.au');
  assert.equal(again.id,'craig-jobs@group.calendar.google.com');
  assert.equal(pick.recall(store,'bearus69@gmail.com').id,pick.SHARED_ID);
  assert.notEqual(again.id,pick.recall(store,'bearus69@gmail.com').id);
});

test('a job is only patched on the calendar it was imported from',function(){
  const craig='craig@clarencecoastsmokealarms.com.au';
  const job={id:'a',calCalendarId:craig};
  assert.equal(pick.mayPatch(job,craig),true);
  assert.equal(pick.mayPatch(job,pick.SHARED_ID),false);
  assert.equal(pick.patchCalendarId(job,pick.SHARED_ID),craig);
  assert.equal(pick.mayPatch({id:'old'},pick.SHARED_ID),true);
  assert.equal(pick.patchCalendarId({id:'old'},pick.SHARED_ID),pick.SHARED_ID);
  const list=[{id:craig,summary:'Craig',primary:true}];
  assert.equal(pick.mayPatch({calCalendarId:'primary'},craig,list),true);
  assert.equal(pick.patchCalendarId({calCalendarId:'primary'},craig,list),craig);
  assert.equal(pick.mayPatch({calCalendarId:'primary'},pick.SHARED_ID,list),false);
});
