/* Agency names for the worksheet, and the measured sound level.
   Known agencies become the short code. Anything else is kept as written.
   A blank sound level stays blank. No reading is invented. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SheetFill=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function key(v){
    return clean(v).toLowerCase()
      .replace(/&/g,' and ')
      .replace(/raywhite/g,'ray white')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  const CODES={
    'rwy':'RWY','ray white yamba':'RWY',
    'rwm':'RWM','ray white maclean':'RWM',
    'r and h':'R&H','raine and horne':'R&H','raine horne':'R&H',
    'life':'LIFE','lifestyle':'LIFE'
  };
  /* Whole agency cell. "Ray White" alone is not enough to choose Yamba or Maclean. */
  function print(v){
    const raw=clean(v);
    if(!raw)return '';
    return CODES[key(raw)]||raw;
  }
  const PHRASES=[
    [/[, ]+ray\s*white\s*yamba$/i,'RWY'],
    [/[, ]+ray\s*white\s*maclean$/i,'RWM'],
    [/[, ]+raine\s*(?:&|and)\s*horne$/i,'R&H'],
    [/[, ]+lifestyle$/i,'LIFE']
  ];
  function tokenKind(token){
    const k=key(token);
    if(k==='perm'||k==='permanent')return {kind:'tenancy',value:'Permanent'};
    if(k==='hol'||k==='holiday')return {kind:'tenancy',value:'Holiday'};
    if(CODES[k])return {kind:'agent',value:CODES[k]};
    return null;
  }
  /* Calendar titles look like "12 Smith St, Yamba, RWY, Holiday".
     Tags are peeled from the end, commas included. The street is left alone.
     A tag in the middle of the street is not an agency. */
  function readTitle(summary){
    let s=clean(summary);
    let agent='',tenancy='';
    for(let n=0;n<8&&s;n++){
      s=s.replace(/[,\s]+$/,'');
      let phrase=false;
      for(let i=0;i<PHRASES.length;i++){
        if(PHRASES[i][0].test(s)){
          if(!agent)agent=PHRASES[i][1];
          s=s.replace(PHRASES[i][0],'').replace(/[,\s]+$/,'');
          phrase=true;break;
        }
      }
      if(phrase)continue;
      const m=s.match(/^(.*?)[,\s]+([A-Za-z0-9&]+)$/);
      if(!m){
        const only=tokenKind(s);
        if(only&&!/\s/.test(s)){
          if(only.kind==='agent'&&!agent)agent=only.value;
          if(only.kind==='tenancy'&&!tenancy)tenancy=only.value;
          s='';
        }
        break;
      }
      const tok=tokenKind(m[2]);
      if(!tok)break;
      if(tok.kind==='agent'&&!agent)agent=tok.value;
      if(tok.kind==='tenancy'&&!tenancy)tenancy=tok.value;
      s=m[1].replace(/[,\s]+$/,'');
    }
    return {agent:agent,tenancy:tenancy,text:clean(s)};
  }
  function stripTail(summary){
    const r=readTitle(summary);
    return {code:r.agent,tenancy:r.tenancy,text:r.text};
  }
  function agentLine(description){
    const m=String(description||'').match(/^agent\s*:\s*(.+)$/im);
    return m?clean(m[1]):'';
  }
  function tenancyName(v){
    const k=key(v);
    if(k==='perm'||k==='permanent')return 'Permanent';
    if(k==='hol'||k==='holiday')return 'Holiday';
    return '';
  }
  /* An Agent: line wins, including an unknown name. A title tag fills only a blank. */
  function readEvent(ev){
    ev=ev||{};
    const title=readTitle(ev.summary||'');
    const loc=readTitle(ev.location||'');
    const line=agentLine(ev.description);
    return {agent:line?print(line):(title.agent||loc.agent||''),tenancy:title.tenancy||loc.tenancy||''};
  }
  function fromEvent(ev){return readEvent(ev).agent}
  /* A typed agency stays. A blank one can take the job, then a known calendar tag. */
  function agentForForm(form,job,meta){
    form=form||{};job=job||{};meta=meta||{};
    if(form.agentSet)return print(form.agent);
    const current=clean(form.agent);
    if(current)return print(current);
    if(clean(job.agent))return print(job.agent);
    if(meta.agent)return meta.agent;
    if(job.src==='Calendar')return readTitle(job.notes||'').agent||'';
    return '';
  }
  /* Tenancy is Permanent or Holiday. It is not the house, unit, or other building type. */
  function tenancyForForm(form,job,meta){
    form=form||{};job=job||{};meta=meta||{};
    if(form.tenancySet)return tenancyName(form.tenancy);
    const current=tenancyName(form.tenancy);
    if(current)return current;
    const section=tenancyName(job.section);
    if(section)return section;
    if(meta.tenancy)return meta.tenancy;
    if(job.src==='Calendar')return readTitle(job.notes||'').tenancy||'';
    return '';
  }
  function forForm(formAgent,job){return agentForForm({agent:formAgent},job,{})}
  function soundDraft(raw){
    let s=String(raw==null?'':raw).replace(/[^\d.]/g,'');
    const dot=s.indexOf('.');
    if(dot>=0)s=s.slice(0,dot+1)+s.slice(dot+1).replace(/\./g,'');
    if(s.startsWith('.'))s='0'+s;
    return s;
  }
  /* A real finite reading, or blank. 97–103 is not a special band. Above 200 is not stored.
   Letters, a minus, or a range are refused whole. They are not turned into another number. */
  function soundFinal(raw){
    const s=String(raw==null?'':raw).trim();
    if(!s)return {ok:true,blank:true,value:'',message:''};
    if(!/^\d+(\.\d+)?$/.test(s))return {ok:false,blank:false,value:'',message:'Enter the measured sound level in dB, or leave it blank.'};
    const n=Number(s);
    if(!Number.isFinite(n)||n<0||n>200)return {ok:false,blank:false,value:'',message:'That is not a measured sound level. Leave the field blank if it was not measured.'};
    return {ok:true,blank:false,value:String(n),message:''};
  }
  return {print:print,stripTail:stripTail,readTitle:readTitle,readEvent:readEvent,fromEvent:fromEvent,forForm:forForm,agentForForm:agentForForm,tenancyName:tenancyName,tenancyForForm:tenancyForForm,soundDraft:soundDraft,soundFinal:soundFinal};
});
