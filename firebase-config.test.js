const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const cfg=require('./firebase-config.js');

test('Firebase Hosting uses its own host as the auth domain and GitHub Pages does not',function(){
  assert.equal(cfg.authDomainFor('ccsa-smoke-log.web.app','ccsa-smoke-log.firebaseapp.com'),'ccsa-smoke-log.firebaseapp.com');
  assert.equal(cfg.authDomainFor('ccsa-smoke-log.firebaseapp.com','ccsa-smoke-log.firebaseapp.com'),'ccsa-smoke-log.firebaseapp.com');
  assert.equal(cfg.authDomainFor('CCSA-SMOKE-LOG.WEB.APP','ccsa-smoke-log.firebaseapp.com'),'ccsa-smoke-log.firebaseapp.com');
  assert.equal(cfg.authDomainFor('adamcw68.github.io','ccsa-smoke-log.firebaseapp.com'),'ccsa-smoke-log.firebaseapp.com');
  assert.equal(cfg.authDomainFor('127.0.0.1','ccsa-smoke-log.firebaseapp.com'),'ccsa-smoke-log.firebaseapp.com');
  assert.equal(cfg.authDomainFor('','ccsa-smoke-log.firebaseapp.com'),'ccsa-smoke-log.firebaseapp.com');
});

test('hosting serves the app, does not cache the worker, and leaves portal files alone',function(){
  const hosting=JSON.parse(fs.readFileSync('firebase.json','utf8')).hosting;
  assert.equal(hosting.public,'.');
  const header=function(source){return hosting.headers.find(function(h){return h.source===source})};
  assert.equal(header('/index.html').headers[0].value,'no-cache');
  assert.equal(header('/sw.js').headers[0].value,'no-cache');
  assert.equal(header('/firebase-config.js').headers[0].value,'no-cache');
  assert.equal(hosting.rewrites[0].destination,'/portal/index.html');
  assert.equal(hosting.rewrites[1].destination,'/index.html');
  const workflow=fs.readFileSync('.github/workflows/firebase-hosting.yml','utf8');
  assert.match(workflow,/ccsa-smoke-log/);
  assert.match(workflow,/FIREBASE_SERVICE_ACCOUNT_CCSA_SMOKE_LOG/);
  assert.match(workflow,/channelId: live/);
});
