const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../dist/assets/analytics.js'),'utf8');
function check(origin,page){const calls=[];vm.runInNewContext(script,{location:{origin},document:{currentScript:{dataset:{page}}},feedbackRequest:(route,options)=>{calls.push({route,options});return Promise.resolve({ok:true});}});return calls;}
for(const page of ['calculator','feedback']){
 const calls=check('https://xiaolan-kong.github.io',page);assert.equal(calls.length,1);
 assert.equal(calls[0].route,'/page-view');assert.deepEqual(JSON.parse(calls[0].options.body),{page});assert.equal(calls[0].options.credentials,'omit');
}
for(const origin of ['null','http://localhost:8765','http://127.0.0.1:8765','https://example.com'])assert.equal(check(origin,'calculator').length,0);
assert.equal(check('https://xiaolan-kong.github.io','admin').length,0);
vm.runInNewContext(script,{location:{origin:'https://xiaolan-kong.github.io'},document:{currentScript:{dataset:{page:'calculator'}}},feedbackRequest:()=>Promise.reject(Error('offline'))});
assert(!/localStorage|cookie|referrer|location\.(href|search|hash)|querySelector|userAgent/.test(script));
console.log('PASS: production-only PV; fixed page payload; no credential, URL, form or visitor identifier; failure is nonblocking.');
