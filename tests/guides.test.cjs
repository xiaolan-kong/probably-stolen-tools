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
const gallery = fs.readFileSync(path.join(dist, 'guide-water-recipes.html'), 'utf8');
const directory = fs.readFileSync(path.join(dist, 'guides.html'), 'utf8');
assert.equal((article.match(/class="guide-section"/g)||[]).length, 8);
assert.equal((article.match(/<figure /g)||[]).length, 4);
assert.equal((article.match(/<table>/g)||[]).length, 4);
assert.equal((gallery.match(/<figure /g)||[]).length, 4);
assert(directory.includes('id="technical"') && directory.includes('id="visual"'));
assert(directory.includes('href="guide-water-recipes.html"'));
assert(gallery.includes('href="guide-return-customers.html"'));
assert(!/src="assets\/guides\/return-customers\/(09|10|11|12)\.png/.test(article));
for (const id of ['section-9','recipe-1','recipe-2','recipe-3','recipe-4']) {
  assert(article.includes(`id="${id}"`), 'Preserve previously shared article anchors');
  if (id.startsWith('recipe-')) assert(gallery.includes(`id="${id}"`) && gallery.includes(`href="#${id}"`));
}
for (const page of ['index.html','assembler.html','guides.html','guide-return-customers.html','guide-water-recipes.html']) {
  assert(fs.readFileSync(path.join(dist,page),'utf8').includes('href="guides.html"'));
}
assert(article.includes('https://www.xiaoheihe.cn/app/bbs/link/193981053'));
assert(!/imgheybox|看评论区/.test(article));
console.log('PASS: separate article/image guides, eight chapters, four native tables, reciprocal links, preserved anchors and mobile TOC.');
