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
  const RED=[0.937,0.180,0.196];
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
  function resultColor(label){
    if(label==='Pass'||label==='Replace')return OK;
    if(label==='Fail')return BAD;
    return INK;
  }
  function viewModel(cert){
    cert=cert||{};
    const data=dataApi();
    const pretty=data?data.prettyDate:function(v){return v||''};
    const label=data?data.resultLabel:function(v){return v||''};
    return {
      brand:'Clarence Coast Smoke Alarms',
      title:'Compliance certificate',
      address:cert.address||'',
      ident:cert.ident||'',
      date:pretty(cert.date),
      agency:cert.agencyCode||'',
      tenancy:cert.tenancy||'',
      result:label(cert.result),
      tech:cert.tech||'',
      statement:cert.statement||(data?data.statementFor(cert.tech,cert.date):''),
      alarms:(cert.alarms||[]).map(function(a){
        return {
          n:a.n,
          location:a.location||'',
          type:a.type||'',
          power:a.power||'',
          expiry:a.expiry||'',
          result:label(a.result)
        };
      }),
      footer:'Clarence Coast Smoke Alarms  ·  Tenant contact details are not included'
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
  Doc.prototype.header=function(continued){
    this.rect(0,0,PAGE_W,76,RED);
    this.text('F2',15,36,26,'CLARENCE COAST SMOKE ALARMS',WHITE);
    this.text('F1',12,36,48,continued?'Compliance certificate  ·  continued':'Compliance certificate',WHITE);
    this.top=92;
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
    doc.text('F1',9,36,doc.top,'Property',MUTED);
    doc.top+=16;
    wrap(view.address,16,PAGE_W-72,true).forEach(function(line){
      doc.need(22);
      doc.text('F2',16,36,doc.top,line,INK);
      doc.top+=22;
    });
    if(view.ident){
      doc.need(16);
      doc.text('F1',10,36,doc.top,view.ident,MUTED);
      doc.top+=16;
    }
    doc.top+=8;
    const meta=[
      ['Service date',view.date||'—'],
      ['Agency',view.agency||'—'],
      ['Tenancy',view.tenancy||'—'],
      ['Result',view.result||'—']
    ];
    const colW=(PAGE_W-72)/4;
    doc.need(36);
    meta.forEach(function(pair,i){
      const x=36+i*colW;
      doc.text('F1',8,x,doc.top,pair[0],MUTED);
      doc.text('F2',11,x,doc.top+16,pair[1],pair[0]==='Result'?resultColor(pair[1]):INK);
    });
    doc.top+=40;
    doc.need(28);
    doc.text('F2',12,36,doc.top,'Alarms tested',INK);
    doc.top+=18;
    const cols=[
      {label:'#',x:36,w:28},
      {label:'Location',x:64,w:180},
      {label:'Type',x:248,w:110},
      {label:'Power',x:362,w:70},
      {label:'Expiry',x:436,w:62},
      {label:'Result',x:502,w:60}
    ];
    function tableHead(){
      doc.need(22);
      doc.rect(32,doc.top-2,PAGE_W-64,18,PAPER);
      cols.forEach(function(col){doc.text('F2',8,col.x,doc.top+2,col.label,MUTED)});
      doc.top+=22;
    }
    tableHead();
    if(!view.alarms.length){
      doc.need(18);
      doc.text('F1',10,36,doc.top,'No alarms were recorded on this certificate.',MUTED);
      doc.top+=18;
    }
    view.alarms.forEach(function(alarm){
      const loc=wrap(alarm.location||'—',9,170,false);
      const type=wrap(alarm.type||'—',9,104,false);
      const lines=Math.max(loc.length,type.length,1);
      const h=lines*12+8;
      if(doc.top+h>PAGE_H-52){
        doc.breakPage();
        doc.header(true);
        tableHead();
      }
      doc.rect(32,doc.top-2,PAGE_W-64,h,WHITE);
      doc.cmd(rgb(LINE)+' RG\n0.4 w\n32 '+num(PAGE_H-(doc.top-2)-h)+' m '+num(PAGE_W-32)+' '+num(PAGE_H-(doc.top-2)-h)+' l S\n');
      doc.text('F2',9,cols[0].x,doc.top,String(alarm.n||''),INK);
      loc.forEach(function(line,i){doc.text('F1',9,cols[1].x,doc.top+i*12,line,INK)});
      type.forEach(function(line,i){doc.text('F1',9,cols[2].x,doc.top+i*12,line,INK)});
      doc.text('F1',9,cols[3].x,doc.top,alarm.power||'—',INK);
      doc.text('F1',9,cols[4].x,doc.top,alarm.expiry||'—',INK);
      doc.text('F2',9,cols[5].x,doc.top,alarm.result||'—',resultColor(alarm.result));
      doc.top+=h;
    });
    doc.top+=16;
    doc.need(28);
    doc.text('F2',12,36,doc.top,'Technician statement',INK);
    doc.top+=18;
    wrap(view.statement,10,PAGE_W-72,false).forEach(function(line){
      doc.need(14);
      doc.text('F1',10,36,doc.top,line,INK);
      doc.top+=14;
    });
    doc.top+=12;
    doc.need(16);
    doc.text('F1',9,36,doc.top,view.footer,MUTED);
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
  function pdfText(bytes){
    const list=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
    let s='';
    for(let i=0;i<list.length;i++)s+=String.fromCharCode(list[i]);
    return s;
  }

  return {viewModel:viewModel,fileName:fileName,buildCertificatePdf:buildCertificatePdf,buildPdf:buildPdf,pdfText:pdfText};
});
