const assert = require('node:assert/strict');
const M = require('../dist/assets/crime-model.js');
const row = (type, amount) => ({type, amount});
assert.deepEqual(M.mergeCrimes([row('FRAUD',50),row('FRAUD',70),row('FENCING',30)]),[row('FRAUD',120),row('FENCING',30)]);
for (const rows of [[],[row('',0)],[row('__proto__',0)],[row('FRAUD',NaN)],[row('FRAUD',-1)],[row('FRAUD',.5)],[row('FRAUD',10000000),row('FRAUD',1)]]) assert.throws(()=>M.mergeCrimes(rows));
for (const [amount,min,max] of [[50,3,5],[149,3,5],[150,3,4],[299,3,4],[300,3,3],[449,3,3],[450,2,3],[599,2,3],[600,2,2],[749,2,2],[750,1,2]]) {
  const check=M.inspection([row('FENCING',amount),row('ENDANGERMENT',9999)],0);
  assert.equal(check.total,amount);assert.equal(check.active,true);assert.deepEqual([check.min,check.max],[min,max]);
  const trusted=M.inspection([row('FENCING',amount)],60);
  assert.deepEqual([trusted.min,trusted.max],[min+2,max+4]);
  const thorough=M.inspection([row('FENCING',amount)],-80);
  assert.deepEqual([thorough.min,thorough.max],[Math.max(1,min-1),Math.max(2,max-1)]);
}
assert(!M.inspection([row('FENCING',49)],0).active);
assert(!M.inspection([row('FENCING',500)],100).active);
assert(!M.inspection([row('BRIBERY',499)],0).reliable);
assert(M.inspection([row('BRIBERY',500)],0).reliable);
assert(!M.inspection([row('CONTRABAND_TRAFFICKING',1000)],0).sting);
assert(M.inspection([row('CONTRABAND_TRAFFICKING',1000)],0).additional);
assert(M.inspection([row('CONTRABAND_TRAFFICKING',1001)],0).sting);
assert(!M.inspection([row('FENCING',1001)],0).sting);
assert(M.inspection([row('OTHER',1)],0).unknown);
assert.deepEqual([99,100,299,300,1499,1500].map(M.punishment),['报告不显示刑罚','罚款','罚款','监禁（结束本局）','监禁（结束本局）','处决（结束本局）']);
const base={amounts:[0],rep:0,upper:0,progress:0,cooldown:0,officer:'auto',cash:299};
// Exhaustive search catches max/+1 mistakes, including a zero-amount pending case
// that loses more reputation than a small fine and therefore is not monotone at zero.
for(const more of [{},{progress:80},{progress:95},{progress:100,rep:-85},{progress:100,rep:-95},{upper:-60,rep:-79}]) {
  for(const rows of [[row('FENCING',0)],[row('FENCING',50),row('FRAUD',100)]]) {
    const i={...base,...more},type='FENCING';
    const cap=M.maxAdditional(i,rows,type,false,false);
    let brute=-1;
    for(let n=0;n<=1000;n++) {
      const amounts=M.mergeCrimes([...rows,row(type,n)]).map(x=>x.amount);
      if(M.planOptions({...i,amounts},false,false).some(M.success))brute=n;
    }
    assert.equal(M.success(cap)?cap.amount:-1,brute,JSON.stringify({more,rows}));
  }
}
for(const [fixer,evidence] of [[true,false],[true,true],[false,true]]) {
  const rows=[row('FENCING',50),row('FRAUD',100)];
  const cap=M.maxAdditional(base,rows,'FRAUD',fixer,evidence);
  assert(M.success(cap));
  const amounts=M.mergeCrimes([...rows,row('FRAUD',cap.amount+1)]).map(x=>x.amount);
  assert(!M.planOptions({...base,amounts},fixer,evidence).some(M.success));
}
assert.equal(M.maxAdditional({...base,officer:'dialogue'},[row('FRAUD',0)],'FRAUD',true,true).status,'dialogue');
console.log('PASS: same-crime merging; validation; inspection thresholds and reputation; punishment; multi-crime additional caps vs enumeration; cap+1 with services.');
