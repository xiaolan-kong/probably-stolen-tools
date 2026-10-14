const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.env.RELEASE_ROOT || path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
const actual = fs.readdirSync(dist, {recursive:true}).filter(f=>fs.statSync(path.join(dist,f)).isFile()).map(f=>f.replaceAll('\\','/')).sort();
assert.deepEqual(actual, Object.keys(manifest.files).sort(), 'Only reviewed files belong in dist');
for (const file of actual) {
  const content = fs.readFileSync(path.join(dist, file));
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'), manifest.files[file], `Changed after packaging: ${file}`);
  if (/\.(html|js|css|svg|json)$/.test(file)) {
    assert(!/(?:[C-F]:[\\/]|file:\/\/\/|gh[pousr]_[A-Za-z0-9]{20}|github_pat_|BEGIN .*PRIVATE KEY)/.test(content.toString()), `Private path or credential in ${file}`);
  }
}
for (const page of actual.filter(f=>f.endsWith('.html'))) {
 const pageHtml=fs.readFileSync(path.join(dist,page),'utf8');
 for (const [,ref] of pageHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (ref.startsWith('#')) {assert(pageHtml.includes(`id="${ref.slice(1)}"`), `Missing anchor ${ref}`);continue;}
  if (ref === './') continue;
  assert(!/^(?:https?:|\/|data:)/.test(ref), `Resource must work under a repository subpath: ${ref}`);
  assert(fs.existsSync(path.join(dist, ref)), `Missing resource ${ref}`);
 }
}
assert(html.includes('name="description"'));
assert(html.includes('Demo 049-Rev5-L'));
assert(html.includes('id="feedback-form"'));
assert(html.includes('仅在提交时发送') || fs.readFileSync(path.join(dist,'assets/feedback.js'),'utf8').includes('仅在提交时发送'));
assert(!/本地 Demo|本地预览|尚未发布|已记入 Notion/.test(html));
assert(html.includes(`试用版 v${manifest.version}`));
const config=fs.readFileSync(path.join(dist,'assets/feedback-config.js'),'utf8');
assert(config.includes('https://qeidtbijsdfbkcpwxmfa.supabase.co/functions/v1/feedback'));
for (const file of actual.filter(f=>f.endsWith('.js'))) {
 const source=fs.readFileSync(path.join(dist,file),'utf8');
 assert(!/(?:sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY|FEEDBACK_ADMIN_IDS)/.test(source),`Server credentials/config in ${file}`);
 if(file!=='assets/feedback-common.js')assert(!/\b(fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|WebSocket\s*\()/.test(source),`Unexpected network code in ${file}`);
}
for(const page of ['admin.html','feedback.html'])assert(fs.readFileSync(path.join(dist,page),'utf8').includes('content="noindex"'));
const workflow = fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8');
assert(workflow.includes('workflow_dispatch:') && !/^\s+(push|pull_request):/m.test(workflow));
assert(workflow.includes('needs: check') && workflow.includes('path: dist'));
assert(workflow.includes('feedback-origin.test.cjs') && workflow.includes('feedback-api.test.mjs'));
console.log(`PASS: ${actual.length} release files; hashes, resources, privacy, connected feedback, manual deployment and origin gates.`);
