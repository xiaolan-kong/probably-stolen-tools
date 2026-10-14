const assert = require('node:assert/strict');
const M = require('../dist/assets/crime-model.js');
const input = (a, rep = 60, progress = 0, more = {}) => ({amounts: [a], rep, progress, upper: 27, cooldown: 0, officer: 'auto', ...more});
const caps = [[80,15645],[60,13276],[1,5600],[0,4722],[-20,3927],[-40,3637],[-60,3263],[-80,3022]];
for (const [rep, amount] of caps) {
  assert.equal(M.solve(input(amount,rep),true,true).status,'clear', `${rep} at cap`);
  assert.equal(M.solve(input(amount+1,rep),true,true).status,'none', `${rep} above cap`);
}
const early = M.solve(input(13276),true,true);
assert.equal(early.loss,0); assert.equal(early.resets[0].resetAt,6); assert.equal(early.resets[0].before,96);
const late = M.solve(input(15645,80),true,true);
assert.equal(late.loss,20); assert.equal(late.resets[0].resetAt,7);
assert.equal(M.solve(input(4000,60,100),true,true).status,'none');
assert.equal(M.solve(input(4000,80,100),true,true).status,'clear');
for (const [rep, cap] of [[80,4738],[60,2721],[0,2252],[-40,1845]]) {
  assert.equal(M.solve(input(cap,rep,100),true,true).status,'clear');
  assert.equal(M.solve(input(cap+1,rep,100),true,true).status,'none');
}
assert.equal(M.solve(input(10,-80,100),true,true).status,'none');
assert.equal(M.solve(input(100,60,100,{cooldown:1}),true,true).status,'none');
assert.equal(M.solve(input(100,60,0,{officer:'dialogue'}),true,true).status,'dialogue');
assert.equal(M.solve(input(0,60,0,{officer:'queued'}),false,false).loss,20);
assert.equal(M.solve(input(100,60,0,{officer:'queued',upper:-60}),true,true).loss,40);
assert.equal(M.tomorrow(input(3000,0,79),true,false).total,2480);
assert.equal(M.tomorrow(input(3000,0,80),true,false).progress,100);
assert.equal(M.tomorrow(input(3000,0,80),true,true).progress,20);
assert.equal(M.tomorrow(input(0,60,0,{officer:'dialogue'}),false,false).blocked.includes('处罚'),true);
assert.equal(M.tomorrow(input(1788,0,40,{amounts:[38,1750]}),true,false).total,1418);
assert.throws(()=>M.solve(input(NaN),true,true));
assert.throws(()=>M.solve(input(-1),true,true));
assert.throws(()=>M.solve(input(1,60,101),true,true));
for (const [a,r,p] of [[100,60,0],[1000,0,79],[3000,-20,80],[5600,1,0]]) {
  const result=M.solve(input(a,r,p),true,true);
  if(result.status !== 'clear') continue;
  let lastReset=-14;
  for(const row of result.rows){if(row.resetAt!==null){assert(row.resetAt-lastReset>=14);lastReset=row.resetAt;}assert(row.rep>-100);}
}
const simple = M.planOptions(input(1788,0,40),true,true).filter(p=>p.status==='clear');
assert.equal(simple.length,1);
assert.equal(simple[0].fixer,true);assert.equal(simple[0].evidence,false);assert.equal(simple[0].resets.length,0);
const zero=M.planOptions(input(0),true,true).filter(p=>p.status==='clear');
assert.equal(zero.length,1);assert.equal(zero[0].fixer,false);assert.equal(zero[0].evidence,false);
const combined=M.planOptions(input(13276),true,true).filter(p=>p.status==='clear');
assert.equal(combined.length,1);assert.equal(combined[0].evidence,true);
assert(M.planOptions(input(1788,0,40),true,false).every(p=>!p.evidence));
assert(M.planOptions(input(1788,0,40),false,true).every(p=>!p.fixer));
assert.equal(M.tier(60),'值得信赖');assert.equal(M.tier(-20),'重点盯防');assert.equal(M.tier(-60),'头号通缉');
console.log('PASS: maximum/+1 bands; −20/−40; cooldown; timing; split crimes; validation; actual-service deduplication; native perk names.');
