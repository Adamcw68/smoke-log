/* Photo-label transfer helpers. Clipsal SMA4 is mains-powered: 240V is always
   part of the power supply. A backup cell (9V, Ni-Mh, Lithium) stays as its own
   value. Other models are not given a supply they did not show. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.LabelRead=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const POWER=['9v','240v','Ni-Mh','Lithium'];
  const SMA4_NOTE='Clipsal SMA4 is always 240V mains';

  function normToken(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
  function showV(v){return Array.isArray(v)?v.join(', '):(v||'')}
  /* Clipsal SMA4, ignoring case and spaces/punctuation. SMA40 and other brands are not it.
     A model string that is only SMA4 counts when the brand is Clipsal or was not read.
     A different brand with model SMA4 does not. */
  function isClipsalSma4(manufacturer,model){
    const m=normToken(model),b=normToken(manufacturer);
    if(m==='SMA4')return b===''||b==='CLIPSAL';
    if(m==='CLIPSALSMA4')return true;
    return false}
  function knownPower(list){
    const set=new Set();
    (Array.isArray(list)?list:list?[list]:[]).forEach(function(p){if(POWER.indexOf(p)>=0)set.add(p)});
    return POWER.filter(function(p){return set.has(p)})}
  function ensureSma4Mains(list){
    const have=knownPower(list);
    if(have.indexOf('240v')<0)have.push('240v');
    return POWER.filter(function(p){return have.indexOf(p)>=0})}
  function correctReading(r){
    if(!r||!r.fields)return r;
    const model=r.fields.model&&r.fields.model.v;
    const manu=r.fields.manufacturer&&r.fields.manufacturer.v;
    if(!isClipsalSma4(manu,model))return r;
    const had=r.fields.power;
    const base=had&&had.note||'';
    const note=base.indexOf(SMA4_NOTE)>=0?base:(base?base+' · '+SMA4_NOTE:SMA4_NOTE);
    r.fields.power=Object.assign({},had||{},{v:ensureSma4Mains(had&&had.v),note:note});
    return r}
  /* Plan one Apply from this photo onto one alarm. Does not mutate the alarm.
     Power is adjusted only when this reading's model is Clipsal SMA4 and the
     field being applied is model, manufacturer, or power. */
  function transferField(alarm,reading,field,value){
    const a=alarm||{},src=reading||{};
    const model=field==='model'?value:(src.model||'');
    const manu=field==='manufacturer'?value:(src.manufacturer||'');
  let out=value,power=null,mfd=null;
  if((field==='power'||field==='model'||field==='manufacturer')&&isClipsalSma4(manu,model)){
    const base=field==='power'?value:(Array.isArray(a.power)?a.power:[]) ;
    const next=ensureSma4Mains(base);
    if(field==='power')out=next;
    else if(showV(knownPower(a.power))!==showV(next))power=next}
  if(field==='expiry'&&src.mfd&&showV(a.mfd)!==showV(src.mfd))mfd=src.mfd;
  return {value:out,power:power,mfd:mfd}}
  function pad(n){return String(n).padStart(2,'0')}
  function isLeap(y){return y%4===0&&(y%100!==0||y%400===0)}
  function validYMD(y,m,d){
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d))return false;
    if(m<1||m>12||d<1)return false;
    const dim=[31,isLeap(y)?29:28,31,30,31,30,31,31,30,31,30,31];
    return d<=dim[m-1]}
  function isoOf(y,m,d){return y+'-'+pad(m)+'-'+pad(d)}
  function displayYMD(y,m,d){return pad(d)+'/'+pad(m)+'/'+y}
  function addYears(y,m,d,n){
    const y2=y+n;
    const dim=[31,isLeap(y2)?29:28,31,30,31,30,31,31,30,31,30,31];
    return {y:y2,m:m,d:Math.min(d,dim[m-1])}}
  /* 210119 is DDMMYY manufacture 21/01/2019, not an expiry and not a serial. */
  function parseFactoryCode(token,nowYear,role){
    if(!/^\d{6}$/.test(token))return null;
    const d=+token.slice(0,2),m=+token.slice(2,4),yy=+token.slice(4,6),y=2000+yy;
    if(!validYMD(y,m,d))return null;
    if(role==='exp'){if(y<1990||y>2100)return null}
    else if(y<2000||y>nowYear+1)return null;
    return {y:y,m:m,d:d,iso:isoOf(y,m,d),display:displayYMD(y,m,d),code:token}}
  const MFG_RX=/DATE\s*OF\s*MANUFACTURE|DATE\s*CODE|FACTORY(?:\s*(?:DATE|CODE))?|MANUFACTURED|MANUFACTURE(?!R)|\bMFD\b|\bMFG\b|\bDOM\b|\bMADE\b/g;
  const EXP_RX=/EXPIRY(?:\s*DATE)?|EXPIRES?|\bEXP\b|REPLACE(?:MENT)?(?:\s*(?:BY|BEFORE|DATE))?|USE\s*(?:BEFORE|BY)/g;
  function nearestKind(text,at,end){
    const a=Math.max(0,at-40),b=Math.min(text.length,end+24),slice=text.slice(a,b);
    let best=null;
    function scan(rx,kind){rx.lastIndex=0;let m;while((m=rx.exec(slice))){const s=a+m.index,e=s+m[0].length;let gap=e<=at?at-e:s>=end?s-end:0;if(gap>24)continue;if(!best||gap<best.gap||(gap===best.gap&&kind==='exp'))best={kind:kind,gap:gap}}}
    scan(MFG_RX,'mfg');scan(EXP_RX,'exp');return best?best.kind:''}
  function isSerialContext(text,at){
    return /\b(?:S\/?N|SERIAL|SER|MODEL|MOD|TYPE|CAT(?:ALOGUE)?|PART|P\/N|REF|NO)\.?\s*$/i.test(text.slice(Math.max(0,at-20),at))}
  function stamp(parsed,extra){return Object.assign({iso:parsed.iso,display:parsed.display,y:parsed.y,m:parsed.m,d:parsed.d},extra||{})}
  function explicitWrittenExpiry(text){
    const re=/(^|[^\d])(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*((?:19|20)\d{2})(?!\d)/g;
    const reMY=/(^|[^\d])(\d{1,2})\s*[\/\-.]\s*((?:19|20)\d{2})(?!\d)/g;
    let best=null;
    function consider(at,end,parsed){
      if(nearestKind(text,at,end)!=='exp')return;
      if(!best||at<best.at)best=Object.assign({at:at},parsed)}
    let m;while((m=re.exec(text))){
      const d=+m[2],mo=+m[3],y=+m[4],at=m.index+m[1].length;
      if(!validYMD(y,mo,d)||y<1990||y>2100)continue;
      consider(at,at+m[0].length-m[1].length,{iso:isoOf(y,mo,d),display:displayYMD(y,mo,d),y:y,m:mo,d:d})}
    while((m=reMY.exec(text))){
      const mo=+m[2],y=+m[3],at=m.index+m[1].length;
      if(mo<1||mo>12||y<1990||y>2100)continue;
      if(best&&Math.abs(best.at-at)<3)continue;
      consider(at,at+m[0].length-m[1].length,{iso:null,display:pad(mo)+'/'+y,y:y,m:mo,d:null})}
    return best}
  /* Clipsal-only. A six-digit code is DDMMYY manufacture unless an expiry keyword claims it. */
  function clipsalFactoryExpiry(text,opts){
    opts=opts||{};
    const nowYear=opts.nowYear||new Date().getFullYear();
    const upper=String(text||'').toUpperCase().replace(/[\u2010-\u2015]/g,'-');
    const brand=opts.brand==='Clipsal'||opts.brandIsClipsal||/\bCL[I1L]PSAL\b/.test(upper);
    if(!brand)return null;
    const codes=[];
    const re=/(^|[^\d])(\d{6})(?!\d)/g;let m;
    while((m=re.exec(upper))){
      const token=m[2],at=m.index+m[1].length;
      if(isSerialContext(upper,at))continue;
      const kind=nearestKind(upper,at,at+6);
      const parsed=parseFactoryCode(token,nowYear,kind==='exp'?'exp':'mfg');if(!parsed)continue;
      codes.push(Object.assign({at:at,end:at+6,kind:kind},parsed))}
    const unique=function(list){const map=new Map();list.forEach(function(c){map.set(c.iso,c)});return [...map.values()]};
    const mfg=unique(codes.filter(function(c){return c.kind==='mfg'}));
    const expCodes=unique(codes.filter(function(c){return c.kind==='exp'}));
    const bare=unique(codes.filter(function(c){return c.kind===''}));
    let manufacture=null,weak=false,codeNote='';
    if(mfg.length===1)manufacture=mfg[0];
    else if(!mfg.length&&!expCodes.length&&bare.length===1){manufacture=bare[0];weak=true}
    const written=explicitWrittenExpiry(upper);
    let expiry=null,explicit=false,derived=false;
    if(written&&written.d){expiry=written;explicit=true}
    else if(written){expiry=written;explicit=true}
    else if(expCodes.length===1){expiry=expCodes[0];explicit=true}
    else if(manufacture&&mfg.length<=1){
      const e=addYears(manufacture.y,manufacture.m,manufacture.d,10);
      expiry={iso:isoOf(e.y,e.m,e.d),display:displayYMD(e.y,e.m,e.d),y:e.y,m:e.m,d:e.d,derived:true};
      derived=true}
    if(opts.explicitExpiry&&!explicit)expiry=expiry&&expiry.derived?null:expiry;
    if(!manufacture&&!expiry)return null;
    const made=manufacture?stamp(manufacture,{code:manufacture.code,note:'Clipsal factory code '+manufacture.code+' is manufacture '+manufacture.display}):null;
    let expOut=null,note='';
    if(expiry&&explicit){
      expOut={iso:expiry.iso,display:expiry.display,y:expiry.y,m:expiry.m,d:expiry.d,derived:false};
      note='Explicit expiry '+expiry.display+' (not manufacture + 10 years).';
      if(made)note+=' '+made.note+'.'}
    else if(expiry&&derived&&manufacture){
      expOut={iso:expiry.iso,display:expiry.display,derived:true};
      note=(weak?'Possible Clipsal factory code ':'Clipsal factory code ')+manufacture.code+' is manufacture '+manufacture.display+'. Replacement due '+expiry.display+' (10 years)'+(weak?' — confirm this is the manufacture date.':'.')}
    return {manufacture:made,expiry:expOut,explicit:explicit,derived:derived,weak:weak,note:note}}
  function normalizeExpiry(s){
    const t=String(s||'').trim();
    let m=t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if(m){const d=+m[1],mo=+m[2],y=+m[3];if(!validYMD(y,mo,d)||y<1990||y>2100)return null;return {display:displayYMD(y,mo,d),iso:isoOf(y,mo,d),day:d,month:mo,year:y}}
    m=t.match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if(m){const mo=+m[1],y=+m[2];if(mo<1||mo>12||y<1990||y>2100)return null;return {display:pad(mo)+'/'+y,iso:null,day:null,month:mo,year:y}}
    return null}
  function expiryMonthIndex(s){const n=normalizeExpiry(s);return n?n.year*12+n.month:null}
  function formatExpiryTyping(v,deleting){
    v=String(v||'').replace(/[^\d\/]/g,'');
    const digits=v.replace(/\//g,'');
    if(v.indexOf('/')<0&&digits.length===8)return digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4);
    if(v.indexOf('/')<0&&digits.length===6)return digits.slice(0,2)+'/'+digits.slice(2);
    if(!deleting&&/^\d{2}$/.test(v))return v+'/';
    return v}
  return {
    POWER:POWER,
    normToken:normToken,
    isClipsalSma4:isClipsalSma4,
    ensureSma4Mains:ensureSma4Mains,
    correctReading:correctReading,
    transferField:transferField,
    showV:showV,
    validYMD:validYMD,
    addYears:addYears,
    parseFactoryCode:parseFactoryCode,
    clipsalFactoryExpiry:clipsalFactoryExpiry,
    normalizeExpiry:normalizeExpiry,
    expiryMonthIndex:expiryMonthIndex,
    formatExpiryTyping:formatExpiryTyping,
    displayYMD:displayYMD
  };
});
