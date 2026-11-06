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
    let out=value,power=null;
    if((field==='power'||field==='model'||field==='manufacturer')&&isClipsalSma4(manu,model)){
      const base=field==='power'?value:(Array.isArray(a.power)?a.power:[]) ;
      const next=ensureSma4Mains(base);
      if(field==='power')out=next;
      else if(showV(knownPower(a.power))!==showV(next))power=next}
    return {value:out,power:power}}
  return {
    POWER:POWER,
    normToken:normToken,
    isClipsalSma4:isClipsalSma4,
    ensureSma4Mains:ensureSma4Mains,
    correctReading:correctReading,
    transferField:transferField,
    showV:showV
  };
});
