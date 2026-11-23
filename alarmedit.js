/* Alarm editor helpers. Brand and model lists, power labels, and
   "same as previous alarm". Expiry, manufacture date, location and photos
   are never copied. Mains power is stored as 240v and shown as 240V, never HW. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CCSAAlarm=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const BRANDS=['Clipsal','Brooks','Red','Quell','PSA','Emerald','Cavius','Lifesaver','Kidde','Firepro','Hager'];
  const MODELS={
    Clipsal:['755LPSMA4','755RSMA','755PSMA4','SMA4'],
    Brooks:['EIB650i','EIB3016','PFC-610','PFC-450'],
    Red:['R240RC','R10RF','R240'],
    Quell:['Q1300','Q10Y','QPP10'],
    PSA:['LIF5800','LIF10YPE'],
    Emerald:['EP-PE-240','EP-10Y'],
    Cavius:['2107','2007'],
    Lifesaver:['5800','LIF10YPE'],
    Kidde:['P3010','10Y29'],
    Firepro:['FP240','FP10Y'],
    Hager:['TG500A','TG501A']
  };
  const POWER_LABEL={'9v':'9V','240v':'240V','Ni-Mh':'Ni-Mh','Lithium':'10yr lithium'};

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function knownBrand(value){
    const n=clean(value).toLowerCase();
    if(!n||n==='other')return '';
    return BRANDS.find(function(b){return b.toLowerCase()===n})||'';
  }
  function modelsFor(brand){
    const known=knownBrand(brand);
    return known&&MODELS[known]?MODELS[known].slice():[];
  }
  function knownModel(brand,model){
    const cur=clean(model).toLowerCase();
    if(!cur||cur==='other')return '';
    return modelsFor(brand).find(function(m){return m.toLowerCase()===cur})||'';
  }
  function choiceList(names,current,blank){
    const cur=clean(current);
    const hit=names.find(function(name){return name.toLowerCase()===cur.toLowerCase()});
    const options=[{value:'',label:blank,selected:!cur}];
    names.forEach(function(name){options.push({value:name,label:name,selected:hit===name})});
    if(cur&&!hit)options.push({value:cur,label:cur,selected:true});
    options.push({value:'Other',label:'Other',selected:false});
    return {options:options,customValue:cur&&!hit?cur:''};
  }
  function brandChoices(current){
    return choiceList(BRANDS,current,'Select brand');
  }
  function modelChoices(brand,current){
    const names=modelsFor(brand);
    return choiceList(names,current,names.length?'Select model':'Select or type a model');
  }
  function normalizePower(power){
    const out=[];
    (Array.isArray(power)?power:[power]).forEach(function(raw){
      const s=clean(raw);
      if(!s)return;
      let v=s;
      if(/^(hw|hard\s*wired|hardwired|mains)$/i.test(s)||/^240/i.test(s))v='240v';
      else if(/^9/i.test(s))v='9v';
      else if(/ni/i.test(s))v='Ni-Mh';
      else if(/lith/i.test(s))v='Lithium';
      if(out.indexOf(v)<0)out.push(v);
    });
    return out;
  }
  function powerLabel(value){
    const v=normalizePower([value])[0]||clean(value);
    return POWER_LABEL[v]||v;
  }
  function answerMap(yn){
    const out={};
    Object.keys(yn||{}).forEach(function(k){
      if(yn[k]==='Yes'||yn[k]==='No')out[k]=yn[k];
    });
    return out;
  }
  function hasDetails(alarm){
    if(!alarm)return false;
    if(clean(alarm.manufacturer)||clean(alarm.model))return true;
    if(normalizePower(alarm.power).length)return true;
    return Object.keys(answerMap(alarm.yn)).length>0;
  }
  /* Copy brand, model, power and Yes/No answers. Expiry, manufacture date, location and photos stay. */
  function copyFromPrevious(prev,current){
    const fields={
      manufacturer:clean(prev&&prev.manufacturer),
      model:clean(prev&&prev.model),
      power:normalizePower(prev&&prev.power),
      yn:answerMap(prev&&prev.yn)
    };
    return {fields:fields,empty:!hasDetails(prev),overwrite:hasDetails(current)};
  }
  return {
    BRANDS:BRANDS,
    MODELS:MODELS,
    POWER_LABEL:POWER_LABEL,
    knownBrand:knownBrand,
    knownModel:knownModel,
    modelsFor:modelsFor,
    brandChoices:brandChoices,
    modelChoices:modelChoices,
    normalizePower:normalizePower,
    powerLabel:powerLabel,
    hasDetails:hasDetails,
    copyFromPrevious:copyFromPrevious
  };
});
