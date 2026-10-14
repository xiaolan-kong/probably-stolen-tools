'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../dist/assets/assembler-model.js'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/assets/assembler-sprites.js'),'utf8'),ctx);
const sprites=ctx.window.AssemblerSprites;
for(const [key,s] of Object.entries(sprites)) {
  assert.match(key,/^[a-z0-9_]+\/[a-z0-9_]+$/);
  const bytes=fs.readFileSync(path.join(__dirname,'../dist/assets/assembler-items',key+'.png'));
  assert.equal(bytes.readUInt32BE(16),s.width);assert.equal(bytes.readUInt32BE(20),s.height);
}
if(process.argv[2]) {
  const snapshot=A.readSave(fs.readFileSync(process.argv[2],'utf8'));
  for(const item of [...snapshot.machines,...snapshot.pieces])assert.ok(Object.hasOwn(sprites,item.sprite),item.sprite);
  for(const p of snapshot.pieces) {
    const sprite=sprites[p.sprite];assert.ok(sprite.mask,p.sprite);
    const cells=new Set(p.shape.cells.map(c=>`${c.x}:${c.y}`));
    const mask=Array.from({length:p.shape.height},(_,y)=>Array.from({length:p.shape.width},(_,x)=>cells.has(`${x}:${y}`)?'#':'.').join(''));
    assert.equal(JSON.stringify(sprite.mask),JSON.stringify(mask),`sprite alpha disagrees with save shape: ${p.sprite}`);
  }
  console.log(`PASS ${snapshot.machines.length} machine images and ${snapshot.pieces.length} module images; every module alpha footprint matches its actual save shape`);
}
console.log(`PASS ${Object.keys(sprites).length} original sprite files and dimensions`);
