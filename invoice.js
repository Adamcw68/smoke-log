/* Invoices for completed visits.
   Prices, ABN and bank details come from Invoice settings. They are not filled in here.
   The business phone starts as the Clarence Coast number Adam gave. A draft stays on this
   phone until it is issued and published. An invoice names the agency and the property.
   It does not name a tenant or carry a tenant phone or email. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CCSAInvoice=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STORE='ccsa.invoice.v1';
  const KEYS=['id','number','propertyId','jobId','agencyId','agencyCode','address','ident','tenancy','issueDate','dueDate','status','paidAt','gstRegistered','businessName','abn','businessAddress','businessPhone','businessEmail','bankName','bsb','accountName','accountNumber','terms','lines','exCents','gstCents','totalCents','publishedAt'];
  const LINE_KEYS=['description','qty','unitCents','amountCents'];
  const FORBIDDEN=['contact','p1','p2','phone','phoneLine','email','tenant','tenantName','tenantPhone','tenantEmail','mobile','directions','notes','comments'];
  const SERVICE='Annual smoke alarm and compliance service';
  const REPLACE='Smoke alarm replacement';
  const BATTERY='New battery';

  function portal(){
    if(typeof CCSAPortalData!=='undefined')return CCSAPortalData;
    if(typeof require==='function'){try{return require('./portaldata.js')}catch(e){return null}}
    return null;
  }
  function pdfLib(){
    if(typeof CCSACertificate!=='undefined'&&CCSACertificate.buildPdf)return CCSACertificate;
    if(typeof require==='function'){try{return require('./certificate.js')}catch(e){return null}}
    return null;
  }
  function clean(v){return v==null?'':String(v).replace(/\s+/g,' ').trim()}
  function slug(v){
    return clean(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  }
  function pad2(n){return String(n).padStart(2,'0')}
  function ymd(v){const s=clean(v);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
  function addDays(v,n){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd(v));
    if(!m)return '';
    const dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+(+n||0)));
    return dt.getUTCFullYear()+'-'+pad2(dt.getUTCMonth()+1)+'-'+pad2(dt.getUTCDate());
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function phoneOrEmail(v){
    const s=String(v==null?'':v);
    if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s))return true;
    if(/(?:\+?61|0)[ \-]*[2-478](?:[ \-]*\d){8}\b/.test(s))return true;
    return false;
  }
  function defaultSettings(){
    return {
      businessName:'Clarence Coast Smoke Alarms',
      abn:'',
      address:'',
      phone:'0412 092 233',
      email:'',
      bankName:'',
      bsb:'',
      accountNumber:'',
      accountName:'',
      termsDays:14,
      termsText:'Payment is due within 14 days.',
      gstRegistered:false,
      prices:{service:0,replace:0,battery:0},
      nextNumber:1,
      accountCode:'200',
      brandingTheme:''
    };
  }
  function cents(value){
    const n=Math.round(Number(value)||0);
    return n>0?n:0;
  }
  function dollarsToCents(text){
    const s=clean(text).replace(/^\$/,'');
    if(!s)return 0;
    if(!/^\d+(\.\d{1,2})?$/.test(s))return null;
    const parts=s.split('.');
    return (+parts[0])*100+(+(parts[1]||'0').padEnd(2,'0'));
  }
  function money(centsValue){
    const n=Math.round(Number(centsValue)||0);
    const sign=n<0?'-':'';
    const abs=Math.abs(n);
    return sign+'$'+Math.floor(abs/100)+'.'+String(abs%100).padStart(2,'0');
  }
  function dollars(centsValue){
    return (Math.round(Number(centsValue)||0)/100).toFixed(2);
  }
  function normaliseSettings(raw){
    const base=defaultSettings();
    const src=raw||{};
    const prices=src.prices||{};
    base.businessName=clean(src.businessName)||base.businessName;
    base.abn=clean(src.abn).replace(/[^\d ]/g,'').slice(0,14);
    base.address=clean(src.address);
    base.phone=clean(src.phone)||base.phone;
    base.email=clean(src.email);
    base.bankName=clean(src.bankName);
    base.bsb=clean(src.bsb);
    base.accountNumber=clean(src.accountNumber).replace(/\D/g,'').slice(0,12);
    base.accountName=clean(src.accountName);
    base.termsDays=Math.min(365,Math.max(0,Math.round(+src.termsDays||base.termsDays)));
    base.termsText=clean(src.termsText)||('Payment is due within '+base.termsDays+' days.');
    base.gstRegistered=!!src.gstRegistered;
    base.prices={
      service:cents(prices.service),
      replace:cents(prices.replace),
      battery:cents(prices.battery)
    };
    base.nextNumber=Math.max(1,Math.round(+src.nextNumber||1));
    base.accountCode=clean(src.accountCode).replace(/[^A-Za-z0-9]/g,'').slice(0,10)||'200';
    base.brandingTheme=clean(src.brandingTheme).slice(0,80);
    return base;
  }
  const XERO_HEADERS=['*ContactName','EmailAddress','POAddressLine1','POAddressLine2','POAddressLine3','POAddressLine4','POCity','PORegion','POPostalCode','POCountry','*InvoiceNumber','Reference','*InvoiceDate','*DueDate','InventoryItemCode','*Description','*Quantity','*UnitAmount','Discount','*AccountCode','*TaxType','TrackingName1','TrackingOption1','TrackingName2','TrackingOption2','Currency','BrandingTheme'];
  function dmy(value){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd(value));
    if(!m)return '';
    return m[3]+'/'+m[2]+'/'+m[1];
  }
  function csvCell(value){
    const s=String(value==null?'':value);
    if(/[",\n\r]/.test(s))return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }
  function xeroContact(invoice){
    if(invoice.privateOwner||invoice.agencyCode==='Private Owner')return clean(invoice.agencyName)||'The owner';
    const lib=portal();
    const found=lib&&lib.agencyFromCode?lib.agencyFromCode(invoice.agencyCode||invoice.agencyName||''):null;
    if(found&&found.privateOwner)return clean(invoice.agencyName)||'The owner';
    if(found&&found.name)return found.name;
    return clean(invoice.agencyName||invoice.agencyCode);
  }
  function xeroTax(invoice){return invoice&&invoice.gstRegistered?'GST on Income':'BAS Excluded'}
  function xeroCandidates(list,includeExported){
    return (list||[]).filter(function(inv){
      if(!inv||inv.draft||!numberValue(inv.number))return false;
      if(!includeExported&&inv.exportedToXeroAt)return false;
      return true;
    });
  }
  function xeroRows(invoices,settings){
    settings=normaliseSettings(settings);
    const rows=[];
    (invoices||[]).forEach(function(inv){
      if(!inv||inv.draft||!numberValue(inv.number))return;
      const lines=(inv.lines||[]).filter(function(line){return clean(line.description)&&(+line.qty>0)});
      const usable=lines.length?lines:[{description:'Smoke alarm service',qty:1,unitCents:inv.exCents||0}];
      usable.forEach(function(line){
        rows.push([
          xeroContact(inv),'','','','','','','','','',
          inv.number,
          inv.address||'',
          dmy(inv.issueDate),
          dmy(inv.dueDate),
          '',
          clean(line.description),
          String(Math.round(+line.qty)||0),
          dollars(line.unitCents),
          '',
          settings.accountCode,
          xeroTax(inv),
          '','','','',
          'AUD',
          settings.brandingTheme
        ]);
      });
    });
    return rows;
  }
  function xeroCsv(invoices,settings){
    const lines=[XERO_HEADERS.map(csvCell).join(',')];
    xeroRows(invoices,settings).forEach(function(row){lines.push(row.map(csvCell).join(','))});
    return lines.join('\r\n')+'\r\n';
  }
  function markExported(invoices,now){
    const stamp=now||new Date().toISOString();
    return (invoices||[]).map(function(inv){return Object.assign({},inv,{exportedToXeroAt:stamp})});
  }
  function formatNumber(n){return 'INV-'+String(n).padStart(4,'0')}
  function numberValue(value){
    const m=/^INV-(\d+)$/.exec(clean(value));
    return m?+m[1]:0;
  }
  function nextFree(settings,invoices){
    const used={};
    (invoices||[]).forEach(function(inv){
      const n=numberValue(inv&&inv.number);
      if(n)used[n]=true;
    });
    let n=Math.max(1,Math.round(+settings.nextNumber||1));
    while(used[n])n++;
    return n;
  }
  function totals(lines,gstRegistered){
    let ex=0;
    const out=(lines||[]).map(function(line){
      const qty=Math.max(0,Math.round(Number(line&&line.qty)||0));
      const unit=cents(line&&line.unitCents);
      const amount=qty*unit;
      ex+=amount;
      return {description:clean(line&&line.description).slice(0,160),qty:qty,unitCents:unit,amountCents:amount};
    }).filter(function(line){return line.description&&line.qty>0});
    const gst=gstRegistered?Math.round(ex*10/100):0;
    return {lines:out,exCents:ex,gstCents:gst,totalCents:ex+gst};
  }
  function lithium(alarm){
    return !!(alarm&&(alarm.power||[]).some(function(p){return /lithium/i.test(String(p))}));
  }
  function suggestLines(form,prices){
    prices=prices||{};
    const n=form&&form.alarms?+form.alarms:0;
    const alarms=((form&&form.al)||[]).slice(0,n);
    const lines=[{description:SERVICE,qty:1,unitCents:cents(prices.service)}];
    const replaced=alarms.filter(function(a){return a&&(a.isNew||a.newAns==='Yes')}).length;
    if(replaced)lines.push({description:REPLACE,qty:replaced,unitCents:cents(prices.replace)});
    const batteries=alarms.filter(function(a){return a&&a.yn&&a.yn.battery==='Yes'&&!lithium(a)}).length;
    if(batteries)lines.push({description:BATTERY,qty:batteries,unitCents:cents(prices.battery)});
    return lines;
  }
  function displayStatus(invoice,today){
    if(!invoice)return 'unpaid';
    if(invoice.paidAt||invoice.status==='paid')return 'paid';
    if(invoice.dueDate&&today&&invoice.dueDate<today)return 'overdue';
    return 'unpaid';
  }
  function statusLabel(status){
    if(status==='paid')return 'Paid';
    if(status==='overdue')return 'Overdue';
    return 'Unpaid';
  }
  function completed(job,form){return !!((form&&form.done)||(job&&job.arch))}
  function draftFromJob(job,form,settings){
    settings=normaliseSettings(settings);
    const lib=portal();
    const agency=lib?lib.agencyFromCode((form&&form.agent)||(job&&job.agent)||''):null;
    if(!agency||!job)return null;
    const address=clean((form&&form.addr)||job.addr||'');
    if(!address||!completed(job,form))return null;
    const ownerBits=[form&&form.owner,form&&form.ownerName,job.owner,job.ownerName];
    let owner='';
    ownerBits.forEach(function(bit){if(!owner){const s=clean(bit);if(s&&!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s)&&!/(?:\+?61|0)[ \-]*[2-478](?:[ \-]*\d){8}\b/.test(s))owner=s}});
    const serviceDate=(form&&ymd(form.date))||ymd(String(job.svc||'').slice(0,10))||ymd(job.last);
    const summed=totals(suggestLines(form,settings.prices),settings.gstRegistered);
    return {
      draft:true,
      jobId:String(job.id),
      propertyId:slug(address)||'property',
      agencyId:agency.privateOwner?'':agency.id,
      agencyCode:agency.privateOwner?'Private Owner':agency.code,
      agencyName:agency.privateOwner?(owner||'The owner'):agency.name,
      privateOwner:!!agency.privateOwner,
      address:address,
      ident:clean((form&&form.ident)||job.ident||''),
      tenancy:(form&&form.tenancy)||job.section||'',
      serviceDate:serviceDate,
      number:'',
      issueDate:'',
      dueDate:'',
      paidAt:'',
      status:'unpaid',
      lines:summed.lines,
      exCents:summed.exCents,
      gstCents:summed.gstCents,
      totalCents:summed.totalCents,
      gstRegistered:settings.gstRegistered,
      publishedAt:''
    };
  }
  function applyLines(invoice,lines,gstRegistered){
    const summed=totals(lines,gstRegistered);
    const next=Object.assign({},invoice,{
      lines:summed.lines,
      exCents:summed.exCents,
      gstCents:summed.gstCents,
      totalCents:summed.totalCents,
      gstRegistered:!!gstRegistered
    });
    return next;
  }
  function issue(invoice,settings,invoices,today){
    settings=normaliseSettings(settings);
    const day=ymd(today);
    const next=Object.assign({},invoice);
    if(!numberValue(next.number)){
      const n=nextFree(settings,invoices);
      next.number=formatNumber(n);
      settings=normaliseSettings(Object.assign({},settings,{nextNumber:n+1}));
    }
    if(!next.issueDate)next.issueDate=day;
    if(!next.dueDate)next.dueDate=addDays(next.issueDate,settings.termsDays);
    next.draft=false;
    next.status=displayStatus(next,day);
    next.id='inv-'+String(numberValue(next.number)).padStart(4,'0');
    return {invoice:next,settings:settings};
  }
  function markPaid(invoice,today,paid){
    const next=Object.assign({},invoice);
    if(paid===false){next.paidAt='';next.status='unpaid'}
    else{next.paidAt=ymd(today);next.status='paid'}
    next.status=displayStatus(next,ymd(today));
    return next;
  }
  function businessBlock(settings){
    settings=normaliseSettings(settings);
    return {
      businessName:settings.businessName,
      abn:settings.abn,
      businessAddress:settings.address,
      businessPhone:settings.phone,
      businessEmail:settings.email,
      bankName:settings.bankName,
      bsb:settings.bsb,
      accountName:settings.accountName,
      accountNumber:settings.accountNumber,
      terms:settings.termsText
    };
  }
  function toPortal(invoice,settings,today,now){
    if(!invoice||invoice.draft||!numberValue(invoice.number))return null;
    const biz=businessBlock(settings||{});
    const day=ymd(today);
    const status=displayStatus(invoice,day);
    const doc={
      id:invoice.id||('inv-'+String(numberValue(invoice.number)).padStart(4,'0')),
      number:invoice.number,
      propertyId:invoice.propertyId,
      jobId:String(invoice.jobId||''),
      agencyId:invoice.agencyId,
      agencyCode:invoice.agencyCode,
      address:clean(invoice.address),
      ident:clean(invoice.ident),
      tenancy:invoice.tenancy==='Holiday'||invoice.tenancy==='Permanent'?invoice.tenancy:'',
      issueDate:ymd(invoice.issueDate),
      dueDate:ymd(invoice.dueDate),
      status:status,
      paidAt:ymd(invoice.paidAt),
      gstRegistered:!!invoice.gstRegistered,
      businessName:biz.businessName,
      abn:biz.abn,
      businessAddress:biz.businessAddress,
      businessPhone:biz.businessPhone,
      businessEmail:biz.businessEmail,
      bankName:biz.bankName,
      bsb:biz.bsb,
      accountName:biz.accountName,
      accountNumber:biz.accountNumber,
      terms:biz.terms,
      lines:(invoice.lines||[]).map(function(line){return {description:clean(line.description),qty:Math.max(0,Math.round(Number(line.qty)||0)),unitCents:cents(line.unitCents),amountCents:cents(line.amountCents)}}),
      exCents:cents(invoice.exCents),
      gstCents:cents(invoice.gstCents),
      totalCents:cents(invoice.totalCents),
      publishedAt:now||day
    };
    doc.lines=doc.lines.filter(function(line){return line.description&&line.qty>0});
    return doc;
  }
  function walk(value,path,hits){
    if(Array.isArray(value)){value.forEach(function(item,i){walk(item,path+'['+i+']',hits)});return}
    if(value&&typeof value==='object'){
      Object.keys(value).forEach(function(key){
        if(FORBIDDEN.indexOf(key)>=0)hits.push(path+'.'+key);
        walk(value[key],path+'.'+key,hits);
      });
    }
  }
  function tenantHits(value){
    const hits=[];
    const list=Array.isArray(value)?value:[value];
    list.forEach(function(inv){
      if(!inv)return;
      walk(inv,'invoice',hits);
      [inv.address,inv.ident,inv.tenancy,inv.terms,inv.businessName].concat((inv.lines||[]).map(function(line){return line.description})).forEach(function(text){
        if(phoneOrEmail(text))hits.push('contact in text');
      });
    });
    return hits;
  }
  function sameKeys(value,keys){
    const got=Object.keys(value||{}).sort();
    const want=keys.slice().sort();
    return got.length===want.length&&got.every(function(key,i){return key===want[i]});
  }
  function filterInvoices(list,query){
    query=query||{};
    const from=ymd(query.from);
    const to=ymd(query.to);
    return (list||[]).filter(function(inv){
      const status=displayStatus(inv,query.today);
      if(query.status&&status!==query.status)return false;
      if(from&&inv.issueDate&&inv.issueDate<from)return false;
      if(to&&inv.issueDate&&inv.issueDate>to)return false;
      if(query.agencyId&&inv.agencyId!==query.agencyId)return false;
      if(query.q&&(inv.address||'').toLowerCase().indexOf(String(query.q).toLowerCase())<0&&(inv.number||'').toLowerCase().indexOf(String(query.q).toLowerCase())<0)return false;
      return true;
    });
  }
  function viewModel(invoice){
    const lib=portal();
    const pretty=lib?lib.prettyDate:function(v){return v||''};
    const gst=!!invoice.gstRegistered;
    return {
      title:gst?'Tax Invoice':'Invoice',
      business:invoice.businessName||'Clarence Coast Smoke Alarms',
      abn:invoice.abn||'',
      businessAddress:invoice.businessAddress||'',
      businessPhone:invoice.businessPhone||'',
      businessEmail:invoice.businessEmail||'',
      number:invoice.number||'Draft',
      issue:pretty(invoice.issueDate),
      due:pretty(invoice.dueDate),
      status:statusLabel(displayStatus(invoice,invoice.today||'')),
      billTo:(function(){
        if(invoice.privateOwner||invoice.agencyCode==='Private Owner')return invoice.agencyName||'The owner';
        const lib=portal();
        const found=lib&&lib.agencyFromCode(invoice.agencyCode||invoice.agencyName||'');
        if(found&&found.privateOwner)return invoice.agencyName||'The owner';
        return found&&found.name?found.name:(invoice.agencyName||invoice.agencyCode||'');
      })(),
      address:invoice.address||'',
      ident:invoice.ident||'',
      tenancy:invoice.tenancy||'',
      lines:(invoice.lines||[]).map(function(line){
        return {description:line.description,qty:line.qty,unit:money(line.unitCents),amount:money(line.amountCents)};
      }),
      ex:money(invoice.exCents),
      gst:money(invoice.gstCents),
      total:money(invoice.totalCents),
      showGst:gst,
      bankName:invoice.bankName||'',
      bsb:invoice.bsb||'',
      accountName:invoice.accountName||'',
      accountNumber:invoice.accountNumber||'',
      terms:invoice.terms||'',
      note:(invoice.privateOwner||invoice.agencyCode==='Private Owner')?'Billed to the owner of this property. Tenant names and contact details are not on this invoice.':'Billed to the agency for this property. Tenant names and contact details are not on this invoice.'
    };
  }
  function fileName(invoice){
    const num=clean(invoice&&invoice.number)||'draft';
    const street=String((invoice&&invoice.address)||'property').split(',')[0].replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return num+'-'+(street||'property')+'.pdf';
  }
  function ascii(v){return String(v==null?'':v).replace(/[^\x20-\x7E]/g,' ')}
  function pdfEsc(v){return ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
  function buildInvoicePdf(invoice){
    const lib=pdfLib();
    const view=viewModel(invoice);
    const pageH=841.89;
    const ops=[];
    let top=0;
    function y(fromTop,size){return pageH-fromTop-size}
    function rect(x,fromTop,w,h,color){
      ops.push(color+' rg\n'+x.toFixed(2)+' '+(pageH-fromTop-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re f\n');
    }
    function text(font,size,x,fromTop,str,color){
      ops.push(color+' rg\nBT\n/'+font+' '+size+' Tf\n1 0 0 1 '+x.toFixed(2)+' '+y(fromTop,size).toFixed(2)+' Tm\n('+pdfEsc(str)+') Tj\nET\n');
    }
    rect(0,0,595.28,78,'0.78 0.10 0.12');
    text('F2',15,36,24,view.business.toUpperCase(),'1 1 1');
    text('F1',12,36,46,view.title,'1 1 1');
    top=96;
    text('F1',9,36,top,'Invoice number','0.37 0.36 0.36');
    text('F2',12,36,top+14,view.number,'0.22 0.21 0.21');
    text('F1',9,220,top,'Issued','0.37 0.36 0.36');
    text('F2',12,220,top+14,view.issue||'—','0.22 0.21 0.21');
    text('F1',9,360,top,'Due','0.37 0.36 0.36');
    text('F2',12,360,top+14,view.due||'—','0.22 0.21 0.21');
    text('F1',9,470,top,'Status','0.37 0.36 0.36');
    text('F2',12,470,top+14,view.status,'0.22 0.21 0.21');
    top+=48;
    if(view.abn){text('F1',10,36,top,'ABN '+view.abn,'0.22 0.21 0.21');top+=14}
    [view.businessAddress,view.businessPhone,view.businessEmail].filter(Boolean).forEach(function(line){
      text('F1',10,36,top,line,'0.22 0.21 0.21');top+=14;
    });
    top+=8;
    text('F1',9,36,top,'Bill to','0.37 0.36 0.36');top+=14;
    text('F2',12,36,top,view.billTo||'Agency','0.22 0.21 0.21');top+=18;
    text('F1',9,36,top,'Property','0.37 0.36 0.36');top+=14;
    text('F2',12,36,top,view.address,'0.22 0.21 0.21');top+=18;
    if(view.tenancy){text('F1',10,36,top,view.tenancy,'0.37 0.36 0.36');top+=16}
    top+=6;
    rect(32,top,531,18,'0.96 0.96 0.96');
    text('F2',8,40,top+3,'Description','0.37 0.36 0.36');
    text('F2',8,360,top+3,'Qty','0.37 0.36 0.36');
    text('F2',8,410,top+3,'Price','0.37 0.36 0.36');
    text('F2',8,490,top+3,'Amount','0.37 0.36 0.36');
    top+=24;
    view.lines.forEach(function(line){
      text('F1',10,40,top,line.description,'0.22 0.21 0.21');
      text('F1',10,360,top,String(line.qty),'0.22 0.21 0.21');
      text('F1',10,410,top,line.unit,'0.22 0.21 0.21');
      text('F2',10,490,top,line.amount,'0.22 0.21 0.21');
      top+=18;
    });
    top+=8;
    text('F1',10,400,top,'Subtotal','0.37 0.36 0.36');
    text('F2',10,490,top,view.ex,'0.22 0.21 0.21');
    top+=16;
    if(view.showGst){
      text('F1',10,400,top,'GST 10%','0.37 0.36 0.36');
      text('F2',10,490,top,view.gst,'0.22 0.21 0.21');
      top+=16;
    }
    text('F2',12,400,top,'Total','0.22 0.21 0.21');
    text('F2',12,490,top,view.total,'0.22 0.21 0.21');
    top+=28;
    text('F2',11,36,top,'Payment','0.22 0.21 0.21');top+=16;
    if(view.bsb||view.accountNumber){
      if(view.bankName){text('F1',10,36,top,view.bankName,'0.22 0.21 0.21');top+=14}
      if(view.accountName){text('F1',10,36,top,'Account name '+view.accountName,'0.22 0.21 0.21');top+=14}
      if(view.bsb){text('F1',10,36,top,'BSB '+view.bsb,'0.22 0.21 0.21');top+=14}
      if(view.accountNumber){text('F1',10,36,top,'Account '+view.accountNumber,'0.22 0.21 0.21');top+=14}
    }else{
      text('F1',10,36,top,'Bank details have not been added.','0.37 0.36 0.36');top+=14;
    }
    if(view.terms){top+=6;text('F1',10,36,top,view.terms,'0.22 0.21 0.21');top+=16}
    top+=8;
    text('F1',8,36,top,view.note,'0.37 0.36 0.36');
    const pages=[ops.join('')];
    return lib?lib.buildPdf(pages):new Uint8Array();
  }

  function sampleSettings(){
    return normaliseSettings({
      businessName:'Clarence Coast Smoke Alarms',
      phone:'0412 092 233',
      email:'',
      address:'Yamba NSW',
      termsDays:14,
      termsText:'Payment is due within 14 days.',
      gstRegistered:true,
      prices:{service:15000,replace:4500,battery:500},
      nextNumber:1
    });
  }
  function demoRecord(bucket,job,lines,number,paidAt,dueDate,today){
    const settings=sampleSettings();
    const summed=totals(lines,true);
    const issueDate=job.serviceDate;
    const invoice=Object.assign({
      id:'inv-'+String(numberValue(number)).padStart(4,'0'),
      number:number,
      propertyId:job.propertyId,
      jobId:job.id,
      agencyId:bucket.id,
      agencyCode:bucket.code,
      agencyName:bucket.name,
      address:job.address,
      ident:job.ident||'',
      tenancy:job.tenancy||'',
      issueDate:issueDate,
      dueDate:dueDate||addDays(issueDate,14),
      paidAt:paidAt||'',
      status:'unpaid',
      draft:false,
      gstRegistered:true,
      today:today
    },summed,businessBlock(settings));
    invoice.status=displayStatus(invoice,today);
    return toPortal(invoice,settings,today,'2026-11-13T00:00:00.000Z');
  }
  function demoInvoices(bucket,today){
    if(!bucket)return [];
    const prices=sampleSettings().prices;
    const byAddress={};
    (bucket.jobs||[]).forEach(function(job){if(job&&job.address)byAddress[job.address]=job});
    function jobAt(part){
      const key=Object.keys(byAddress).filter(function(address){return address.indexOf(part)===0})[0];
      return key?byAddress[key]:null;
    }
    const service=[{description:SERVICE,qty:1,unitCents:prices.service}];
    const out=[];
    if(bucket.id==='rwm'){
      const river=jobAt('18 River');
      const church=jobAt('9 Church');
      const shortSt=jobAt('15 Short');
      if(river)out.push(demoRecord(bucket,river,service,'INV-0002',addDays(river.serviceDate,6),addDays(river.serviceDate,14),today));
      if(shortSt)out.push(demoRecord(bucket,shortSt,service.concat([{description:REPLACE,qty:1,unitCents:prices.replace}]),'INV-0001','','2026-11-27',today));
      if(church)out.push(demoRecord(bucket,church,service,'INV-0003','',addDays(church.serviceDate,14),today));
    }else{
      const first=(bucket.jobs||[]).filter(function(job){return job.status==='completed'})[0];
      if(first)out.push(demoRecord(bucket,first,service,'INV-0101','',addDays(first.serviceDate,14),today));
    }
    return out.filter(Boolean);
  }

  const mem={settings:defaultSettings(),invoices:{},ready:false};
  let hooks=null;
  function load(){
    if(!hooks||!hooks.storage){mem.ready=true;return}
    try{
      const raw=hooks.storage.getItem(STORE);
      const saved=raw?JSON.parse(raw):null;
      if(saved){
        mem.settings=normaliseSettings(saved.settings);
        mem.invoices=saved.invoices||{};
      }
    }catch(e){}
    mem.ready=true;
  }
  function save(){
    if(!hooks||!hooks.storage)return;
    try{hooks.storage.setItem(STORE,JSON.stringify({settings:mem.settings,invoices:mem.invoices}))}catch(e){}
  }
  function syncDrafts(){
    load();
    const jobs=hooks&&hooks.getJobs?hooks.getJobs():[];
    const forms=hooks&&hooks.getForms?hooks.getForms():{};
    (jobs||[]).forEach(function(job){
      if(!job||mem.invoices[job.id])return;
      const draft=draftFromJob(job,forms[job.id],mem.settings);
      if(draft)mem.invoices[job.id]=draft;
    });
    save();
  }
  function portalCopies(agencyId,today,now){
    load();
    return Object.keys(mem.invoices).map(function(id){return mem.invoices[id]}).filter(function(inv){
      return inv&&!inv.draft&&!inv.privateOwner&&inv.agencyId&&inv.agencyId===agencyId&&numberValue(inv.number);
    }).map(function(inv){
      const doc=toPortal(inv,mem.settings,today,now);
      if(doc)mem.invoices[inv.jobId].publishedAt=doc.publishedAt;
      return doc;
    }).filter(Boolean);
  }
  function paint(el){
    if(!el)return;
    const today=portal()?portal().sydneyToday():'';
    const rows=Object.keys(mem.invoices).map(function(id){return mem.invoices[id]}).sort(function(a,b){return (a.issueDate||a.serviceDate||'')<(b.issueDate||b.serviceDate||'')?1:-1});
    const s=mem.settings;
    const selected=mem.selected&&mem.invoices[mem.selected]?mem.invoices[mem.selected]:null;
    const lines=selected?(selected.lines||[]):[];
    el.innerHTML=`<section class="f" id="invoice-settings"><h2>Invoice settings</h2>
      <p class="note">Prices, ABN and bank details stay blank until you enter them. The phone number is the business number. Nothing here is a tenant's number.</p>
      <label class="l" for="inv-name">Business name</label><input class="t" id="inv-name" value="${esc(s.businessName)}">
      <label class="l" for="inv-abn">ABN</label><input class="t" id="inv-abn" value="${esc(s.abn)}" inputmode="numeric" placeholder="Leave blank until you have it">
      <label class="l" for="inv-address">Business address</label><input class="t" id="inv-address" value="${esc(s.address)}">
      <label class="l" for="inv-phone">Phone</label><input class="t" id="inv-phone" value="${esc(s.phone)}">
      <label class="l" for="inv-email">Email</label><input class="t" id="inv-email" type="email" value="${esc(s.email)}">
      <label class="l" for="inv-bank">Bank</label><input class="t" id="inv-bank" value="${esc(s.bankName)}" placeholder="Bank name">
      <div class="grid2"><div><label class="l" for="inv-bsb">BSB</label><input class="t" id="inv-bsb" value="${esc(s.bsb)}" placeholder="Leave blank" inputmode="numeric"></div><div><label class="l" for="inv-acct">Account number</label><input class="t" id="inv-acct" value="${esc(s.accountNumber)}" placeholder="Leave blank" inputmode="numeric"></div></div>
      <label class="l" for="inv-acctname">Account name</label><input class="t" id="inv-acctname" value="${esc(s.accountName)}">
      <label class="l" for="inv-days">Payment terms (days)</label><input class="t" id="inv-days" type="number" min="0" max="365" value="${esc(s.termsDays)}">
      <label class="l" for="inv-terms">Terms line</label><input class="t" id="inv-terms" value="${esc(s.termsText)}">
      <label class="tog"><span>Registered for GST. A tax invoice adds 10% GST.</span><input type="checkbox" id="inv-gst" ${s.gstRegistered?'checked':''}></label>
      <h2>Xero</h2>
      <p class="note">These stay on this phone. They are not published to an agency. This site cannot sign in to Xero, so export a CSV and import it there.</p>
      <label class="l" for="inv-xero-account">Xero account code</label><input class="t" id="inv-xero-account" value="${esc(s.accountCode)}" placeholder="200">
      <label class="l" for="inv-xero-theme">Xero branding theme</label><input class="t" id="inv-xero-theme" value="${esc(s.brandingTheme)}" placeholder="Leave blank">
      <h2>Price list</h2>
      <p class="note">These start at 0.00. Enter the amount you charge, excluding GST.</p>
      <label class="l" for="inv-price-service">${esc(SERVICE)}</label><input class="t" id="inv-price-service" inputmode="decimal" value="${esc(dollars(s.prices.service))}">
      <label class="l" for="inv-price-replace">${esc(REPLACE)}</label><input class="t" id="inv-price-replace" inputmode="decimal" value="${esc(dollars(s.prices.replace))}">
      <label class="l" for="inv-price-battery">${esc(BATTERY)}</label><input class="t" id="inv-price-battery" inputmode="decimal" value="${esc(dollars(s.prices.battery))}">
      <div class="row"><button type="button" class="btn pri" id="inv-save-settings">Save settings</button></div>
      <p class="note" id="inv-msg">${esc(mem.message||'')}</p>
      </section>
      <section class="f"><h2>Invoices</h2>
      <p class="note">A completed job gets a draft. Change the lines, then issue it. Publish sends only issued invoices, and only to that agency. Export to Xero stays on this phone.</p>
      <div class="row"><button type="button" id="xero-open">Export to Xero</button></div>
      <dialog id="xero-dialog"><h2>Export to Xero</h2><p class="note">Issued invoices that have not been exported are ticked. Amounts exclude GST. Dates are DD/MM/YYYY. Import this file in Xero and choose Tax Exclusive.</p><label class="tog"><span>Include invoices already exported</span><input type="checkbox" id="xero-again"></label><div id="xero-choices"></div><div class="row"><button type="button" class="btn pri" id="xero-download">Download CSV</button><button type="button" id="xero-close">Close</button></div></dialog>
      ${rows.length?rows.map(function(inv){
        const st=displayStatus(inv,today);
        const who=inv.privateOwner?(inv.agencyName||'The owner'):(inv.agencyName||inv.agencyCode);
        return '<article class="card" data-invoice-job="'+esc(inv.jobId)+'"><div class="chiprow"><span class="badge">'+(inv.draft?'Draft':esc(inv.number))+'</span><span class="badge">'+esc(statusLabel(st))+'</span>'+(inv.exportedToXeroAt?'<span class="badge">Exported</span>':'')+'</div><div class="addr">'+esc(inv.address)+'</div><div class="meta">'+esc(who)+' · '+esc(money(inv.totalCents))+'</div><div class="row"><button type="button" data-open-invoice="'+esc(inv.jobId)+'">Review</button></div></article>';
      }).join(''):'<p class="note">No invoices yet. Archive or mark a job done and come back.</p>'}
      </section>
      ${selected?`<section class="f" id="inv-editor"><h2>${selected.draft?'Draft':'Invoice '+esc(selected.number)}</h2>
        <p class="note">${esc(selected.agencyName||selected.agencyCode)} · ${esc(selected.address)}</p>
        <div id="inv-lines">${lines.map(function(line,i){
          return '<div class="alarm"><label class="l">Description</label><input class="t" data-line="'+i+'" data-field="description" value="'+esc(line.description)+'"><div class="grid2"><div><label class="l">Qty</label><input class="t" data-line="'+i+'" data-field="qty" inputmode="numeric" value="'+esc(line.qty)+'"></div><div><label class="l">Price ex GST</label><input class="t" data-line="'+i+'" data-field="price" inputmode="decimal" value="'+esc(dollars(line.unitCents))+'"></div></div><button type="button" data-remove-line="'+i+'">Remove line</button></div>';
        }).join('')}</div>
        <div class="row"><button type="button" id="inv-add-line">Add line</button><button type="button" id="inv-save-lines">Save lines</button></div>
        <p class="note">Subtotal ${esc(money(selected.exCents))}${selected.gstRegistered?' · GST '+esc(money(selected.gstCents)):''} · Total ${esc(money(selected.totalCents))}</p>
        <div class="row"><button type="button" class="btn pri" id="inv-issue">${selected.draft?'Issue invoice':'Issued '+esc(selected.number)}</button><button type="button" id="inv-paid">${selected.paidAt?'Mark unpaid':'Mark paid'}</button></div>
        <div class="row"><button type="button" id="inv-pdf">Download PDF</button></div>
      </section>`:''}`;
    bind(el,today);
  }
  function readSettings(el){
    const service=dollarsToCents(el.querySelector('#inv-price-service').value);
    const replace=dollarsToCents(el.querySelector('#inv-price-replace').value);
    const battery=dollarsToCents(el.querySelector('#inv-price-battery').value);
    if(service==null||replace==null||battery==null)return null;
    return normaliseSettings({
      businessName:el.querySelector('#inv-name').value,
      abn:el.querySelector('#inv-abn').value,
      address:el.querySelector('#inv-address').value,
      phone:el.querySelector('#inv-phone').value,
      email:el.querySelector('#inv-email').value,
      bankName:el.querySelector('#inv-bank').value,
      bsb:el.querySelector('#inv-bsb').value,
      accountNumber:el.querySelector('#inv-acct').value,
      accountName:el.querySelector('#inv-acctname').value,
      termsDays:el.querySelector('#inv-days').value,
      termsText:el.querySelector('#inv-terms').value,
      gstRegistered:el.querySelector('#inv-gst').checked,
      prices:{service:service,replace:replace,battery:battery},
      nextNumber:mem.settings.nextNumber,
      accountCode:el.querySelector('#inv-xero-account').value,
      brandingTheme:el.querySelector('#inv-xero-theme').value
    });
  }
  function readLines(el){
    const boxes=el.querySelectorAll('[data-line][data-field="description"]');
    const lines=[];
    boxes.forEach(function(input){
      const i=input.dataset.line;
      const qty=el.querySelector('[data-line="'+i+'"][data-field="qty"]').value;
      const price=dollarsToCents(el.querySelector('[data-line="'+i+'"][data-field="price"]').value);
      lines.push({description:input.value,qty:+qty||0,unitCents:price==null?0:price,bad:price==null});
    });
    return lines;
  }
  function bind(el,today){
    const saveBtn=el.querySelector('#inv-save-settings');
    if(saveBtn)saveBtn.onclick=function(){
      const next=readSettings(el);
      if(!next){mem.message='Enter prices as dollars and cents, such as 120.00.';paint(el);return}
      mem.settings=next;save();mem.message='Invoice settings saved on this phone.';paint(el);
    };
    el.querySelectorAll('[data-open-invoice]').forEach(function(btn){btn.onclick=function(){mem.selected=btn.dataset.openInvoice;paint(el)}});
    const add=el.querySelector('#inv-add-line');
    if(add)add.onclick=function(){
      const inv=mem.invoices[mem.selected];if(!inv)return;
      inv.lines=(inv.lines||[]).concat([{description:'',qty:1,unitCents:0,amountCents:0}]);
      paint(el);
    };
    el.querySelectorAll('[data-remove-line]').forEach(function(btn){btn.onclick=function(){
      const inv=mem.invoices[mem.selected];if(!inv)return;
      inv.lines=(inv.lines||[]).filter(function(_,i){return String(i)!==btn.dataset.removeLine});
      const summed=totals(inv.lines,inv.gstRegistered);
      Object.assign(inv,summed);save();paint(el);
    }});
    const saveLines=el.querySelector('#inv-save-lines');
    if(saveLines)saveLines.onclick=function(){
      const inv=mem.invoices[mem.selected];if(!inv)return;
      const lines=readLines(el);
      if(lines.some(function(line){return line.bad})){mem.message='A price is not a number of dollars.';paint(el);return}
      Object.assign(inv,applyLines(inv,lines,mem.settings.gstRegistered));
      save();mem.message='Lines saved. Issue the invoice when it is ready to number.';paint(el);
    };
    const issueBtn=el.querySelector('#inv-issue');
    if(issueBtn)issueBtn.onclick=function(){
      const inv=mem.invoices[mem.selected];if(!inv)return;
      const lines=readLines(el);
      if(lines.some(function(line){return line.bad})){mem.message='Fix the prices before issuing.';paint(el);return}
      Object.assign(inv,applyLines(inv,lines,mem.settings.gstRegistered));
      const list=Object.keys(mem.invoices).map(function(id){return mem.invoices[id]});
      const issued=issue(inv,mem.settings,list,today);
      mem.settings=issued.settings;
      mem.invoices[inv.jobId]=issued.invoice;
      save();mem.message='Issued '+issued.invoice.number+'. It is not on the portal until you publish.';paint(el);
    };
    const paid=el.querySelector('#inv-paid');
    if(paid)paid.onclick=function(){
      const inv=mem.invoices[mem.selected];if(!inv||inv.draft){mem.message='Issue the invoice before marking it paid.';paint(el);return}
      mem.invoices[inv.jobId]=markPaid(inv,today,!inv.paidAt);
      save();
      mem.message=mem.invoices[inv.jobId].status==='paid'?'Marked paid. Publish again so the agency sees it.':'Marked unpaid.';
      paint(el);
    };
    function fillXero(includeExported){
      const box=el.querySelector('#xero-choices');
      if(!box)return;
      const list=Object.keys(mem.invoices).map(function(id){return mem.invoices[id]});
      const rows=xeroCandidates(list,true).filter(function(inv){return includeExported||!inv.exportedToXeroAt});
      if(!rows.length){box.innerHTML='<p class="note">No issued invoices to export.</p>';return}
      box.innerHTML=rows.map(function(inv){
        const checked=!inv.exportedToXeroAt?' checked':'';
        return '<label class="tog"><span>'+esc(inv.number)+' · '+esc(xeroContact(inv))+' · '+esc(inv.address)+(inv.exportedToXeroAt?' · already exported':'')+'</span><input type="checkbox" data-xero="'+esc(inv.jobId)+'"'+checked+'></label>';
      }).join('');
    }
    const openXero=el.querySelector('#xero-open');
    const dialog=el.querySelector('#xero-dialog');
    if(openXero&&dialog)openXero.onclick=function(){
      const again=el.querySelector('#xero-again');
      if(again)again.checked=false;
      fillXero(false);
      if(dialog.showModal)dialog.showModal();
      else dialog.setAttribute('open','');
    };
    const again=el.querySelector('#xero-again');
    if(again)again.onchange=function(){fillXero(again.checked)};
    const closeXero=el.querySelector('#xero-close');
    if(closeXero&&dialog)closeXero.onclick=function(){if(dialog.close)dialog.close();else dialog.removeAttribute('open')};
    const downloadXero=el.querySelector('#xero-download');
    if(downloadXero)downloadXero.onclick=function(){
      const picked=[].map.call(el.querySelectorAll('[data-xero]:checked'),function(box){return mem.invoices[box.dataset.xero]}).filter(Boolean);
      if(!picked.length){mem.message='Tick at least one invoice.';paint(el);return}
      const csv=xeroCsv(picked,mem.settings);
      const stamp=new Date().toISOString();
      markExported(picked,stamp).forEach(function(inv){mem.invoices[inv.jobId]=inv});
      save();
      const blob=new Blob([csv],{type:'text/csv'});
      const a=document.createElement('a');
      const url=URL.createObjectURL(blob);
      a.href=url;a.download='xero-sales-invoices.csv';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url)},4000);
      mem.message='CSV downloaded. These invoices are marked exported on this phone. Import the file in Xero.';
      paint(el);
    };
    const pdf=el.querySelector('#inv-pdf');
    if(pdf)pdf.onclick=function(){
      const inv=mem.invoices[mem.selected];if(!inv)return;
      const doc=Object.assign({},toPortal(Object.assign({},inv,{draft:false,number:inv.number||'INV-0000',issueDate:inv.issueDate||today,dueDate:inv.dueDate||today}),mem.settings,today,today),{today:today});
      if(!doc)return;
      const bytes=buildInvoicePdf(doc);
      const blob=new Blob([bytes],{type:'application/pdf'});
      const a=document.createElement('a');
      const url=URL.createObjectURL(blob);
      a.href=url;a.download=fileName(doc);document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url)},4000);
    };
  }
  function mount(el,nextHooks){
    hooks=nextHooks||hooks||{};
    load();
    syncDrafts();
    if(el)paint(el);
  }

  return {
    KEYS:KEYS,LINE_KEYS:LINE_KEYS,SERVICE:SERVICE,REPLACE:REPLACE,BATTERY:BATTERY,
    defaultSettings:defaultSettings,normaliseSettings:normaliseSettings,money:money,dollarsToCents:dollarsToCents,
    totals:totals,suggestLines:suggestLines,formatNumber:formatNumber,nextFree:nextFree,
    draftFromJob:draftFromJob,applyLines:applyLines,issue:issue,markPaid:markPaid,displayStatus:displayStatus,statusLabel:statusLabel,
    toPortal:toPortal,tenantHits:tenantHits,sameKeys:sameKeys,filterInvoices:filterInvoices,
    XERO_HEADERS:XERO_HEADERS,xeroCsv:xeroCsv,xeroRows:xeroRows,xeroCandidates:xeroCandidates,xeroContact:xeroContact,xeroTax:xeroTax,markExported:markExported,
    viewModel:viewModel,fileName:fileName,buildInvoicePdf:buildInvoicePdf,demoInvoices:demoInvoices,sampleSettings:sampleSettings,
    portalCopies:portalCopies,syncDrafts:syncDrafts,mount:mount
  };
});
