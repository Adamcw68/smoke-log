/* FIREBASE WEB CONFIG
   These are the public web-app values (Firebase console → Project settings → Your apps).
   They are not a secret. Firestore rules allow each person to read and write only users/{their uid}.
   Storage is not used. Photos are stored as Firestore documents.
   If a value is replaced with a YOUR_ placeholder, sync turns off and the app stays on this device.
   On Firebase Hosting the auth domain is this site, so /__/auth stays on the same origin.
   GitHub Pages cannot host that handler, so it keeps ccsa-smoke-log.firebaseapp.com. */
(function(root){
  function authDomainFor(host, fallback){
    const h=String(host||'').toLowerCase();
    const fb=fallback||'ccsa-smoke-log.firebaseapp.com';
    if(/\.web\.app$/i.test(h)||/\.firebaseapp\.com$/i.test(h))return h;
    return fb;
  }
  let host='';
  try{host=root.location&&root.location.hostname||''}catch(e){}
  const cfg={
    apiKey:'AIzaSyCYVYUzIQNzIjRo8Aj3l7PNOXRZ49h1q28',
    authDomain:authDomainFor(host,'ccsa-smoke-log.firebaseapp.com'),
    projectId:'ccsa-smoke-log',
    storageBucket:'ccsa-smoke-log.firebasestorage.app',
    messagingSenderId:'344013900197',
    appId:'1:344013900197:web:fb8c28257b364c6a89804c'
  };
  root.CCSA_FIREBASE=cfg;
  const api={authDomainFor:authDomainFor};
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
