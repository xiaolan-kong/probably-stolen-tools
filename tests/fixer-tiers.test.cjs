const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../dist/assets/crime-model.js');
const input = (amounts, more = {}) => ({amounts, progress:0, rep:0, upper:0, cooldown:0, officer:'auto', ...more});
// Current-build IL parameters, also recorded in the 2026-10-30 unified evidence table.
const parameters = [[1,.15,50,25],[2,.20,150,45],[3,.25,400,70]];
const reduce = (a, rate, flat) => Math.max(0, a - Math.trunc(Math.fround(Math.fround(a)*Math.fround(rate))) - flat);
assert.deepEqual(parameters.map(([t])=>M.clean(1000,t)),[800,650,350]);
assert.throws(()=>M.solve(input([100],{fixerTier:0}),true,true),/等级/);
assert.throws(()=>M.solve(input([100],{fixerTier:2.5}),true,true),/等级/);
assert.equal(M.clean(1000),800, 'Legacy callers default to tier 1');
let checks = 0;
for (const [fixerTier,rate,flat,fee] of parameters) {
  assert.equal(M.fixerTiers[fixerTier].fee,fee);
  for (const amount of [0,1,38,99,299,300,849,1000,1499,2500,3000,9150,17736,10000000]) {
    assert.equal(M.clean(amount,fixerTier),reduce(amount,rate,flat));
    for (const progress of [0,79,80,99]) for (const reset of [false,true]) {
      const amounts = [38,amount], next=M.tomorrow(input(amounts,{fixerTier,progress}),true,reset);
      const decay = (reset || progress<80) ? 20 : 0;
      assert.equal(next.total,amounts.reduce((sum,a)=>sum+Math.max(0,reduce(a,rate,flat)-decay),0));
      checks++;
    }
  }
  for (const amount of [300,1000,3000,9000]) for (const rep of [60,0,-20,-60]) for (const progress of [0,79,80,100]) {
    const i=input([38,amount],{fixerTier,rep,progress,cash:299});
    for(const p of M.planOptions(i,true,true).filter(M.success)) {
      assert.equal(p.fixerTier,fixerTier);
      let amounts=[...i.amounts], lastReset=-14;
      for(const row of p.rows) {
        assert.equal(row.startTotal,M.sum(amounts));
        if(row.resetAt!==null){assert(row.resetAt-lastReset>=14);lastReset=row.resetAt;}
        if(row.fine){assert.equal(row.fine,M.sum(amounts));assert(row.fine<300);amounts=[0];}
        else if(!row.eventOnly) {
          if(p.fixer)amounts=amounts.map(a=>reduce(a,rate,flat));
          if(row.resetAt!==null || row.before<80)amounts=amounts.map(a=>Math.max(0,a-20));
        }
        assert.equal(row.total,M.sum(amounts));
        assert(row.rep>-100);
      }
      assert.equal(M.sum(amounts),0);
      checks++;
    }
  }
}
// Strict guide caps must not be confused with the rescue planner's larger caps.
for(const [t,none,once] of [[1,2721,4722],[2,4270,9150],[3,6512,17736]]) {
  for(const [cap,evidence] of [[none,false],[once,true]]) {
    const p=M.solve(input([cap],{fixerTier:t}),true,evidence);
    assert.equal(p.status,'clear');assert.equal(p.loss,0);
    assert(p.rows.every(r=>r.progress<100));assert(p.resets.length<=Number(evidence));
    const above=M.solve(input([cap+1],{fixerTier:t}),true,evidence);
    assert(!M.success(above)||above.loss>0||above.rows.some(r=>r.progress===100));
  }
}
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
for(const cap of [499,779,2721,4722,4270,9150,6512,17736])assert(html.includes(`<td>${cap}</td>`));
assert(html.includes('不包含罚款或派警后补救'));
console.log(`PASS: ${checks} tier transitions and complete plan replays; strict caps and +1; tier validation.`);
