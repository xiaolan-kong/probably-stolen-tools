const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../dist/assets/analytics.js'),'utf8');
function check(origin,page,storage={getItem:()=>null}){const calls=[];vm.runInNewContext(script,{localStorage:storage,location:{origin},document:{currentScript:{dataset:{page}}},feedbackRequest:(route,options)=>{calls.push({route,options});return Promise.resolve({ok:true});}});return calls;}
for(const page of ['calculator','assembler','feedback','guides']){
 const calls=check('https://xiaolan-kong.github.io',page);assert.equal(calls.length,1);
 assert.equal(calls[0].route,'/page-view');assert.deepEqual(JSON.parse(calls[0].options.body),{page});assert.equal(calls[0].options.credentials,'omit');
}
for(const origin of ['null','http://localhost:8765','http://127.0.0.1:8765','https://example.com'])assert.equal(check(origin,'calculator').length,0);
assert.equal(check('https://xiaolan-kong.github.io','admin').length,0);
vm.runInNewContext(script,{location:{origin:'https://xiaolan-kong.github.io'},document:{currentScript:{dataset:{page:'calculator'}}},feedbackRequest:()=>Promise.reject(Error('offline'))});
assert(!/cookie|referrer|location\.(href|search|hash)|querySelector|userAgent/.test(script));
for(const page of ['calculator','assembler','feedback','guides']){
 assert.equal(check('https://xiaolan-kong.github.io',page,{getItem:key=>{assert.equal(key,'ps-tools-admin-pv-until');return String(Date.now()+60000);}}).length,0);
 for(const value of [null,'garbage','0',String(Date.now()-1)])assert.equal(check('https://xiaolan-kong.github.io',page,{getItem:()=>value}).length,1);
 assert.equal(check('https://xiaolan-kong.github.io',page,{getItem(){throw Error('blocked');}}).length,1);
}
console.log('PASS: production-only PV; fixed page payload; no credential, URL, form or visitor identifier; failure is nonblocking.');

// Every public tool must wire the tracker; adding a whitelist entry alone is insufficient.
for(const [file,page] of [['index.html','calculator'],['assembler.html','assembler'],['feedback.html','feedback'],...['guides.html','guide-return-customers.html','guide-water-recipes.html','guide-crime-cleanup.html','guide-water-formal.html','guide-crime-visual.html'].map(file=>[file,'guides'])]){
 const html=fs.readFileSync(path.join(__dirname,'../dist',file),'utf8');
 assert.match(html,new RegExp('<script[^>]+src="assets/analytics\\.js[^" ]*"[^>]+data-page="'+page+'"'));
 assert(html.indexOf('assets/feedback-common.js')<html.indexOf('assets/analytics.js'));
}
assert.equal(check('https://xiaolan-kong.github.io','unknown').length,0);
(async()=>{
 const elements=new Map();
 const element=()=>({children:[],textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},append(child){this.children.push(child);},replaceChildren(){this.children=[];}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 let rows=[{day:'2026-10-15',page:'calculator',views:3},{day:'2026-10-15',page:'assembler',views:7},{day:'2026-10-15',page:'feedback',views:2},{day:'2026-10-15',page:'guides',views:4},{day:'2026-10-14',page:'calculator',views:5}];
 const stored=new Map(),storage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};
 let rejectLogin=false;
 const context=vm.createContext({localStorage:storage,document:{getElementById:get,createElement:element},feedbackBase:'test',feedbackRequest:async route=>{if(route==='/admin/login'){if(rejectLogin)throw Error('wrong password');return {accessToken:'secret-test-token',expiresIn:3600};}return rows;}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/assets/feedback-admin.js'),'utf8'),context);
 await vm.runInContext('loadAnalytics()',context);
 assert.deepEqual(get('analytics-rows').children.map(tr=>tr.children.map(td=>td.textContent)),[['2026-10-15','16','3','7','2','4'],['2026-10-14','5','5','0','0','0']]);
 assert.match(get('analytics-status').textContent,/21 次/);
 rows=[{day:'2026-10-15',page:'assembler',views:1}];
 await vm.runInContext('loadAnalytics()',context);
 assert.deepEqual(get('analytics-rows').children.map(tr=>tr.children.map(td=>td.textContent)),[['2026-10-15','1','0','1','0','0']]);
 rows=[];await vm.runInContext('loadAnalytics()',context);
 assert.equal(get('analytics-rows').children.length,0);
 assert.match(get('analytics-status').textContent,/0 次/);
 const login=()=>get('admin-login').listeners.submit({preventDefault(){},currentTarget:get('admin-login')});
 rejectLogin=true;await login();assert.equal(stored.size,0,'failed login must not exclude visits');
 rejectLogin=false;await login();
 assert.deepEqual([...stored.keys()],['ps-tools-admin-pv-until']);assert(Number(stored.get('ps-tools-admin-pv-until'))>Date.now());
 assert(!JSON.stringify([...stored]).includes('secret-test-token'),'never persist credentials');
 assert.equal(check('https://xiaolan-kong.github.io','guides',storage).length,0,'another tab shares the exclusion');
 get('admin-logout').listeners.click();assert.equal(stored.size,0);
 assert.equal(check('https://xiaolan-kong.github.io','guides',storage).length,1,'logout restores future counting');
 context.localStorage={setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 await login();assert.equal(get('admin-workspace').hidden,false,'blocked storage must not block login');assert.match(get('admin-pv-status').textContent,/无法排除/);
 console.log('PASS: all public page entrypoints; separate assembler and guides columns, daily and period totals, historical zeros, reload and empty results.');
 console.log('PASS: successful admin login excludes same-browser tabs without persisting credentials; failed login, expiry, logout and blocked storage are handled.');
})().catch(error=>{console.error(error);process.exitCode=1;});
