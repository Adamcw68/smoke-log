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
  const SUFFIX=[
    [/\s+ray\s*white\s*yamba$/i,'RWY'],
    [/\s+ray\s*white\s*maclean$/i,'RWM'],
    [/\s+raine\s*(?:&|and)\s*horne$/i,'R&H'],
    [/\s+r\s*&\s*h$/i,'R&H'],
    [/\s+lifestyle$/i,'LIFE'],
    [/\s+rwy$/i,'RWY'],
    [/\s+rwm$/i,'RWM'],
    [/\s+r&h$/i,'R&H'],
    [/\s+life$/i,'LIFE']
  ];
  /* Drop a trailing agency tag and Perm/Holiday tags. The street is left as it was. */
  function stripTail(summary){
    let s=clean(summary),code='';
    for(let n=0;n<6&&s;n++){
      const st=s.replace(/\s+(?:perm|permanent|holiday|hol)$/i,'');
      if(st!==s){s=st.trim();continue}
      let hit=false;
      for(let i=0;i<SUFFIX.length;i++){
        if(SUFFIX[i][0].test(s)){if(!code)code=SUFFIX[i][1];s=s.replace(SUFFIX[i][0],'').trim();hit=true;break}
      }
      if(!hit)break;
    }
    return {code:code,text:s};
  }
  function agentLine(description){
    const m=String(description||'').match(/^agent\s*:\s*(.+)$/im);
    return m?clean(m[1]):'';
  }
  /* An Agent: line wins, including an unknown name. A title tag is used only when that line is absent. */
  function fromEvent(ev){
    ev=ev||{};
    const line=agentLine(ev.description);
    if(line)return print(line);
    return stripTail(ev.summary||'').code||stripTail(ev.location||'').code||'';
  }
  /* Form text wins. A blank form uses the job, then a calendar title tag. */
  function forForm(formAgent,job){
    const current=clean(formAgent);
    if(current)return print(current);
    job=job||{};
    if(clean(job.agent))return print(job.agent);
    if(job.src==='Calendar')return stripTail(job.notes||'').code||'';
    return '';
  }
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
  return {print:print,stripTail:stripTail,fromEvent:fromEvent,forForm:forForm,soundDraft:soundDraft,soundFinal:soundFinal};
});
