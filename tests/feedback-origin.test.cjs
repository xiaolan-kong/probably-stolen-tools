const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/assets/feedback-config.js'),'utf8'),context);
const origin=process.env.FEEDBACK_TEST_ORIGIN||(process.env.PAGES_OWNER?`https://${process.env.PAGES_OWNER.toLowerCase()}.github.io`:null);
assert(origin,'Set PAGES_OWNER or FEEDBACK_TEST_ORIGIN to the actual frontend origin');
(async()=>{
 const response=await fetch(context.window.PS_FEEDBACK.apiBase+'/tickets',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,204,`Feedback origin is not ready: ${origin}`);
 assert.equal(response.headers.get('access-control-allow-origin'),origin);
 console.log(`PASS: feedback accepts ${origin}`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
