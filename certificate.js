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
  const INK=[0.224,0.208,0.212];
  const MUTED=[0.373,0.357,0.361];
  const LINE=[0.788,0.776,0.776];
  const OK=[0.106,0.498,0.227];
  const BAD=[0.710,0.086,0.110];
  const PAPER=[0.965,0.961,0.961];
  const WHITE=[1,1,1];

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
    if(hardwired&&lith)return 'HW Lithium '+sensor+' Alarm';
    if(lith)return 'Lithium Battery '+sensor+' Alarm';
    if(hardwired)return 'HW '+sensor+' Alarm';
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
  const LEGEND='HW: hard-wired, battery can be changed. 9V: battery only, battery can be changed. HW lithium: hard-wired, sealed battery. Lithium: battery only, sealed battery.';
  function viewModel(cert){
    cert=cert||{};
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
      title:'Service report',
      brand:'Clarence Coast Smoke Alarms',
      phone:'0412 092 233',
      attention:attention,
      postal:postal,
      reportDate:dmy(cert.date),
      serviceAddress:safeLine(cert.address),
      jobNumber:safeLine(cert.ident||''),
      serviceReason:'Subscription Service',
      inspector:safeLine(cert.tech)||'Adam Westerman',
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
  Doc.prototype.text=function(font,size,x,fromTop,str,color){
    const y=PAGE_H-fromTop-size;
    this.cmd(rgb(color)+' rg\nBT\n/'+font+' '+size+' Tf\n1 0 0 1 '+num(x)+' '+num(y)+' Tm\n('+esc(str)+') Tj\nET\n');
  };
  Doc.prototype.mark=function(x,fromTop){
    this.rect(x,fromTop,34,34,ACCENT);
    this.text('F2',12,x+6,fromTop+10,'CC',WHITE);
  };
  Doc.prototype.header=function(continued,kicker){
    this.mark(36,16);
    this.text('F1',9,80,16,kicker||'Service report',MUTED);
    this.text('F2',12,80,30,'Clarence Coast Smoke Alarms',ACCENT);
    this.cmd(rgb(ACCENT)+' RG\n1.2 w\n80 '+num(PAGE_H-46)+' m 310 '+num(PAGE_H-46)+' l S\n');
    this.text('F1',8,80,50,'0412 092 233',MUTED);
    if(continued)this.text('F1',8,400,16,'continued',MUTED);
    this.top=70;
  };
  Doc.prototype.finish=function(){
    if(this.ops.length)this.pages.push(this.ops.join(''));
    this.ops=[];
    return this.pages;
  };

  function drawCertificate(cert){
    const view=viewModel(cert);
    const doc=new Doc();
    doc.header(false);
    wrap(view.attention,9,300,false).forEach(function(line){
      doc.text('F1',9,36,doc.top,line,INK);
      doc.top+=12;
    });
    view.postal.forEach(function(line){
      doc.text('F1',9,36,doc.top,line,INK);
      doc.top+=12;
    });
    doc.text('F1',9,380,70,'Report Date: '+(view.reportDate||''),INK);
    doc.top=Math.max(doc.top,96);
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
      ['Service Reason',view.serviceReason],
      ['Inspected by',view.inspector],
      ['Last Inspection Date',view.lastInspection]
    ];
    let sy=detailY;
    side.forEach(function(pair){
      doc.text('F1',8,380,sy,pair[0],MUTED);
      if(pair[1])doc.text('F2',9,380,sy+11,pair[1],INK);
      sy+=24;
    });
    doc.top=detailY+Math.max(addrLines.length,1)*13+8;
    if(view.compliant){
      doc.cmd(rgb(ACCENT)+' rg\n36 '+num(PAGE_H-doc.top-11)+' 9 9 re f\n');
      doc.text('F2',7,37.2,doc.top+1,'v',WHITE);
    }
    const lead=view.compliant?view.complianceLead:view.failLead;
    wrap(lead,8,340,false).forEach(function(line){
      doc.text('F1',8,52,doc.top,line,INK);
      doc.top+=10;
    });
    view.laws.forEach(function(law){
      wrap(law,7.5,330,false).forEach(function(line,i){
        doc.text('F1',7.5,52,doc.top,(i?'':'- ')+line,INK);
        doc.top+=9;
      });
    });
    doc.top+=4;
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
      doc.cmd(rgb(ACCENT)+' RG\n0.8 w\n36 '+num(PAGE_H-doc.top-11)+' m '+num(PAGE_W-36)+' '+num(PAGE_H-doc.top-11)+' l S\n');
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
  function buildPdf(pages){
    const n=pages.length||1;
    const contents=pages.length?pages:['BT\n/F1 12 Tf\n36 800 Td\n(Empty certificate) Tj\nET\n'];
    const objs=[];
    objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
    const kids=[];
    for(let i=0;i<n;i++)kids.push((5+i*2)+' 0 R');
    objs[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+n+' >>';
    objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    contents.forEach(function(stream,i){
      const pageNum=5+i*2;
      const contentNum=pageNum+1;
      objs[pageNum]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents '+contentNum+' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>';
      objs[contentNum]={stream:stream};
    });
    let body='%PDF-1.4\n';
    const offsets=[0];
    for(let i=1;i<objs.length;i++){
      if(objs[i]==null)continue;
      offsets[i]=body.length;
      if(objs[i].stream!=null){
        const stream=objs[i].stream;
        body+=i+' 0 obj << /Length '+stream.length+' >> stream\n'+stream+'endstream\nendobj\n';
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
    const due=dmy(extra.due||(cert&&cert.due)||'');
    const ok=!!(report.compliant&&due);
    return {
      title:'Compliance certificate',
      brand:'Clarence Coast Smoke Alarms',
      phone:report.phone,
      attention:report.attention,
      address:report.serviceAddress,
      statement:ok?'Clarence Coast Smoke Alarms records this property as meeting the smoke alarm checks from the latest visit.':'Clarence Coast Smoke Alarms does not record this property as compliant from the latest visit.',
      validUntil:ok?due:'',
      validLabel:ok?'Valid until':'',
      date:report.reportDate,
      inspector:report.inspector,
      footer:report.footer
    };
  }
  function drawCompliance(cert,extra){
    const view=complianceModel(cert,extra);
    const doc=new Doc();
    doc.header(false,'Compliance certificate');
    if(view.attention){
      wrap(view.attention,9,500,false).forEach(function(line){
        doc.text('F1',9,36,doc.top,line,INK);
        doc.top+=12;
      });
    }
    doc.top+=6;
    wrap(view.address,12,500,true).forEach(function(line){
      doc.text('F2',12,36,doc.top,line,INK);
      doc.top+=16;
    });
    doc.top+=8;
    wrap(view.statement,10,500,false).forEach(function(line){
      doc.text('F1',10,36,doc.top,line,INK);
      doc.top+=14;
    });
    doc.top+=8;
    if(view.validUntil){
      doc.text('F1',9,36,doc.top,'Valid until',MUTED);
      doc.top+=12;
      doc.text('F2',12,36,doc.top,view.validUntil,ACCENT);
      doc.top+=20;
    }
    doc.text('F1',9,36,doc.top,'Latest visit '+(view.date||''),INK);
    doc.top+=14;
    doc.text('F1',9,36,doc.top,'Inspected by '+(view.inspector||''),INK);
    doc.top+=20;
    doc.text('F1',8,36,doc.top,view.footer,MUTED);
    return doc.finish();
  }
  function buildCompliancePdf(cert,extra){
    return buildPdf(drawCompliance(cert||{},extra||{}));
  }
  function complianceFileName(cert){
    return 'CCSA-compliance-'+fileName(cert||{});
  }
  function pdfText(bytes){
    const list=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
    let s='';
    for(let i=0;i<list.length;i++)s+=String.fromCharCode(list[i]);
    return s;
  }

  return {viewModel:viewModel,complianceModel:complianceModel,fileName:fileName,complianceFileName:complianceFileName,buildCertificatePdf:buildCertificatePdf,buildCompliancePdf:buildCompliancePdf,buildPdf:buildPdf,pdfText:pdfText};
});
