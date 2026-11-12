/* Agency names for the worksheet, measured sound, and Australian phone numbers.
   Ray White Yamba, Ray White Maclean and Raine & Horne use RWY, RWM and R&H.
   Lifestyle is written in full. LIFE is the same agency. Anything else is kept.
   A blank sound level stays blank. No reading is invented.
   A mobile is printed 0### ### ###. A missing digit is not invented. */
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
    'life':'Lifestyle','lifestyle':'Lifestyle',
    'elders':'Elders'
  };
  /* Whole agency cell. "Ray White" alone is not enough to choose Yamba or Maclean. */
  function print(v){
    const raw=clean(v);
    if(!raw)return '';
    return CODES[key(raw)]||raw;
  }
  const TOWN='yamba|maclean|townsend|grafton|iluka|lawrence|angourie|harwood|ulmarra|gulmarrad|wooloweyah';
  const PHRASES=[
    [/[, ]+ray\s*white\s*yamba$/i,'RWY'],
    [/[, ]+ray\s*white\s*maclean$/i,'RWM'],
    [new RegExp('[, ]+raine\\s*(?:&|and)\\s*horne(?:\\s+(?:'+TOWN+'))?$','i'),'R&H'],
    [new RegExp('[, ]+r\\s*&\\s*h(?:\\s+(?:'+TOWN+'))?$','i'),'R&H'],
    [new RegExp('[, ]+r&h(?:\\s+(?:'+TOWN+'))?$','i'),'R&H'],
    [new RegExp('[, ]+(?:lifestyle|life)(?:\\s+(?:'+TOWN+'))?$','i'),'Lifestyle'],
    [new RegExp('[, ]+elders(?:\\s+(?:'+TOWN+'))?$','i'),'Elders']
  ];
  function tokenKind(token){
    const k=key(token);
    if(k==='perm'||k==='permanent')return {kind:'tenancy',value:'Permanent'};
    if(k==='hol'||k==='holiday'||k==='stra')return {kind:'tenancy',value:'Holiday'};
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
  /* A past-visit banner can carry the same trailing agency and PERM/Holiday as a title.
     "Approved STRA Upgrade" in the body is not a rental type. */
  function readBanner(description){
    const m=String(description||'').match(/---\s*LAST VISIT\s*\(([^)]*)\)/i);
    if(!m)return {agent:'',tenancy:''};
    return readTitle(m[1]);
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
    const banner=readBanner(ev.description);
    const line=agentLine(ev.description);
    return {agent:line?print(line):(title.agent||loc.agent||banner.agent||''),tenancy:title.tenancy||loc.tenancy||banner.tenancy||''};
  }
  /* A blank agent or tenancy can be filled. A different typed value is a conflict, not a silent change. */
  function visitConflicts(form,meta){
    form=form||{};meta=meta||{};
    const out=[];
    const localAgent=clean(form.agent);
    const localTen=tenancyName(form.tenancy);
    if(meta.agent&&(localAgent||form.agentSet)&&localAgent!==meta.agent)out.push({index:null,field:'agent',label:'Agent',local:localAgent,source:meta.agent});
    if(meta.tenancy&&(localTen||form.tenancySet)&&localTen!==meta.tenancy)out.push({index:null,field:'tenancy',label:'Tenancy',local:localTen,source:meta.tenancy});
    return out;
  }
  function fromEvent(ev){return readEvent(ev).agent}
  /* A typed agency stays. A blank one can take the job, then a known calendar tag. */
  function agentRaw(form,job,meta){
    form=form||{};job=job||{};meta=meta||{};
    if(form.agentSet)return clean(form.agent);
    if(clean(form.agent))return clean(form.agent);
    if(clean(job.agent))return clean(job.agent);
    if(meta.agent)return clean(meta.agent);
    if(job.src==='Calendar')return readTitle(job.notes||'').agent||'';
    return '';
  }
  function agentForForm(form,job,meta){
    return agencyFields(agentRaw(form,job,meta)).agent;
  }
  /* Tenancy is Permanent or Holiday. It is not the house, unit, or other building type. */
  function tenancyForForm(form,job,meta){
    form=form||{};job=job||{};meta=meta||{};
    if(form.tenancySet)return tenancyName(form.tenancy);
    const current=tenancyName(form.tenancy);
    if(current)return current;
    const section=tenancyName(job.section);
    if(section)return section;
    const embedded=agencyFields(form.agent).tenancy||(!form.agentSet&&agencyFields(job.agent).tenancy)||'';
    if(embedded)return embedded;
    if(meta.tenancy)return meta.tenancy;
    if(job.src==='Calendar')return readTitle(job.notes||'').tenancy||'';
    return '';
  }
  function forForm(formAgent,job){return agentForForm({agent:formAgent},job,{})}
  function shortTenancy(v){
    const name=tenancyName(v);
    if(name==='Permanent')return 'Perm';
    if(name==='Holiday')return 'Holiday';
    const k=key(v);
    if(k==='perm')return 'Perm';
    return '';
  }
  function knownAgency(v){
    const raw=clean(v);
    if(!raw)return false;
    if(print(raw)!==raw)return true;
    return !!CODES[key(raw)];
  }
  function leadStatus(raw){
    const m=clean(raw).match(/^(holiday|perm|permanent)(?:[,\s]+)(.*)$/i);
    if(!m||!clean(m[2]))return null;
    return {status:shortTenancy(m[1]),rest:clean(m[2])};
  }
  /* "RWY Holiday" and "Holiday RWY" both become the agency, then the status. */
  function splitCombined(agent){
    let raw=clean(agent),status='';
    if(!raw)return {base:'',status:''};
    const only=shortTenancy(raw);
    if(only&&/^(holiday|perm|permanent)$/.test(key(raw)))return {base:'',status:only};
    const lead=leadStatus(raw);
    if(lead&&knownAgency(lead.rest)){status=lead.status;raw=lead.rest}
    for(let n=0;n<3;n++){
      const m=raw.match(/^(.*?)(?:[,\s]+)(holiday|perm|permanent)$/i);
      if(!m||!clean(m[1]))break;
      if(!status)status=shortTenancy(m[2]);
      raw=clean(m[1]);
    }
    return {base:print(raw),status:status};
  }
  function agencyFields(raw){
    const parts=splitCombined(raw);
    return {agent:parts.base,tenancy:parts.status==='Perm'?'Permanent':parts.status==='Holiday'?'Holiday':''};
  }
  /* One Agent slot: agency first, then Perm or Holiday. A missing part is left out. */
  function agentSlot(agent,tenancy){
    const parts=splitCombined(agent);
    const ten=shortTenancy(tenancy)||parts.status;
    let base=parts.base;
    if(ten){
      const lead=leadStatus(base);
      if(lead&&lead.status===ten)base=print(lead.rest);
    }
    if(base&&ten)return base+' '+ten;
    return base||ten||'';
  }
  /* Australian mobiles keep the leading 0: 0400 111 222.
     +61 and 61 are the same number. A landline, an email, or a short number is not padded. */
  function phoneFormat(v){
    if(v==null||v==='')return '';
    if(typeof v==='number'){
      if(!Number.isSafeInteger(v))return clean(v);
      v=String(v);
    }
    let original=clean(v);
    if(!original)return '';
    if(/[a-z@]/i.test(original)&&!/^[\d.]+e\+?\d+$/i.test(original))return original;
    const sci=original.match(/^(\d+)(?:\.(\d+))?[eE]\+?(\d+)$/);
    if(sci){
      const frac=sci[2]||'';
      const shift=(+sci[3])-frac.length;
      if(shift!==0)return original;
      original=sci[1]+frac;
    }
    let body=original.replace(/[^\d+]/g,'');
    if(!body)return original;
    let fromCountry=false;
    if(body.startsWith('+61')){body=body.slice(3);fromCountry=true}
    else if(body.startsWith('61')&&body.length>=11&&body.length<=12){body=body.slice(2);fromCountry=true}
    if(fromCountry&&/^[2378]\d{8}$/.test(body))body='0'+body;
    if(/^4\d{8}$/.test(body))body='0'+body;
    if(/^04\d{8}$/.test(body))return body.slice(0,4)+' '+body.slice(4,7)+' '+body.slice(7);
    if(/^0[2378]\d{8}$/.test(body))return body.slice(0,2)+' '+body.slice(2,6)+' '+body.slice(6);
    if(/^1[38]00\d{6}$/.test(body))return body.slice(0,4)+' '+body.slice(4,7)+' '+body.slice(7);
    if(/^\d{8}$/.test(body)&&!fromCountry)return body.slice(0,4)+' '+body.slice(4);
    return original;
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
  return {print:print,stripTail:stripTail,readTitle:readTitle,readEvent:readEvent,visitConflicts:visitConflicts,fromEvent:fromEvent,forForm:forForm,agentForForm:agentForForm,tenancyName:tenancyName,tenancyForForm:tenancyForForm,agentSlot:agentSlot,agencyFields:agencyFields,phoneFormat:phoneFormat,soundDraft:soundDraft,soundFinal:soundFinal};
});
