'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const A=require('../dist/assets/assembler-joint.js');
const {saveFixture,machine}=require('./assembler-formal.test.cjs');
const fixture=saveFixture();fixture.playerStore.value.saveVersion='VERSION 100-Rev6';
assert(A.readSave(JSON.stringify(fixture)).formal);
fixture.playerStore.value.saveVersion='VERSION 100-Rev13';
assert(A.readSave(JSON.stringify(fixture)).formal);
fixture.playerStore.value.saveVersion='VERSION 049-Rev5-L';
assert(A.readSave(JSON.stringify(fixture),{rules:'formal'}).formal);
assert(!A.readSave(JSON.stringify(fixture),{rules:'demo'}).formal);
const inv=JSON.parse(fixture.playerStore.value.mainInvJSON),printer=inv.saveItems.find(x=>x.identifier==='printer');
const chip=structuredClone(inv.saveItems[2]);
Object.assign(chip,{identifier:'printer_chip',uniqueId:900,itemTypes:[],_keys:['PROGRESS_ITEM_REQUIRED_MACHINE_TAG_COUNT','PROGRESS_ITEM_REQUIRED_MACHINE_TAG_0','PROGRESS_ITEM_TARGET_TAG'],_values:[{valueEnabled:true,valueInt:1},{internalValueString:'CNC Module'},{valueInt:100}]});
printer.childItems.push(inv.saveItems.length);printer.childItemInventoryNode.push(5);inv.saveItems.push(chip);
fixture.playerStore.value.mainInvJSON=JSON.stringify(inv);
const parsed=A.readSave(JSON.stringify(fixture),{rules:'formal'}),m=parsed.machines.find(x=>x.identifier==='printer');
assert.deepEqual(m.requiredModules,[{identifier:'printer_module_cnc',count:1,exact:false}]);
const original=inv.saveItems[2];
original._keys.push('MODULE_UPGRADE_EFFECTS_JSON');original._values.push({valueEnabled:true,internalValueString:'{"MODULE_EFFECT_TOP_MOUNT":2,"MODULE_EFFECT_RECEIVER":3}'});
fixture.playerStore.value.mainInvJSON=JSON.stringify(inv);
assert.match(A.readSave(JSON.stringify(fixture),{rules:'formal'}).pieces[0].reason,/合并词条/);
assert.deepEqual(A.readSave(JSON.stringify(fixture),{rules:'formal',moduleUpgrade:true}).pieces[0].mergedEffects,[{effect:'MODULE_EFFECT_TOP_MOUNT',count:2},{effect:'MODULE_EFFECT_RECEIVER',count:3}]);
const piece=(key,id,base,effects=[],mergedEffects)=>({key,identifier:id,kind:'module',base:{performance:0,efficiency:0,quality:0,...base},enabledBase:{performance:0,efficiency:0,quality:0,...base},shape:{width:1,height:1,cells:[{x:0,y:0}]},effects,mergedEffects,allowed:Object.keys(A.profiles),reason:'',machineKey:null});
const p=piece('p','system_module_quality',{quality:13},['MODULE_EFFECT_TOP_MOUNT'],[{effect:'MODULE_EFFECT_TOP_MOUNT',count:2}]);
const n={...piece('n','node',{}),kind:'node'};
const high={...machine('moisture_farm'),width:16,height:8,blocked:((1n<<128n)-1n ^ (1n<<127n)).toString()};
const layout=[{key:'p',x:15,y:7,rotation:0,flipped:false}];
assert.equal(A.evaluate(high,[p],layout).quality,13);
assert.equal(A.evaluate(machine('moisture_farm'),[p],[{...layout[0],x:0,y:0}]).quality,18,'stack multiplication precedes rounding');
const required={...machine('printer'),requiredModules:m.requiredModules};
const cnc=piece('cnc','printer_module_cnc',{quality:-10});
const cases=[
  {m:high,pieces:[p],goal:{primary:'quality',secondary:'power'}},
  {m:machine('moisture_farm'),pieces:[p,n],goal:{primary:'quality',secondary:'power',requirements:[{identifier:'system_module_quality',count:1,exact:false}]}},
  {m:required,pieces:[p,cnc],goal:{primary:'quality',secondary:'power'}},
  {m:machine('security_alarm'),pieces:[p],goal:{primary:'quality',secondary:'power',preferred:10}},
  {m:machine('desequencer'),pieces:[p],goal:{primary:'power',secondary:'quality'}}
].map(({m,pieces,goal})=>({type:'search',snapshot:{formal:true,machines:[m],pieces},machines:[m],options:{targets:{[m.identifier]:goal},borrow:true,locks:[]},fixedIterations:50}));
if(process.argv.includes('--engine')){
  const outputs=[];
  for(const [command,args] of [['dotnet',['planner/bin/Release/net10.0/Assembler.Native.dll','--batch']],['node',['planner/run-wasm.mjs','--batch']]]){
    const r=spawnSync(command,args,{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:20*1024*1024});
    assert.equal(r.status,0,r.stderr||r.stdout);const values=JSON.parse(r.stdout.trim().split('\n').at(-1));outputs.push(values);
    for(let i=0;i<cases.length;i++){
      const c=cases[i],best=values[i].best;assert(best,'case '+i);
      const clean=A.validateJoint(c.snapshot,c.machines,c.options,{machines:{[c.machines[0].key]:best}});
      for(const k of ['quality','performance','efficiency','power','output'])assert.equal(best.evaluation[k],clean.machines[c.machines[0].key].evaluation[k],`case ${i}: ${k}`);
    }
    assert(values[2].best.placements.some(p=>p.key==='cnc'),'required chip function cannot be optimized away');
  }
  outputs[0].forEach((r,i)=>assert.deepEqual(r.best,outputs[1][i].best));
}
const manifest=JSON.parse(fs.readFileSync('dist/assets/planner/source-manifest.json','utf8'));
assert.equal(manifest.tag,'v2.5.1');assert.equal(manifest.commit,'1e75df23a1dc2532b78e61af733c334a78347c64');
console.log('PASS: Rev6 and explicit legacy rules, merged stacks and rounding, chip requirements, 128-cell high bit, general goals, native/WASM parity when --engine.');

module.exports={cases};
