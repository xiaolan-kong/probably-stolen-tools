const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.join(__dirname, '../dist');
const script = fs.readFileSync(path.join(dist, 'assets/guides.js'), 'utf8');
for (const mobile of [false, true]) {
  const contents = {open:true};
  vm.runInNewContext(script, {document:{addEventListener:(_,fn)=>fn(),querySelector:()=>contents},window:{matchMedia:()=>({matches:mobile})}});
  assert.equal(contents.open, !mobile);
}
vm.runInNewContext(script, {document:{addEventListener:(_,fn)=>fn(),querySelector:()=>null}});
const article = fs.readFileSync(path.join(dist, 'guide-return-customers.html'), 'utf8');
assert.equal((article.match(/class="guide-section"/g)||[]).length, 9);
assert.equal((article.match(/<figure /g)||[]).length, 12);
for (const id of ['section-9','recipe-1','recipe-2','recipe-3','recipe-4']) {
  assert(article.includes(`id="${id}"`) && article.includes(`href="#${id}"`));
}
for (const page of ['index.html','assembler.html','guides.html','guide-return-customers.html']) {
  assert(fs.readFileSync(path.join(dist,page),'utf8').includes('href="guides.html"'));
}
assert(article.includes('https://www.xiaoheihe.cn/app/bbs/link/193981053'));
assert(!/imgheybox|看评论区/.test(article));
console.log('PASS: guide navigation, nine chapters, twelve local figures, recipe anchors, mobile TOC and directory without TOC.');
