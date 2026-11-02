const C='ccsa-v2.1.1-6c1d30e2';const F=['./','index.html','manifest.webmanifest','icon-32.png','icon-180.png','icon-192.png','icon-512.png'];
const O=['ocr/tesseract.min.js','ocr/worker.min.js','ocr/eng.traineddata.gz'];
function simd(){try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]))}catch(e){return false}}
const rq=u=>new Request(u,{cache:'reload'});
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(async c=>{await c.addAll(F.map(rq));const v=simd()?'simd-':'';
  try{await c.addAll([...O,'ocr/tesseract-core-'+v+'lstm.js','ocr/tesseract-core-'+v+'lstm.wasm'].map(rq))}catch(err){}}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok&&u.origin===location.origin&&u.pathname.includes('/ocr/')){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl))}return res}).catch(()=>e.request.mode==='navigate'?caches.match('index.html'):Response.error())))});
