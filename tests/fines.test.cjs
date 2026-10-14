const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../dist/assets/crime-model.js');
const base = {amounts:[299],progress:100,rep:60,upper:27,cooldown:14,officer:'queued',cash:299};
const solve = (more={}, fixer=false, evidence=false) => M.solve({...base,...more},fixer,evidence);
for (const amount of [1,99,100,204,299]) {
  const p=solve({amounts:[amount],cash:amount});
  assert.equal(p.status,'fine');assert.equal(p.fineTotal,amount);assert.equal(p.cashLeft,0);
  assert.equal(p.loss,10);assert.equal(p.days,0);assert.equal(p.rows[0].progress,0);assert.equal(p.rows[0].total,0);
  assert.equal(solve({amounts:[amount],cash:amount-1}).status,'none');
}
assert.equal(solve({amounts:[300],cash:1000}).status,'none');
assert.equal(solve({amounts:[100,199]}).status,'fine');
assert.equal(solve({amounts:[150,150]}).status,'none');
assert.equal(solve({rep:-90}).status,'none');
assert.equal(solve({rep:-89.999}).status,'fine');
assert.equal(solve({upper:-60,rep:-80}).status,'none');
assert.equal(solve({upper:-60,rep:-79.999}).loss,20);
assert.equal(solve({officer:'dialogue'}).status,'dialogue');
assert.equal(solve({amounts:[0],cash:0}).loss,20); // No fine: already-cleared pending case.
assert.equal(solve({cash:298,cooldown:0},true,true).status,'clear'); // Can remove evidence instead.
assert.equal(solve({cooldown:0},true,true).loss,10); // Not 10+20; no unnecessary services.
const immediate=M.planOptions({...base,cooldown:0},true,true).filter(M.success);
assert.equal(immediate.length,1);assert(!immediate[0].fixer && !immediate[0].evidence);
assert.throws(()=>solve({cash:-1}));assert.throws(()=>solve({cash:NaN}));assert.throws(()=>solve({cash:1.5}));
assert.equal(solve({amounts:[100],progress:0,officer:'auto'}).fineTotal,0);

// Independent reachability oracle: no loss-budget heuristic or result builder.
function reachable(amount,rep,fixer,evidence,cash=299) {
  const seen=new Set();
  function walk(a,p,r,c,queued) {
    if(r<=-100)return false;
    const k=[a,p,r,c,queued].join('/');if(seen.has(k))return false;seen.add(k);
    if(queued && p>=95 && a>0 && a<300 && cash>=a && r-10>-100)return true;
    if(queued)r-=20;
    if(r<=-100)return false;
    if(a===0)return true;
    for(const clear of [false,true]) {
      if(clear && (!evidence || c>0 || p===0))continue;
      if(queued && p>=95 && a>0 && !clear)continue;
      const before=clear?0:p;
      let next=fixer?Math.max(0,a-Math.trunc(Math.fround(Math.fround(a)*Math.fround(.15)))-50):a;
      if(before<80)next=Math.max(0,next-20);
      let rate=next<100?0:next<300?2:next<850?6:next<1200?9:next<1500?12:next<2500?20:33;
      if(r>=60)rate=Math.floor(rate/2);
      else if(r<=-60)rate=roundEven(rate*1.5);
      else if(r<=-20)rate=roundEven(rate*Math.fround(1.2));
      const np=Math.min(100,before+rate);
      if(walk(next,np,r,Math.max(0,(clear?14:c)-1),np>=100 && next>0))return true;
    }
    return false;
  }
  return walk(amount,0,rep,0,false);
}
function roundEven(x){const n=Math.floor(x);return x-n===.5?n+(n%2):Math.round(x);}
const caps=[[80,839,4738,15645],[60,839,4738,13276],[1,579,2731,5617],[0,579,2731,4738],[-20,539,2252,3927],[-40,539,2252,3637],[-60,479,2052,3263],[-80,419,1845,3022]];
const methods=[[false,false],[true,false],[true,true]];
for(const [label,...values] of caps)for(const [j,[fixer,evidence]] of methods.entries()) {
  const rep=label>=60?label:(label===1?0:label-20)+1e-9,cap=values[j];
  assert.equal(M.maxAmount({...base,rep,progress:0,cooldown:0,officer:'auto'},fixer,evidence).amount,cap);
  assert(reachable(cap,rep,fixer,evidence),`${label}/${j}: independently reachable cap`);
  assert(!reachable(cap+1,rep,fixer,evidence),`${label}/${j}: independently rejected cap+1`);
  for(const amount of [0,Math.floor(cap/2),cap,cap+1,cap+20,30000]) {
    const result=M.solve({...base,amounts:[amount],rep,progress:0,cooldown:0,officer:'auto'},fixer,evidence);
    assert.notEqual(result.status,'limit');assert.equal(M.success(result),reachable(amount,rep,fixer,evidence),`${label}/${j}/${amount}`);
  }
}
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
// Fine-related reputation cutoffs must not be hidden inside the old broad bands.
for(const [rep,values] of [[-60,[479,2052,3600]],[-69.999,[479,2052,3600]],[-70,[479,2052,3263]],[-80,[479,2052,3022]],[-89.999,[479,2052,3022]],[-90,[419,1845,3022]]]) {
 for(const [j,[fixer,evidence]] of methods.entries()) {
  const cap=values[j];
  assert.equal(M.maxAmount({...base,rep,progress:0,cooldown:0,officer:'auto'},fixer,evidence).amount,cap);
  assert(reachable(cap,rep,fixer,evidence));assert(!reachable(cap+1,rep,fixer,evidence));
 }
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique');
assert(!html.includes('id="cash"'));assert(!html.includes('id="rep-exact"'));assert(!html.includes('id="confirm-fine-rep"'));
assert.match(html,/<input id="rep" type="number" step="any" required/);
assert.match(html,/<tbody id="caps-values">/);

// Exact reputation, dispatched officer and stalled small crimes need distinct caps.
for(const more of [{rep:-95},{rep:-85},{rep:-90,progress:100},{rep:-89,progress:100},{rep:60,upper:-60,progress:100,cooldown:7},{rep:60,progress:80},{rep:60,progress:95}]) {
  const i={...base,progress:0,cooldown:0,officer:'auto',...more};
  const cap=M.maxAmount(i,false,false);
  let brute=-1;
  for(let amount=0;amount<=1000;amount++)if(M.success(M.solve({...i,amounts:[amount]},false,false)))brute=amount;
  assert.equal(M.success(cap)?cap.amount:-1,brute,JSON.stringify(more));
}
assert.equal(M.maxAmount({...base,officer:'dialogue'},true,true).status,'dialogue');
assert.equal(M.maxAmount({...base,rep:-100},true,true).status,'reputation');

// A second case after a fine must use the remaining money and reduced reputation.
const future={...base,amounts:[100],rep:60,cash:500,additions:[{day:2,amount:579}]};
const twice=M.solve(future,false,false);
assert.equal(twice.status,'fine');assert.equal(twice.fineTotal,399);assert.equal(twice.cashLeft,101);assert.equal(twice.loss,20);
assert.equal(twice.rows[1].delta,6); // Lost trust: rate 6, not 3.
assert.equal(M.solve({...future,cash:398},false,false).status,'none');
assert.equal(M.solve({...future,rep:-85},false,false).status,'none');
console.log('PASS: fine 1/99/100/204/299 vs 300; exact cash and -100 boundaries; doubled loss; exclusive penalties; actual services; subsequent cases; 24 cap/+1 pairs plus exact-reputation maxima and dispatched-officer cases checked independently.');
