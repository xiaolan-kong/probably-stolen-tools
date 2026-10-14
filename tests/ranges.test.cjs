const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../dist/assets/crime-model.js');
const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const options = id => [...html.match(new RegExp('<select id="'+id+'"[^>]*>(.*?)</select>'))[1].matchAll(/<option value="([^"]*)">/g)].map(m=>m[1]).filter(Boolean).map(Number);
assert.deepEqual(options('rep'), [80,60,1,0,-20,-40,-60,-80,-100]);
assert.deepEqual(options('upper'), [0,-60]);
const representative = r => r>=80?80:r>=60?60:r>0?1:r>-20?0:r>-40?-20:r>-60?-40:r>-80?-60:r>-100?-80:-100;
const actualValues = new Set([-.001,.001,59.999,60,60.001,79.999,80,1000,-1000]);
for(let n=-100;n<=100;n++)for(const offset of [-.001,0,.001])actualValues.add(n+offset);
for(const actual of actualValues){
 const base = representative(actual);
 for(const upper of [27,-60])for(let visits=0;visits<=12;visits++){
  const loss=visits*(upper<=-60?40:20);
  if(base-loss<=-100)continue;
  assert(actual-loss>-100, `Representative must not hide a fatal reputation: ${actual}/${loss}`);
  for(const amount of [99,100,299,300,849,850,1199,1200,1499,1500,2499,2500]){
   assert(M.rate(amount,base-loss,upper)>=M.rate(amount,actual-loss,upper), `Range must not underestimate investigation: ${actual}/${loss}/${amount}`);
  }
 }
}
for(const upper of [-59.999,0,27,100,1000,-60,-60.001,-1000])for(const amount of [100,850,1500,2500]){
 assert.equal(M.rate(amount,0,upper),M.rate(amount,0,upper<=-60?-60:0));
}
assert(M.rate(1500,60-80,0)>M.rate(1500,79-80,0),'A broad positive band needs a conservative label after losses');
console.log('PASS: range representatives remain conservative after repeated -20/-40, exact boundary neighbors, investigation brackets and upper-district threshold.');
