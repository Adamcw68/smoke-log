/* Address search for the job list and the agency portal.
   A typed street can use St or Street, 1/14 or Unit 1 14, and any part of the suburb.
   Matching does not depend on letter case, commas or extra spaces. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSAAddress=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUFFIX={
    st:'street',street:'street',
    rd:'road',road:'road',
    ave:'avenue',av:'avenue',avenue:'avenue',
    dr:'drive',drive:'drive',
    ct:'court',crt:'court',court:'court',
    pl:'place',place:'place',
    cres:'crescent',cr:'crescent',crescent:'crescent',
    tce:'terrace',ter:'terrace',terrace:'terrace',
    pde:'parade',parade:'parade',
    hwy:'highway',highway:'highway',
    ln:'lane',lane:'lane',
    cl:'close',close:'close',
    bvd:'boulevard',blvd:'boulevard',boulevard:'boulevard',
    cct:'circuit',cir:'circuit',circuit:'circuit',
    esp:'esplanade',esplanade:'esplanade',
    wy:'way',way:'way',
    sq:'square',square:'square'
  };

  function canon(text){
    let s=String(text||'').toLowerCase().replace(/['’.]/g,'').replace(/&/g,' and ');
    s=s.replace(/[^a-z0-9/]+/g,' ').replace(/\s+/g,' ').trim();
    s=s.replace(/\bu(\d+)\s*\/\s*(\d+)\b/g,'$1/$2');
    s=s.replace(/\bu(\d+)\s+(\d+)\b/g,'$1/$2');
    s=s.replace(/\b(\d+)\s*\/\s*(\d+)\b/g,'$1/$2');
    s=s.replace(/\b(?:unit|apt|apartment|flat|shop|u)\s+(\d+)\s+(\d+)\b/g,'$1/$2');
    s=s.replace(/\b(?:unit|apt|apartment|flat|shop|u)\s+(\d+\/\d+)\b/g,'$1');
    s=s.split(' ').map(function(word){return SUFFIX[word]||word}).join(' ');
    return s.replace(/\s+/g,' ').trim();
  }
  function hay(parts){
    const list=Array.isArray(parts)?parts:[parts];
    return canon(list.filter(function(part){return part!=null&&String(part).trim()!==''}).join(' '));
  }
  function matches(parts,query){
    const raw=String(query||'').trim();
    if(!raw)return true;
    const needle=canon(raw);
    if(!needle)return false;
    const found=hay(parts);
    return needle.split(' ').every(function(word){return found.indexOf(word)>=0});
  }
  function jobFields(job,form){
    job=job||{};
    form=form||{};
    return [job.addr,job.street,job.town,job.ident,job.agent,job.contact,job.section,form.addr,form.ident];
  }
  /* A typed search looks at every job, including archived and completed ones.
     An empty search returns the list unchanged so the to-do / done / archived tabs still apply. */
  function searchJobs(jobs,forms,query){
    const q=String(query||'');
    if(!q.trim())return (jobs||[]).slice();
    return (jobs||[]).filter(function(job){
      return matches(jobFields(job,forms&&job&&forms[job.id]),q);
    });
  }
  return {canon:canon,matches:matches,jobFields:jobFields,searchJobs:searchJobs};
});
