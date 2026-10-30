const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const A=require('../dist/assets/assembler-joint.js');
const tags=(id)=>{
  const t={MACHINERY_DRAWN_POWER_BASE:{valueInt:A.profiles[id].power},MACHINE_QUALITY_RATIO_INT:{valueInt:0}};
  if(['desequencer','hydroponic','plant_dna_manipulator','printer'].includes(id))t.BASE_PROCESSING_SPEED_TAG={valueInt:({desequencer:33,hydroponic:8,plant_dna_manipulator:10,printer:24})[id]};
  if(['wine_rack','hydroponic','plant_dna_manipulator'].includes(id))t.MACHINE_PERFORMANCE_RATIO_INT={valueEnabled:true,valueInt:2};
  if(id==='wine_rack'){t.MACHINE_EFFICIENCY_RATIO_INT={valueEnabled:true,valueInt:2};t.MACHINE_PERFORMANCE_REDUCES_POWER_TAG={valueEnabled:true};}
  if(id==='mirage_projector'){t.MACHINE_PERFORMANCE_RATIO_INT={valueInt:4};t.MACHINE_QUALITY_RATIO_INT={valueInt:2};}
  if(id==='deal_maker')t.MACHINE_QUALITY_RATIO_INT={valueInt:10};
  if(id==='printer')t.MACHINE_QUALITY_RATIO_INT={valueInt:4};
  if(['hydroponic','plant_dna_manipulator'].includes(id))t.MACHINE_QUALITY_RATIO_INT={valueInt:2};
  if(id==='moisture_farm')t.MACHINERY_DRAWN_POWER_BASE.valueInt=6;
  if(id==='water_purifier')t.MACHINERY_DRAWN_POWER_BASE.valueInt=4;
  return t;
};
const machine=id=>({key:id,identifier:id,formal:true,width:id==='evaporator'?4:7,height:id==='evaporator'?4:5,blocked:'0',installed:[],parameters:A.readParameters(id,tags(id))});
const machines=Object.keys(A.profiles).map(machine);
const piece=(key,base)=>({key,identifier:'system_module_'+key,kind:'module',base:{performance:0,efficiency:0,quality:0,...base},shape:{width:1,height:1,cells:[{x:0,y:0}]},effects:[],allowed:Object.keys(A.profiles),reason:'',machineKey:null});
const pieces=[piece('a',{quality:100,performance:33,efficiency:15}),piece('b',{quality:50,performance:-17,efficiency:31})];
const snapshot={formal:true,machines,pieces,attraction:{base:10,effective:10,current:10,bonus:0,hardMode:false}};
for(const m of machines)m.current=A.evaluate(m,pieces,[]);
assert.equal(A.fromStats(machine('moisture_farm'),{quality:150,performance:0,efficiency:0}).output,850);
assert.equal(A.fromStats(machine('water_purifier'),{quality:100,performance:0,efficiency:0}).output,99.9);
assert.equal(A.sharedOutput(850,2),680);assert.equal(A.sharedOutput(850,5),425);
assert.equal(A.fromStats(machine('mirage_projector'),{quality:29,performance:103,efficiency:0}).output,139);
assert.throws(()=>A.readParameters('desequencer',{}),/MACHINERY/);
assert.throws(()=>A.readParameters('desequencer',{...tags('desequencer'),MACHINE_PERFORMANCE_RATIO_INT:{valueEnabled:true,valueInt:0}}));
assert.throws(()=>A.evaluate(machine('evaporator'),pieces,[{key:'a',x:4,y:0,rotation:0,flipped:false}]));
const low=machine('printer');low.parameters.processLowPower=true;assert.equal(A.fromStats(low,{quality:0,performance:0,efficiency:0}).power,0);
const targets=Object.fromEntries(machines.map(m=>[m.identifier,{primary:m.identifier==='water_purifier'?'outcome':'quality',secondary:'power',preferred:m.identifier==='water_purifier'?99.9:100,requirements:[]}]));
targets.mirage_projector={primary:'outcome',secondary:'power',preferred:100,requirements:[]};
const requests=machines.map(m=>({type:'search',snapshot,machines:[m],options:{targets,borrow:true,locks:[]},fixedIterations:40}));
const farms=[{...machine('moisture_farm'),key:'farm1'},{...machine('moisture_farm'),key:'farm2'}];
for(const m of farms)m.current=A.evaluate(m,pieces,[]);
requests.push({type:'joint',snapshot:{...snapshot,machines:farms},machines:farms,options:{targets,borrow:true,locks:[]},fixedIterations:60});
// No real save or private data in these current-rule fixtures.
if(process.argv.includes('--engine')){
  const results={};
  for(const [kind,command,args] of [['native','dotnet',['planner/bin/Release/net10.0/Assembler.Native.dll','--batch']],['wasm','node',['planner/run-wasm.mjs','--batch']]]){
    const result=spawnSync(command,args,{cwd:path.resolve(__dirname,'..'),input:JSON.stringify(requests),encoding:'utf8',maxBuffer:20*1024*1024});
    if(result.status!==0)throw Error(result.stderr||result.stdout);
    results[kind]=JSON.parse(result.stdout.trim().split('\n').at(-1));
    for(let i=0;i<requests.length;i++){
      const request=requests[i],r=results[kind][i];assert(r.best,request.machines[0].identifier);
      const candidate=request.type==='joint'?r.best:{machines:{[request.machines[0].key]:r.best}};
      const validated=A.validateJoint(request.snapshot,request.machines,request.options,candidate);
      for(const m of request.machines)for(const k of ['performance','efficiency','quality','power','output','tier'])assert.equal(candidate.machines[m.key].evaluation[k],validated.machines[m.key].evaluation[k],`${kind} ${m.identifier} ${k}`);
    }
  }
  results.native.forEach((r,i)=>assert.deepEqual(results.wasm[i].best,r.best,requests[i].machines[0].identifier));
  console.log('PASS: 12 formal machines plus shared-air joint allocation, native/WASM exact layouts and independent JS metrics.');
}
function saveFixture() {
  const shape={'<width>k__BackingField':1,'<height>k__BackingField':1,data:[1],'<minX>k__BackingField':0,'<minY>k__BackingField':0,'<orientation>k__BackingField':0,'<flipped>k__BackingField':false};
  const raw=(id,key,t,type=[])=>({identifier:id,uniqueId:key,name:id,unitCount:1,itemTypes:type,itemShape:shape,itemModifiedShape:shape,childItems:[],childItemInventoryNode:[],_keys:Object.keys(t),_values:Object.values(t)});
  const items=[raw('save_bag',1,{})];
  for(const [i,id] of Object.keys(A.profiles).entries()) {
    const m=raw(id,10+i*2,{...tags(id),IS_OWNED_TAG:{valueEnabled:true},MODULE_UPGRADE_STAGE_INT:{valueInt:id==='evaporator'?0:2},TOTAL_PERCENTAGE_QUALITY_BONUS_INT:{valueInt:100}},id==='printer'?[]:['MACHINE']);
    const p=raw('system_module_quality',11+i*2,{IS_OWNED_TAG:{valueEnabled:true},MODULE_TYPE_UNIVERSAL:{valueEnabled:true},BONUS_PERCENTAGE_PERFORMANCE_INT:{valueInt:0},BONUS_PERCENTAGE_EFFICIENCY_INT:{valueInt:0},BONUS_PERCENTAGE_QUALITY_INT:{valueInt:100}},['MODULE']);
    items[0].childItems.push(items.length);items[0].childItemInventoryNode.push(0);
    m.childItems=[items.length+1];m.childItemInventoryNode=[3];items.push(m,p);
  }
  return {playerStore:{value:{saveVersion:'VERSION 100',saveSlotId:1,runID:'synthetic-fixture',baseStoreAttractiveness:10,projectorAttractivenessBonus:0,garbageLevel:0,isHardMode:false,mainInvJSON:JSON.stringify({saveItems:items})}},storeStation:{value:{dayCounter:1}}};
}
const imported=A.readSave(JSON.stringify(saveFixture()));
assert.equal(imported.machines.length,12);assert.equal(imported.pieces.length,12);
assert(imported.machines.every(m=>!m.error),JSON.stringify(imported.machines.filter(m=>m.error)));
const printer=imported.machines.find(m=>m.identifier==='printer');
assert.equal(imported.pieces.find(p=>p.key===printer.installed[0].key).machineKey,printer.key,'Printer ownership must not depend on a MACHINE item type');
const working=saveFixture(),inv=JSON.parse(working.playerStore.value.mainInvJSON);
const busy=inv.saveItems.find(x=>x.identifier==='printer');busy._keys.push('MACHINE_STATE_TAG');busy._values.push({internalValueString:'STATE_WORKING'});
working.playerStore.value.mainInvJSON=JSON.stringify(inv);const blocked=A.readSave(JSON.stringify(working));
assert.match(blocked.machines.find(m=>m.identifier==='printer').error,/正在工作/);
assert(!A.availablePieces(blocked,blocked.machines[0],[],true).some(p=>p.machineKey===printer.key));
const outside=saveFixture(),outsideInv=JSON.parse(outside.playerStore.value.mainInvJSON),outsidePrinter=outsideInv.saveItems.find(x=>x.identifier==='printer');
outsidePrinter.childItemInventoryNode=[4];outsidePrinter._values[outsidePrinter._keys.indexOf('TOTAL_PERCENTAGE_QUALITY_BONUS_INT')].valueInt=0;
outside.playerStore.value.mainInvJSON=JSON.stringify(outsideInv);const outsideSnapshot=A.readSave(JSON.stringify(outside));
assert(!A.availablePieces(outsideSnapshot,outsideSnapshot.machines[0],[],true).some(p=>p.machineKey===printer.key),'Modules in task/material slots must never be borrowed');
console.log('PASS: formal parameters, purity, shared air, low power, 4x4 bounds, complete ES3 import, working-machine borrowing guard.');
module.exports={snapshot,requests,machine,tags,saveFixture};
