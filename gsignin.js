/* When the job list shows a Google Calendar button, and what that tap does.
   This does not request a token, change stored jobs, or choose a wider scope.
   Write access stays a separate consent step in the app. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CCSASignIn=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const WRITE_SCOPE='https://www.googleapis.com/auth/calendar.events';
  function calendarButtonLabel(s){
    s=s||{};
    if(s.syncing)return 'Syncing calendar…';
    if(!s.live)return '📅 Refresh order from calendar';
    if(s.connected&&s.tokenFresh)return '📅 Refresh order from calendar';
    return '🔗 Connect Google Calendar';
  }
  /* The connect control belongs on the list even when no job sheet is loaded. */
  function connectBarOnList(){return true}
  function signInAction(s){
    s=s||{};
    if(!s.live)return {action:'import-file',prompt:null,waitForGis:false,writes:false};
    if(s.tokenFresh)return {action:'sync',prompt:'',waitForGis:false,writes:false};
    return {action:'sign-in',prompt:s.connected?'':'consent',waitForGis:!s.gisReady,writes:false};
  }
  function jobReadAction(s){
    s=s||{};
    if(!s.live||s.offline||s.syncing)return {action:'stop',reason:s.syncing?'busy':s.offline?'offline':'unavailable',writes:false};
    if(s.connected&&s.tokenFresh)return {action:'read',writes:false};
    return {action:'sign-in-then-read',prompt:s.connected?'':'consent',waitForGis:!s.gisReady,writes:false};
  }
  /* Same rule as before: a connected session that cannot edit still needs its own Allow step. */
  function showWriteConsent(s){
    s=s||{};
    return !!(s.live&&s.connected&&!s.canWrite);
  }
  return {WRITE_SCOPE:WRITE_SCOPE,calendarButtonLabel:calendarButtonLabel,connectBarOnList:connectBarOnList,signInAction:signInAction,jobReadAction:jobReadAction,showWriteConsent:showWriteConsent};
});
