const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../dist/assets/analytics.js'),'utf8');
function check(origin,page){const calls=[];vm.runInNewContext(script,{location:{origin},document:{currentScript:{dataset:{page}}},feedbackRequest:(route,options)=>{calls.push({route,options});return Promise.resolve({ok:true});}});return calls;}
for(const page of ['calculator','assembler','feedback']){
 const calls=check('https://xiaolan-kong.github.io',page);assert.equal(calls.length,1);
 assert.equal(calls[0].route,'/page-view');assert.deepEqual(JSON.parse(calls[0].options.body),{page});assert.equal(calls[0].options.credentials,'omit');
}
for(const origin of ['null','http://localhost:8765','http://127.0.0.1:8765','https://example.com'])assert.equal(check(origin,'calculator').length,0);
assert.equal(check('https://xiaolan-kong.github.io','admin').length,0);
vm.runInNewContext(script,{location:{origin:'https://xiaolan-kong.github.io'},document:{currentScript:{dataset:{page:'calculator'}}},feedbackRequest:()=>Promise.reject(Error('offline'))});
assert(!/localStorage|cookie|referrer|location\.(href|search|hash)|querySelector|userAgent/.test(script));
console.log('PASS: production-only PV; fixed page payload; no credential, URL, form or visitor identifier; failure is nonblocking.');

// Every public tool must wire the tracker; adding a whitelist entry alone is insufficient.
for(const [file,page] of [['index.html','calculator'],['assembler.html','assembler'],['feedback.html','feedback']]){
 const html=fs.readFileSync(path.join(__dirname,'../dist',file),'utf8');
 assert.match(html,new RegExp('<script[^>]+src="assets/analytics\\.js[^" ]*"[^>]+data-page="'+page+'"'));
 assert(html.indexOf('assets/feedback-common.js')<html.indexOf('assets/analytics.js'));
}
assert.equal(check('https://xiaolan-kong.github.io','unknown').length,0);
(async()=>{
 const elements=new Map();
 const element=()=>({children:[],textContent:'',addEventListener(){},append(child){this.children.push(child);},replaceChildren(){this.children=[];}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 let rows=[{day:'2026-10-15',page:'calculator',views:3},{day:'2026-10-15',page:'assembler',views:7},{day:'2026-10-15',page:'feedback',views:2},{day:'2026-10-14',page:'calculator',views:5}];
 const context=vm.createContext({document:{getElementById:get,createElement:element},feedbackBase:'test',feedbackRequest:async()=>rows});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/assets/feedback-admin.js'),'utf8'),context);
 await vm.runInContext('loadAnalytics()',context);
 assert.deepEqual(get('analytics-rows').children.map(tr=>tr.children.map(td=>td.textContent)),[['2026-10-15','12','3','7','2'],['2026-10-14','5','5','0','0']]);
 assert.match(get('analytics-status').textContent,/17 次/);
 rows=[{day:'2026-10-15',page:'assembler',views:1}];
 await vm.runInContext('loadAnalytics()',context);
 assert.deepEqual(get('analytics-rows').children.map(tr=>tr.children.map(td=>td.textContent)),[['2026-10-15','1','0','1','0']]);
 rows=[];await vm.runInContext('loadAnalytics()',context);
 assert.equal(get('analytics-rows').children.length,0);
 assert.match(get('analytics-status').textContent,/0 次/);
 console.log('PASS: all three page entrypoints; separate assembler column, daily and period totals, historical zeros, reload and empty results.');
})().catch(error=>{console.error(error);process.exitCode=1;});
