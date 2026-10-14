const assert=require('node:assert/strict');
const M=require('../dist/assets/crime-model.js');
const base={amounts:[100],rep:0,progress:0,upper:27,cooldown:0,officer:'auto'};
const i={...base,additions:[{day:2,amount:500}]};
const p=M.solve(i,true,false);
assert.equal(p.status,'clear');
assert.equal(p.rows[0].total,15);assert.equal(p.rows[0].progress,0);
assert.equal(p.rows[1].startTotal,515);assert.equal(p.rows[1].added,500);
assert.equal(p.rows[1].total,368);assert.equal(p.rows[1].progress,6);
assert.deepEqual(M.tomorrow(i,true,false),{total:515,delta:0,progress:0,rep:0});
const delayed=M.solve({...base,amounts:[0],additions:[{day:5,amount:100}]},true,false);
assert.equal(delayed.status,'clear');assert(delayed.days>=5);assert.equal(delayed.rows[4].startTotal,100);
assert.equal(delayed.rows[0].total,0);
assert.equal(M.solve({...base,amounts:[0],additions:[{day:2,amount:100000}]},true,false).status,'none');
const combined=M.solve({...base,amounts:[38,1750],additions:[{day:2,amount:10},{day:2,amount:20}]},true,true);
assert.equal(combined.status,'clear');assert.equal(combined.rows[0].total,1450);assert.equal(combined.rows[1].startTotal,1480);
assert.throws(()=>M.solve({...base,additions:[{day:1,amount:100}]},true,true));
assert.throws(()=>M.solve({...base,additions:[{day:2,amount:-1}]},true,true));
assert.throws(()=>M.solve({...base,additions:Array.from({length:31},()=>({day:2,amount:1}))},true,true));
// 独立按日重放输出，确认新增只入账一次、不会提前清零或多领一次善后。
for(const additions of [[{day:2,amount:500}],[{day:2,amount:900},{day:4,amount:600}],[{day:5,amount:100},{day:8,amount:900}]]){
 const result=M.solve({...base,amounts:[1788],rep:60,additions},true,true);assert.equal(result.status,'clear');
 let amount=1788,progress=0,rep=60,lastReset=-14;
 for(const row of result.rows){
  amount+=additions.filter(x=>x.day===row.day).reduce((n,x)=>n+x.amount,0);assert.equal(row.startTotal,amount);
  if(row.resetAt!==null){assert(row.resetAt-lastReset>=14);lastReset=row.resetAt;progress=0;}
  rep-=row.loss;
  amount=Math.max(0,amount-Math.trunc(Math.fround(Math.fround(amount)*Math.fround(.15)))-50);
  if(progress<80)amount=Math.max(0,amount-20);
  progress=Math.min(100,progress+M.rate(amount,rep,27));
  assert.equal(row.total,amount);assert.equal(row.progress,progress);assert.equal(row.rep,rep);
 }
 assert.equal(amount,0);assert(result.days>=Math.max(...additions.map(x=>x.day)));
}
console.log('PASS: delayed additions after investigation, single booking, zero-gap future inflow, pooled estimate, invalid inputs, replayed daily plan.');
