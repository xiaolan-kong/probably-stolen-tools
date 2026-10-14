const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../dist/assets/crime-model.js');
const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
assert.match(html, /<input id="rep" type="number" step="any" required/);
assert(!html.includes('<select id="rep"'));
assert(!html.includes('rep-exact'));
const options=[...html.match(/<select id="upper"[^>]*>(.*?)<\/select>/)[1].matchAll(/<option value="([^"]*)">/g)].map(m=>m[1]).filter(Boolean).map(Number);
assert.deepEqual(options,[0,-60]);
for(const upper of [-59.999,0,27,100,1000,-60,-60.001,-1000])for(const amount of [100,850,1500,2500]){
 assert.equal(M.rate(amount,0,upper),M.rate(amount,0,upper<=-60?-60:0));
}
console.log('PASS: security reputation is numeric, upper-district range keeps the exact multiplier boundary.');
