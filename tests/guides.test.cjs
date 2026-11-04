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

// Follow real local links, including cross-page fragments and the preserved historical anchors.
const guidePages=['guides.html','guide-return-customers.html','guide-water-recipes.html','guide-crime-cleanup.html','guide-water-formal.html','guide-crime-visual.html'];
for(const page of guidePages) {
 const html=fs.readFileSync(path.join(dist,page),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,`${page}: duplicate anchors`);
 for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(ref.startsWith('https://')||ref==='./')continue;
  const [file,anchor]=ref.split('#'),target=path.join(dist,(file||page).split('?')[0]);
  assert(fs.existsSync(target),`${page}: missing ${ref}`);
  if(anchor)assert(fs.readFileSync(target,'utf8').includes(`id="${anchor}"`),`${page}: broken ${ref}`);
 }
}
for(const page of ['guide-crime-cleanup.html','guide-water-formal.html','guide-crime-visual.html']) {
 const html=fs.readFileSync(path.join(dist,page),'utf8');
 assert(directory.includes(`href="${page}"`)||directory.includes(`href="${page}#`));
 assert(html.includes('未完成实机验收')&&html.includes('Build 262'));
}
assert(article.includes('href="guide-water-formal.html"')&&gallery.includes('href="guide-water-formal.html"'));
const assembler=fs.readFileSync(path.join(dist,'assembler.html'),'utf8');
assert(assembler.includes('2026-10-30')&&assembler.includes('2.3.0'));
assert(!assembler.includes('2.0.0 已公开')&&!assembler.includes('搜索源码已同步当前'));
console.log('PASS: current and historical guide links/resources/anchors, evidence boundaries and dated assembler snapshot.');
