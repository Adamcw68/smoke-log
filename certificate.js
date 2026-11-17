/* Compliance certificate PDF for one published visit.
   The bytes are built from the portal certificate record only.
   The worksheet PDF is a different file and can contain phone numbers, so it is not reused. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSACertificate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const PAGE_W=595.28;
  const PAGE_H=841.89;
  const ACCENT=[0.05,0.42,0.38];
  const RED=[0.94,0.18,0.20];
  const INK=[0.224,0.208,0.212];
  const MUTED=[0.373,0.357,0.361];
  const LINE=[0.788,0.776,0.776];
  const OK=[0.106,0.498,0.227];
  const BAD=[0.710,0.086,0.110];
  const PAPER=[0.965,0.961,0.961];
  const WHITE=[1,1,1];
  const LOGO_W=192;
  const LOGO_H=192;
  const LOGO_FLATE='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';

  function dataApi(){
    if(typeof CCSAPortalData!=='undefined')return CCSAPortalData;
    if(typeof require==='function'){
      try{return require('./portaldata.js')}catch(e){return null}
    }
    return null;
  }
  function ascii(v){
    return String(v==null?'':v).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,' ');
  }
  function esc(v){
    return ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  }
  function num(n){return (Math.round(n*100)/100).toFixed(2)}
  function rgb(c){return num(c[0])+' '+num(c[1])+' '+num(c[2])}
  function widthOf(text,size,bold){
    return ascii(text).length*size*(bold?0.56:0.52);
  }
  function wrap(text,size,maxW,bold){
    const words=ascii(text).split(/\s+/).filter(Boolean);
    const lines=[];
    let cur='';
    words.forEach(function(word){
      const next=cur?cur+' '+word:word;
      if(widthOf(next,size,bold)<=maxW)cur=next;
      else{
        if(cur)lines.push(cur);
        cur=word;
      }
    });
    if(cur)lines.push(cur);
    return lines.length?lines:[''];
  }
  function looksContact(s){
    const text=String(s||'');
    if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text))return true;
    if(/(?:\+?61|0)[ \-]*[2-478](?:[ \-]*\d){8}\b/.test(text))return true;
    return false;
  }
  function safeLine(v){
    const s=ascii(v).replace(/\s+/g,' ').trim();
    if(!s||looksContact(s))return '';
    return s;
  }
  function dmy(value){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||'').slice(0,10));
    if(!m)return '';
    return m[3]+'/'+m[2]+'/'+m[1];
  }
  function validUntilDate(iso,compliant){
    if(!compliant)return '';
    const data=dataApi();
    const next=data&&data.addMonths?data.addMonths(String(iso||'').slice(0,10),12):'';
    return dmy(next);
  }
  function party(code){
    const data=dataApi();
    const found=data&&data.agencyFromCode?data.agencyFromCode(code):null;
    if(found&&found.privateOwner)return {privateOwner:true,agency:''};
    if(found&&found.name)return {privateOwner:false,agency:found.name};
    return {privateOwner:false,agency:safeLine(code)};
  }
  function reportLocation(location){
    return safeLine(String(location||'').replace(/^(Ceiling|Wall),\s*/i,''));
  }
  function productDescription(alarm){
    const power=String(alarm&&alarm.power||'').toLowerCase();
    const type=String(alarm&&alarm.type||'');
    const sensor=/photo/i.test(type)?'Photoelectric':/ion/i.test(type)?'Ionisation':/heat/i.test(type)?'Heat':(safeLine(type)||'Smoke');
    const hardwired=/240/.test(power);
    const nine=/9v/.test(power);
    const lith=/lithium/.test(power);
    if(hardwired&&lith)return '240V Lithium '+sensor+' Alarm';
    if(lith)return 'Lithium Battery '+sensor+' Alarm';
    if(hardwired)return '240V '+sensor+' Alarm';
    if(nine)return '9V '+sensor+' Alarm';
    return sensor+' Alarm';
  }
  function actionFor(result){
    const r=String(result||'').toLowerCase();
    if(r==='replace')return 'Replaced';
    if(r==='fail')return 'Failed';
    if(r==='incomplete')return 'Incomplete';
    return 'Serviced';
  }
  const LAWS=[
    'Building Legislation Amendment (Smoke Alarms) Act 2005 No 57',
    'Section 146A of the Environmental Planning and Assessment Act 1979',
    'Australian Standard 3786',
    'Section 3.7.2.2 (houses) / Part E2, Spec 2.2a 3(c)(i) (units) of the Building Code of Australia'
  ];
  const LEGEND='240V: mains-powered (hard-wired), battery can be changed. 9V: battery only, battery can be changed. 240V lithium: mains-powered (hard-wired), sealed battery. Lithium: battery only, sealed battery.';
  function viewModel(cert,mode){
    cert=cert||{};
    const compliance=mode==='compliance';
    const who=party(cert.agencyCode);
    const owner=safeLine(cert.owner||cert.ownerName||'');
    let attention='';
    if(who.privateOwner)attention=owner?'Attention: '+owner:'Attention: The owner';
    else if(owner&&who.agency)attention='Attention: '+owner+' c/- '+who.agency;
    else if(who.agency)attention='c/- '+who.agency;
    else if(owner)attention='Attention: '+owner;
    const postal=[];
    String(cert.postal||'').split(/\n/).forEach(function(line){
      const clean=safeLine(line);
      if(clean)postal.push(clean);
    });
    const alarms=(cert.alarms||[]).map(function(a){
      return {
        n:a.n,
        product:productDescription(a),
        location:reportLocation(a.location),
        expiry:a.expiry||'',
        action:actionFor(a.result),
        reason:'Annual Maintenance'
      };
    });
    return {
      title:compliance?'COMPLIANCE CERTIFICATE':'SERVICE REPORT',
      brand:'Clarence Coast Smoke Alarms',
      phone:'0412 092 233',
      attention:attention,
      postal:postal,
      reportDate:dmy(cert.date),
      validUntil:validUntilDate(cert.date,!(cert.alarms||[]).some(function(a){return String(a&&a.result||'').toLowerCase()==='fail'})),
      serviceAddress:safeLine(cert.address),
      jobNumber:safeLine(cert.ident||''),
      serviceReason:'Subscription Service',
      inspector:compliance?'':safeLine(cert.tech),
      hideInspector:compliance,
      lastInspection:dmy(cert.lastInspection),
      compliant:!alarms.some(function(a){return a.action==='Failed'}),
      complianceLead:'Clarence Coast Smoke Alarms fitted or checked every alarm in the table below. This visit was recorded against:',
      failLead:'Clarence Coast Smoke Alarms inspected the alarms below. A row marked Failed did not pass the checks recorded on this visit.',
      laws:LAWS.slice(),
      batteryNote:'Where an alarm uses a battery that can be changed, a new battery was fitted on this visit.',
      alarms:alarms,
      legend:LEGEND,
      footer:'Tenant names, phone numbers and email addresses are not on this report.'
    };
  }
  function fileName(cert){
    const day=(cert&&cert.date)||'undated';
    const street=String((cert&&cert.address)||'property').split(',')[0].replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return 'CCSA-'+day+'-'+(street||'property')+'.pdf';
  }
  function Doc(){
    this.ops=[];
    this.pages=[];
    this.top=0;
  }
  Doc.prototype.breakPage=function(){
    if(this.ops.length)this.pages.push(this.ops.join(''));
    this.ops=[];
    this.top=0;
  };
  Doc.prototype.need=function(h){
    if(this.top+h>PAGE_H-52){
      this.breakPage();
      this.header(true);
    }
  };
  Doc.prototype.cmd=function(s){this.ops.push(s)};
  Doc.prototype.rect=function(x,fromTop,w,h,color){
    const y=PAGE_H-fromTop-h;
    this.cmd(rgb(color)+' rg\n'+num(x)+' '+num(y)+' '+num(w)+' '+num(h)+' re f\n');
  };
  Doc.prototype.text=function(font,size,x,fromTop,str,color,tracking){
    const y=PAGE_H-fromTop-size;
    this.cmd(rgb(color)+' rg\nBT\n/'+font+' '+size+' Tf\n'+num(tracking||0)+' Tc\n1 0 0 1 '+num(x)+' '+num(y)+' Tm\n('+esc(str)+') Tj\nET\n');
  };
  Doc.prototype.roundPath=function(x,fromTop,w,h,r){
    const y=PAGE_H-fromTop-h;
    const x0=x,y0=y,x1=x+w,y1=y+h;
    const k=r*0.5523;
    const c=function(x1,y1,x2,y2,x3,y3){return num(x1)+' '+num(y1)+' '+num(x2)+' '+num(y2)+' '+num(x3)+' '+num(y3)+' c\n'};
    this.cmd(num(x0+r)+' '+num(y0)+' m\n'
      +num(x1-r)+' '+num(y0)+' l\n'
      +c(x1-r+k,y0,x1,y0+r-k,x1,y0+r)
      +num(x1)+' '+num(y1-r)+' l\n'
      +c(x1,y1-r+k,x1-r+k,y1,x1-r,y1)
      +num(x0+r)+' '+num(y1)+' l\n'
      +c(x0+r-k,y1,x0,y1-r+k,x0,y1-r)
      +num(x0)+' '+num(y0+r)+' l\n'
      +c(x0,y0+r-k,x0+r-k,y0,x0+r,y0)
      +'h\n');
  };
  Doc.prototype.logo=function(x,fromTop,size){
    this.rect(x,fromTop,size,size,WHITE);
    const inset=3.2;
    const y=PAGE_H-(fromTop+inset)-(size-inset*2);
    this.cmd('q\n'+num(size-inset*2)+' 0 0 '+num(size-inset*2)+' '+num(x+inset)+' '+num(y)+' cm\n/Im1 Do\nQ\n');
    this.roundPath(x,fromTop,size,size,6);
    this.cmd(rgb(RED)+' RG\n2.2 w\n1 J 1 j\nS\n');
  };
  Doc.prototype.checkBox=function(x,fromTop){
    const s=12;
    const y=PAGE_H-fromTop-s;
    this.roundPath(x,fromTop,s,s,2);
    this.cmd(rgb(RED)+' rg\nf\n');
    this.cmd('1 1 1 RG\n1.6 w\n1 J 1 j\n'+num(x+2.3)+' '+num(y+5.4)+' m\n'+num(x+4.8)+' '+num(y+2.7)+' l\n'+num(x+9.7)+' '+num(y+8.8)+' l\nS\n');
  };
  Doc.prototype.bullet=function(x,fromTop){
    const cy=PAGE_H-fromTop-4.4;
    const r=2.7;
    const k=r*0.5523;
    const c=function(x1,y1,x2,y2,x3,y3){return num(x1)+' '+num(y1)+' '+num(x2)+' '+num(y2)+' '+num(x3)+' '+num(y3)+' c\n'};
    this.cmd(rgb(INK)+' rg\n'+num(x)+' '+num(cy+r)+' m\n'
      +c(x+k,cy+r,x+r,cy+k,x+r,cy)
      +c(x+r,cy-k,x+k,cy-r,x,cy-r)
      +c(x-k,cy-r,x-r,cy-k,x-r,cy)
      +c(x-r,cy+k,x-k,cy+r,x,cy+r)
      +'f\n');
  };
  Doc.prototype.header=function(continued,kicker){
    this.logo(36,14,46);
    this.text('F1',8,92,16,kicker||'SERVICE REPORT',MUTED,0.7);
    this.text('F2',13,92,30,'Clarence Coast Smoke Alarms',INK);
    this.text('F1',8,92,48,'0412 092 233',MUTED);
    const ruleY=PAGE_H-68;
    this.cmd(rgb(RED)+' RG\n2.2 w\n36 '+num(ruleY)+' m '+num(PAGE_W-36)+' '+num(ruleY)+' l S\n');
    if(continued)this.text('F1',8,470,16,'continued',MUTED);
    this.top=82;
  };
  Doc.prototype.finish=function(){
    if(this.ops.length)this.pages.push(this.ops.join(''));
    this.ops=[];
    return this.pages;
  };

  function drawCertificate(cert,mode){
    const view=viewModel(cert,mode);
    const doc=new Doc();
    doc.header(false,view.title);
    const dateY=doc.top;
    doc.text('F1',9,360,dateY,'Report Date: '+(view.reportDate||''),INK);
    if(view.validUntil)doc.text('F1',9,360,dateY+12,'Valid until: '+view.validUntil,INK);
    wrap(view.attention,9,300,false).forEach(function(line){
      doc.text('F1',9,36,doc.top,line,INK);
      doc.top+=12;
    });
    view.postal.forEach(function(line){
      doc.text('F1',9,36,doc.top,line,INK);
      doc.top+=12;
    });
    doc.top=Math.max(doc.top,dateY+(view.validUntil?26:14))+12;
    const detailY=doc.top;
    doc.text('F2',9,36,detailY,'SERVICE DETAILS',INK);
    doc.cmd(rgb(INK)+' RG\n0.6 w\n36 '+num(PAGE_H-detailY-11)+' m 118 '+num(PAGE_H-detailY-11)+' l S\n');
    const addrX=36+widthOf('SERVICE DETAILS',9,true)+8;
    const addrLines=wrap(view.serviceAddress,10,300-(addrX-36),true);
    addrLines.forEach(function(line,i){
      doc.text('F2',10,addrX,detailY+i*13,line,INK);
    });
    const side=[
      ['Job Number',view.jobNumber],
      ['Service Reason',view.serviceReason]
    ];
    if(view.validUntil)side.push(['Valid until',view.validUntil]);
    if(!view.hideInspector)side.push(['Inspected by',view.inspector]);
    side.push(['Last Inspection Date',view.lastInspection]);
    let sy=detailY;
    side.forEach(function(pair){
      doc.text('F1',8,380,sy,pair[0],MUTED);
      if(pair[1])doc.text('F2',9,380,sy+11,pair[1],INK);
      sy+=24;
    });
    doc.top=detailY+Math.max(addrLines.length,1)*13+12;
    if(view.compliant)doc.checkBox(36,doc.top);
    const lead=view.compliant?view.complianceLead:view.failLead;
    wrap(lead,8.5,330,false).forEach(function(line){
      doc.text('F1',8.5,54,doc.top,line,INK);
      doc.top+=11;
    });
    doc.top+=2;
    view.laws.forEach(function(law){
      const lines=wrap(law,8,320,false);
      doc.bullet(40,doc.top);
      lines.forEach(function(line){
        doc.text('F1',8,54,doc.top,line,INK);
        doc.top+=11;
      });
      doc.top+=3;
    });
    doc.top+=6;
    wrap(view.batteryNote,8,500,false).forEach(function(line){
      doc.text('F1',8,36,doc.top,line,INK);
      doc.top+=10;
    });
    doc.top+=8;
    const cols=[
      {label:'Product Description',x:36,w:190},
      {label:'Location',x:210,w:90},
      {label:'Expiry Date',x:300,w:70},
      {label:'Action',x:375,w:70},
      {label:'Reason',x:450,w:110}
    ];
    function tableHead(){
      doc.need(16);
      cols.forEach(function(col){doc.text('F2',7.5,col.x,doc.top,col.label,INK)});
      doc.cmd(rgb(RED)+' RG\n1.2 w\n36 '+num(PAGE_H-doc.top-11)+' m '+num(PAGE_W-36)+' '+num(PAGE_H-doc.top-11)+' l S\n');
      doc.top+=16;
    }
    tableHead();
    if(!view.alarms.length){
      doc.text('F1',8,36,doc.top,'No alarms were recorded on this report.',MUTED);
      doc.top+=12;
    }
    view.alarms.forEach(function(alarm){
      const product=wrap(alarm.product,8,180,false);
      const loc=wrap(alarm.location||'',8,84,false);
      const lines=Math.max(product.length,loc.length,1);
      const h=lines*10+4;
      if(doc.top+h>PAGE_H-70){
        doc.breakPage();
        doc.header(true);
        tableHead();
      }
      product.forEach(function(line,i){doc.text('F1',8,cols[0].x,doc.top+i*10,line,INK)});
      loc.forEach(function(line,i){doc.text('F1',8,cols[1].x,doc.top+i*10,line,INK)});
      doc.text('F1',8,cols[2].x,doc.top,alarm.expiry||'',INK);
      doc.text('F1',8,cols[3].x,doc.top,alarm.action,INK);
      doc.text('F1',8,cols[4].x,doc.top,alarm.reason,INK);
      doc.top+=h;
    });
    doc.top+=10;
    wrap(view.legend,7,PAGE_W-72,false).forEach(function(line){
      doc.need(10);
      doc.text('F1',7,36,doc.top,line,MUTED);
      doc.top+=9;
    });
    doc.top+=8;
    doc.need(12);
    doc.text('F1',7,36,doc.top,view.footer,MUTED);
    return doc.finish();
  }
  function b64bytes(s){
    const bin=atob(s);
    const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i)&255;
    return out;
  }
  function logoStream(){
    if(logoStream.cache)return logoStream.cache;
    const bytes=b64bytes(LOGO_FLATE);
    let s='';
    for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
    logoStream.cache=s;
    return s;
  }
  function buildPdf(pages){
    const n=pages.length||1;
    const contents=pages.length?pages:['BT\n/F1 12 Tf\n36 800 Td\n(Empty certificate) Tj\nET\n'];
    const objs=[];
    objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
    const kids=[];
    for(let i=0;i<n;i++)kids.push((6+i*2)+' 0 R');
    objs[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+n+' >>';
    objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    const logo=logoStream();
    objs[5]={stream:logo,dict:'<< /Type /XObject /Subtype /Image /Width '+LOGO_W+' /Height '+LOGO_H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length '+logo.length+' >>'};
    contents.forEach(function(stream,i){
      const pageNum=6+i*2;
      const contentNum=pageNum+1;
      objs[pageNum]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents '+contentNum+' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> >>';
      objs[contentNum]={stream:stream};
    });
    let body='%PDF-1.4\n';
    const offsets=[0];
    for(let i=1;i<objs.length;i++){
      if(objs[i]==null)continue;
      offsets[i]=body.length;
      if(objs[i].stream!=null){
        const stream=objs[i].stream;
        const dict=objs[i].dict||('<< /Length '+stream.length+' >>');
        body+=i+' 0 obj '+dict+' stream\n'+stream+'endstream\nendobj\n';
      }else body+=i+' 0 obj '+objs[i]+' endobj\n';
    }
    const xrefAt=body.length;
    const size=offsets.length;
    let xref='xref\n0 '+size+'\n';
    xref+='0000000000 65535 f \n';
    for(let i=1;i<size;i++)xref+=String(offsets[i]||0).padStart(10,'0')+' 00000 n \n';
    body+=xref+'trailer << /Size '+size+' /Root 1 0 R >>\nstartxref\n'+xrefAt+'\n%%EOF\n';
    const out=new Uint8Array(body.length);
    for(let i=0;i<body.length;i++)out[i]=body.charCodeAt(i)&255;
    return out;
  }
  function buildCertificatePdf(cert){
    return buildPdf(drawCertificate(cert||{}));
  }
  function complianceModel(cert,extra){
    extra=extra||{};
    const report=viewModel(cert||{});
    const due=report.compliant?report.validUntil:'';
    const ok=!!(report.compliant&&due);
    return {
      title:'COMPLIANCE CERTIFICATE',
      brand:'Clarence Coast Smoke Alarms',
      phone:report.phone,
      attention:report.attention,
      address:report.serviceAddress,
      statement:ok?report.complianceLead:report.failLead,
      validUntil:ok?due:'',
      validLabel:ok?'Valid until':'',
      date:report.reportDate,
      alarms:report.alarms.map(function(a){return {product:a.product,location:a.location}}),
      footer:report.footer
    };
  }
  function drawCompliance(cert){
    return drawCertificate(cert,'compliance');
  }
  function buildCompliancePdf(cert,extra){
    return buildPdf(drawCompliance(cert||{},extra||{}));
  }
  function complianceFileName(cert){
    return 'CCSA-compliance-'+fileName(cert||{});
  }
  function isoDate(value){
    const s=String(value||'').slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
  }
  function jobDay(job,form){
    const service=isoDate(form&&form.date);
    if(service)return service;
    return isoDate(job&&job.svc);
  }
  function jobFinished(job,form){
    return !!(form&&(form.done||(job&&job.arch)));
  }
  function routeKey(job){
    job=job||{};
    const when=job.svc?Date.parse(job.svc):NaN;
    if(!isNaN(when))return '0|'+String(when).padStart(14,'0')+'|'+String(job.row||0).padStart(5,'0')+'|'+String(job.addr||'');
    const order=job.order!=null?String(job.order).padStart(5,'0'):'z';
    return '1|'+order+'|'+String(job.row||0).padStart(5,'0')+'|'+String(job.addr||'');
  }
  function agencyMatch(job,form,agencyId){
    if(!agencyId)return true;
    const data=dataApi();
    const code=(form&&form.agent)||(job&&job.agent)||'';
    const found=data&&data.agencyFromCode?data.agencyFromCode(code):null;
    if(agencyId==='private')return !!(found&&found.privateOwner);
    return !!(found&&(found.id===agencyId||found.code===agencyId));
  }
  function dayFileName(date){
    const day=isoDate(date)||'undated';
    return {worksheetFile:'CCSA-worksheets-'+day+'.pdf',certificateFile:'CCSA-certificates-'+day+'.pdf'};
  }
  function expiryLabel(value){
    const s=String(value||'').trim();
    const my=/^(\d{1,2})\/(\d{4})$/.exec(s);
    if(my)return String(my[1]).padStart(2,'0')+'/'+my[2];
    return safeLine(s);
  }
  const FORM_INK=[0,0,0];
  const FORM_LEFT=30;
  const FORM_RIGHT=PAGE_W-30;
  const FORM_LIMIT=776;
  const FORM_ABN='7063 0700 875';
  Doc.prototype.rule=function(x,fromTop,w){
    const y=PAGE_H-fromTop;
    this.cmd(rgb(FORM_INK)+' RG\n0.6 w\n'+num(x)+' '+num(y)+' m '+num(x+w)+' '+num(y)+' l S\n');
  };
  Doc.prototype.frame=function(x,fromTop,w,h){
    const y=PAGE_H-fromTop-h;
    this.cmd(rgb(FORM_INK)+' RG\n0.8 w\n'+num(x)+' '+num(y)+' '+num(w)+' '+num(h)+' re S\n');
  };
  Doc.prototype.tick=function(x,fromTop,s){
    const y=PAGE_H-fromTop-s;
    this.cmd(rgb(FORM_INK)+' RG\n0.7 w\n'+num(x)+' '+num(y)+' '+num(s)+' '+num(s)+' re S\n');
  };
  Doc.prototype.ring=function(x,fromTop,w,h,tag){
    const name=ascii(tag||'').replace(/[^A-Za-z0-9]+/g,'');
    if(name)this.cmd('% circle:'+name+'\n');
    const rx=w/2,ry=h/2,cx=x+rx,cy=PAGE_H-fromTop-ry,k=0.5522847498;
    const c=function(x1,y1,x2,y2,x3,y3){return num(x1)+' '+num(y1)+' '+num(x2)+' '+num(y2)+' '+num(x3)+' '+num(y3)+' c\n'};
    this.cmd(rgb(FORM_INK)+' RG\n0.9 w\n'+num(cx)+' '+num(cy+ry)+' m\n'
      +c(cx+k*rx,cy+ry,cx+rx,cy+k*ry,cx+rx,cy)
      +c(cx+rx,cy-k*ry,cx+k*rx,cy-ry,cx,cy-ry)
      +c(cx-k*rx,cy-ry,cx-rx,cy-k*ry,cx-rx,cy)
      +c(cx-rx,cy+k*ry,cx-k*rx,cy+ry,cx,cy+ry)
      +'S\n');
  };
  function formLogo(doc,x,fromTop,size){
    const inset=1;
    const y=PAGE_H-(fromTop+inset)-(size-inset*2);
    doc.cmd('q\n'+num(size-inset*2)+' 0 0 '+num(size-inset*2)+' '+num(x+inset)+' '+num(y)+' cm\n/Im1 Do\nQ\n');
  }
  function chosenPower(power){
    const on={};
    (Array.isArray(power)?power:String(power||'').split(/[,/]/)).forEach(function(raw){
      const s=String(raw||'').trim();
      if(!s)return;
      if(/^(hw|hard\s*wired|hardwired|mains)$/i.test(s)||/^240/i.test(s))on['240v']=true;
      else if(/^9/i.test(s))on['9v']=true;
      else if(/ni/i.test(s))on['Ni-Mh']=true;
      else if(/lith/i.test(s))on.Lithium=true;
    });
    return on;
  }
  function chosenSensor(sensor){
    const on={};
    (Array.isArray(sensor)?sensor:String(sensor||'').split(/[,/]/)).forEach(function(raw){
      const s=String(raw||'').trim();
      if(/ion/i.test(s))on.Ionization=true;
      else if(/photo/i.test(s))on['Photo-Electric']=true;
      else if(/heat/i.test(s))on.Heat=true;
    });
    return on;
  }
  function ynAnswer(alarm,key){
    alarm=alarm||{};
    if(key==='battery'&&[].concat(alarm.power||[]).some(function(p){return /lith/i.test(String(p))}))return 'No';
    if(key==='cleaned'&&(alarm.isNew||alarm.newAns==='Yes'))return '';
    const v=alarm.yn&&alarm.yn[key];
    return v==='Yes'||v==='No'?v:'';
  }
  function flowWords(doc,x,y,items,size){
    let cx=x,cy=y;
    items.forEach(function(item){
      const text=item.text;
      const w=widthOf(text,size,!!item.bold);
      const fill=item.fill?widthOf(item.fill,size,true)+6:0;
      const blank=item.blank?40:0;
      const need=w+fill+blank+8;
      if(cx>x&&cx+need>FORM_RIGHT){cx=x;cy+=13}
      doc.text(item.bold?'F2':'F1',size,cx,cy,text,FORM_INK);
      if(item.on)doc.ring(cx-2,cy-2,w+4,size+5,item.tag||text);
      cx+=w+2;
      if(item.fill){
        doc.text('F2',size,cx+2,cy,item.fill,FORM_INK);
        doc.rule(cx,cy+size+1,Math.max(widthOf(item.fill,size,true)+4,36));
        cx+=Math.max(widthOf(item.fill,size,true)+4,36)+4;
      }else if(item.blank){
        doc.rule(cx,cy+size+1,36);
        cx+=40;
      }
      cx+=6;
    });
    return cy+size+6;
  }
  function ynCell(doc,x,y,label,answer,tag){
    doc.text('F1',7.5,x,y,label,FORM_INK);
    const yesX=x+168,noX=yesX+28;
    doc.text('F1',7.5,yesX,y,'Yes',FORM_INK);
    doc.text('F1',7.5,noX,y,'No',FORM_INK);
    if(answer==='Yes')doc.ring(yesX-2,y-2,18,11,tag+'Yes');
    if(answer==='No')doc.ring(noX-2,y-2,16,11,tag+'No');
  }
  function formFooter(doc){
    doc.text('F1',7,FORM_LEFT,790,'*1 Australian Standards AS3786 - 1993',FORM_INK);
    wrap('*2 According to the Section 186A of the Environmental Planning and Assessment (Smoke Alarm) Regulation 2006 and Building Code of Australia',7,FORM_RIGHT-FORM_LEFT,false).forEach(function(line,i){
      doc.text('F1',7,FORM_LEFT,802+i*9,line,FORM_INK);
    });
  }
  function formBanner(doc,view,continued){
    let y=16;
    if(!continued){
      formLogo(doc,FORM_LEFT,y,30);
      doc.text('F2',12,FORM_LEFT+36,y+2,'Clarence Coast Smoke Alarms',FORM_INK);
      doc.text('F1',7,FORM_LEFT+36,y+16,'ABN '+(view.abn||FORM_ABN),FORM_INK);
      const boxX=392,boxW=FORM_RIGHT-boxX,boxH=78;
      doc.frame(boxX,y,boxW,boxH);
      doc.text('F2',8,boxX+6,y+4,'Office Use Only',FORM_INK);
      ['Initial Compliance','Certificate','Invoice','Database'].forEach(function(label,i){
        const row=y+18+i*14;
        doc.text('F1',7.5,boxX+6,row,label,FORM_INK);
        doc.tick(boxX+boxW-16,row,8);
      });
      y=102;
      const title='Smoke Alarm Testing & Maintenance Log';
      doc.text('F2',12,(PAGE_W-widthOf(title,12,true))/2,y,title,FORM_INK);
      y+=20;
      doc.text('F2',8,FORM_LEFT,y,'Property Identifier',FORM_INK);
      doc.text('F1',8,FORM_LEFT+92,y,view.ident,FORM_INK);
      doc.rule(FORM_LEFT+90,y+10,150);
      doc.text('F2',8,300,y,'Agent',FORM_INK);
      doc.text('F1',8,336,y,view.agent,FORM_INK);
      doc.rule(334,y+10,FORM_RIGHT-334);
      y+=16;
      doc.text('F2',8,FORM_LEFT,y,'Property Address',FORM_INK);
      doc.text('F1',8,FORM_LEFT+88,y,view.address,FORM_INK);
      doc.rule(FORM_LEFT+86,y+10,FORM_RIGHT-FORM_LEFT-86);
      y+=16;
      doc.text('F2',8,FORM_LEFT,y,'Technicians Name',FORM_INK);
      doc.text('F1',8,FORM_LEFT+88,y,view.tech,FORM_INK);
      doc.rule(FORM_LEFT+86,y+10,170);
      doc.text('F2',8,310,y,'Date of Service:',FORM_INK);
      doc.text('F1',8,392,y,view.date,FORM_INK);
      doc.rule(390,y+10,70);
      y+=18;
      doc.text('F2',8,FORM_LEFT,y,'Property Type:',FORM_INK);
      y=flowWords(doc,FORM_LEFT+78,y,[
        {text:'House',on:view.ptype==='House',tag:'House'},
        {text:'Unit',on:view.ptype==='Unit',tag:'Unit'},
        {text:'Townhouse',on:view.ptype==='Townhouse',tag:'Townhouse'},
        {text:'Duplex',on:view.ptype==='Duplex',tag:'Duplex'},
        {text:'Villa',on:view.ptype==='Villa',tag:'Villa'},
        {text:'Other',on:view.ptype==='Other',tag:'Other',fill:view.ptype==='Other'?view.ptypeOther:''}
      ],8);
      doc.text('F2',8,FORM_LEFT,y,'No. of Levels',FORM_INK);
      let x=FORM_LEFT+72;
      [1,2,3].forEach(function(n){
        const label=String(n);
        doc.text('F1',8,x,y,label,FORM_INK);
        if(String(view.levels)===label)doc.ring(x-2,y-2,12,12,'L'+label);
        x+=16;
      });
      doc.text('F2',8,x+8,y,'No. of Bedrooms',FORM_INK);
      x+=98;
      [1,2,3,4,5].forEach(function(n){
        const label=String(n);
        doc.text('F1',8,x,y,label,FORM_INK);
        if(String(view.beds)===label)doc.ring(x-2,y-2,12,12,'B'+label);
        x+=16;
      });
      y+=16;
      doc.text('F2',8,FORM_LEFT,y,'No. of Smoke Alarms',FORM_INK);
      x=FORM_LEFT+108;
      const count=+view.alarms||0;
      [1,2,3,4].forEach(function(n){
        const label=String(n);
        doc.text('F1',8,x,y,label,FORM_INK);
        if(count===n)doc.ring(x-2,y-2,12,12,'A'+label);
        x+=16;
      });
      if(count>4){
        doc.text('F2',9,x+4,y,String(count),FORM_INK);
        x+=22;
      }
      doc.text('F2',8,x+10,y,'Ladder Required',FORM_INK);
      x+=100;
      ['Sm','Med','Lg','XL'].forEach(function(label){
        const w=widthOf(label,8,false);
        doc.text('F1',8,x,y,label,FORM_INK);
        if(view.ladder===label)doc.ring(x-2,y-2,w+4,12,'Ladder'+label);
        x+=w+8;
      });
      y+=16;
      const rowH=16;
      doc.frame(FORM_LEFT,y,FORM_RIGHT-FORM_LEFT,rowH);
      doc.text('F2',8,FORM_LEFT+4,y+3,'Smoke Alarm Locations',FORM_INK);
      doc.cmd(rgb(FORM_INK)+' RG\n0.6 w\n220 '+num(PAGE_H-y)+' m 220 '+num(PAGE_H-y-rowH)+' l S\n');
      doc.cmd(rgb(FORM_INK)+' RG\n0.6 w\n390 '+num(PAGE_H-y)+' m 390 '+num(PAGE_H-y-rowH)+' l S\n');
      doc.text('F1',7.5,226,y+4,'As Per Previous',FORM_INK);
      if(view.asPrev)doc.ring(224,y+2,72,12,'AsPerPrevious');
      doc.text('F1',7.5,396,y+4,'As Per Photos',FORM_INK);
      if(view.asPhotos)doc.ring(394,y+2,64,12,'AsPerPhotos');
      return y+rowH+8;
    }
    doc.text('F2',9,FORM_LEFT,y,'Smoke Alarm Testing & Maintenance Log',FORM_INK);
    doc.text('F1',8,FORM_LEFT,y+14,view.address,FORM_INK);
    return y+30;
  }
  function drawAlarmBlock(doc,alarm,n,y){
    const h=148;
    doc.frame(FORM_LEFT,y,FORM_RIGHT-FORM_LEFT,h);
    const title='Smoke Alarm # '+n+(alarm.isNew||alarm.newAns==='Yes'?'  NEW':'');
    doc.text('F2',10,FORM_LEFT+6,y+4,title,FORM_INK);
    doc.text('F1',7,FORM_LEFT+6,y+16,'Please circle correct answer or provide details',FORM_INK);
    let row=flowWords(doc,FORM_LEFT+6,y+28,[
      {text:'Location:',bold:true},
      {text:'Ceiling',on:alarm.mount==='Ceiling',tag:'Ceiling'},
      {text:'Wall',on:alarm.mount==='Wall',tag:'Wall'},
      {text:'Hallway',on:alarm.room==='Hallway',tag:'Hallway'},
      {text:'Entryway',on:alarm.room==='Entryway',tag:'Entryway'},
      {text:'Bedroom No.',on:alarm.room==='Bedroom',tag:'Bedroom',fill:alarm.room==='Bedroom'?safeLine(alarm.bedno):'',blank:alarm.room!=='Bedroom'},
      {text:'Lounge',on:alarm.room==='Lounge',tag:'Lounge'},
      {text:'Dining',on:alarm.room==='Dining',tag:'Dining'},
      {text:'Laundry',on:alarm.room==='Laundry',tag:'Laundry'},
      {text:'Other:',on:alarm.room==='Other',tag:'OtherRoom',fill:alarm.room==='Other'?safeLine(alarm.other):'',blank:alarm.room!=='Other'}
    ],7.5);
    doc.text('F2',7.5,FORM_LEFT+6,row,'Adjacent:',FORM_INK);
    doc.text('F1',7.5,FORM_LEFT+52,row,safeLine(alarm.adjacent),FORM_INK);
    doc.rule(FORM_LEFT+50,row+9,180);
    row+=14;
    const powers=chosenPower(alarm.power);
    const sensors=chosenSensor(alarm.sensor);
    row=flowWords(doc,FORM_LEFT+6,row,[
      {text:'Type:',bold:true},
      {text:'9v',on:!!powers['9v'],tag:'9v'},
      {text:'240v',on:!!powers['240v'],tag:'240v'},
      {text:'Ni-Mh',on:!!powers['Ni-Mh'],tag:'NiMh'},
      {text:'Lithium',on:!!powers.Lithium,tag:'Lithium'},
      {text:'Ionization',on:!!sensors.Ionization,tag:'Ionization'},
      {text:'Photo-Electric',on:!!sensors['Photo-Electric'],tag:'PhotoElectric'},
      {text:'Heat',on:!!sensors.Heat,tag:'Heat'}
    ],7.5);
    doc.text('F2',7.5,FORM_LEFT+6,row,'Manufacturer',FORM_INK);
    doc.text('F1',7.5,FORM_LEFT+62,row,safeLine(alarm.manufacturer),FORM_INK);
    doc.rule(FORM_LEFT+60,row+9,120);
    doc.text('F2',7.5,240,row,'Model',FORM_INK);
    doc.text('F1',7.5,272,row,safeLine(alarm.model),FORM_INK);
    doc.rule(270,row+9,120);
    row+=14;
    doc.text('F2',7.5,FORM_LEFT+6,row,'Decibel output reading',FORM_INK);
    doc.text('F1',7.5,FORM_LEFT+100,row,safeLine(alarm.db),FORM_INK);
    doc.rule(FORM_LEFT+98,row+9,36);
    doc.text('F1',7.5,FORM_LEFT+140,row,'Db @ 3m',FORM_INK);
    doc.text('F2',7.5,360,row,'Expiry Date',FORM_INK);
    doc.frame(430,row-1,70,12);
    doc.text('F1',7.5,434,row,expiryLabel(alarm.expiry),FORM_INK);
    row+=16;
    const left=[
      ['Does it comply with AS3786 *1','comply'],
      ['Is it located correctly *2','located'],
      ['Is it firmly affixed','affixed'],
      ['Has it been cleaned','cleaned']
    ];
    const right=[
      ['New battery installed','battery'],
      ['Does the test button work','button'],
      ['Responds to synthetic smoke','smoke'],
      ['Insect surface spray','insect']
    ];
    left.forEach(function(pair,i){
      ynCell(doc,FORM_LEFT+6,row+i*12,pair[0],ynAnswer(alarm,pair[1]),pair[1]);
      ynCell(doc,310,row+i*12,right[i][0],ynAnswer(alarm,right[i][1]),right[i][1]);
    });
    return y+h+6;
  }
  function worksheetView(job,form,abn){
    job=job||{};
    form=form||{};
    const who=party(form.agent||job.agent||'');
    const n=+(form.alarms)||((form.al)||[]).length||0;
    return {
      abn:safeLine(abn)||FORM_ABN,
      ident:safeLine(form.ident||job.ident||''),
      agent:who.privateOwner?'Private Owner':(who.agency||safeLine(form.agent||job.agent||'')),
      address:safeLine(form.addr||job.addr||job.street||''),
      tech:safeLine(form.tech||job.tech||''),
      date:dmy(form.date),
      ptype:safeLine(form.ptype),
      ptypeOther:safeLine(form.ptypeOther),
      levels:form.levels||'',
      beds:form.beds||'',
      alarms:n,
      ladder:safeLine(form.ladder),
      asPrev:!!form.asPrev,
      asPhotos:!!form.asPhotos,
      list:(form.al||[]).slice(0,n)
    };
  }
  function drawWorksheet(job,form,abn){
    const view=worksheetView(job,form,abn);
    const slots=view.list.slice();
    const pairs=Math.max(2,Math.ceil(slots.length/2));
    while(slots.length<pairs*2)slots.push({});
    const doc=new Doc();
    let y=formBanner(doc,view,false);
    slots.forEach(function(alarm,i){
      const n=i+1;
      if(n>1&&n%2===1){
        doc.breakPage();
        y=formBanner(doc,view,true);
      }
      y=drawAlarmBlock(doc,alarm||{},n,y);
      if(n%2===0&&n>=4)formFooter(doc);
    });
    return doc.finish();
  }
  function dayPlan(jobs,forms,options){
    options=options||{};
    forms=forms||{};
    const date=isoDate(options.date);
    const names=dayFileName(date);
    const agency=options.agency||'';
    const data=dataApi();
    const rows=(jobs||[]).filter(function(job){
      return job&&jobDay(job,forms[job.id])===date&&agencyMatch(job,forms[job.id],agency);
    }).sort(function(a,b){
      const ka=routeKey(a),kb=routeKey(b);
      return ka<kb?-1:ka>kb?1:0;
    });
    const worksheets=[];
    const notes=[];
    const skipped=[];
    rows.forEach(function(job){
      const form=forms[job.id]||null;
      const address=String((form&&form.addr)||job.addr||job.street||'Untitled job');
      if(!jobFinished(job,form)){
        skipped.push({id:String(job.id||''),address:address,reason:'Not finished'});
        return;
      }
      const cert=data&&data.localCertificate?data.localCertificate(job,form):null;
      if(!cert){
        skipped.push({id:String(job.id||''),address:address,reason:'No worksheet to print'});
        return;
      }
      const passing=!!complianceModel(cert).validUntil;
      const item={id:String(job.id||''),address:cert.address||address,worksheet:true,certificate:passing,job:job,form:form,cert:cert};
      worksheets.push(item);
      if(!passing)notes.push({id:item.id,address:item.address,reason:'No compliance certificate'});
    });
    const certificates=worksheets.filter(function(item){return item.certificate});
    return {
      date:date,
      agency:agency,
      worksheetFile:names.worksheetFile,
      certificateFile:names.certificateFile,
      worksheetCount:worksheets.length,
      certificateCount:certificates.length,
      worksheets:worksheets,
      certificates:certificates,
      notes:notes,
      skipped:skipped
    };
  }
  function buildDayFiles(jobs,forms,options){
    options=options||{};
    const plan=dayPlan(jobs,forms,options);
    const pages=[];
    plan.worksheets.forEach(function(item){
      drawWorksheet(item.job,item.form,options.abn).forEach(function(page){pages.push(page)});
    });
    plan.worksheetBytes=pages.length?buildPdf(pages):null;
    const certPages=[];
    plan.certificates.forEach(function(item){
      drawCompliance(item.cert).forEach(function(page){certPages.push(page)});
    });
    plan.certificateBytes=certPages.length?buildPdf(certPages):null;
    return plan;
  }
  function pdfText(bytes){
    const list=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
    let s='';
    for(let i=0;i<list.length;i++)s+=String.fromCharCode(list[i]);
    return s;
  }

  return {viewModel:viewModel,complianceModel:complianceModel,fileName:fileName,complianceFileName:complianceFileName,dayFileName:dayFileName,dayPlan:dayPlan,buildDayFiles:buildDayFiles,buildCertificatePdf:buildCertificatePdf,buildCompliancePdf:buildCompliancePdf,buildPdf:buildPdf,pdfText:pdfText};
});
