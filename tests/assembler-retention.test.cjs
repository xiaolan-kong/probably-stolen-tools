'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const A=require('../dist/assets/assembler-joint.js');
const machines=[{key:'a',identifier:'moisture_farm'},{key:'b',identifier:'moisture_farm'}];
const options={targets:{moisture_farm:{primary:'quality',secondary:'performance',preferred:150,requirements:[]}},borrow:true,locks:['x','y']};
const key=A.searchContextKey('joint',machines,options);
assert.equal(key,A.searchContextKey('joint',[...machines].reverse(),{...options,locks:['y','x'],seconds:300,exhaustive:false}));
for(const change of [{borrow:false},{locks:['x']},{targets:{moisture_farm:{...options.targets.moisture_farm,preferred:100}}},{targets:{moisture_farm:{...options.targets.moisture_farm,requirements:[{identifier:'x',count:1,exact:true}]}}}])assert.notEqual(key,A.searchContextKey('joint',machines,{...options,...change}));
assert.notEqual(key,A.searchContextKey('single',machines.slice(0,1),options));
for(const [field,value]of [['secondary','power'],['minQuality',100],['minPerformance',20],['maxPower',10]])assert.notEqual(key,A.searchContextKey('joint',machines,{...options,targets:{moisture_farm:{...options.targets.moisture_farm,[field]:value}}}));
assert.notEqual(key,A.searchContextKey('joint',machines.slice(0,1),options));
assert.deepEqual(['quick','standard','deep'].map(m=>A.searchBudget(m).seconds),[5,60,300]);
assert.equal(A.searchBudget('deep').exhaustive,false,'Deep spends its budget optimizing, not switching to exhaustive enumeration');
console.log('PASS search identity: budgets share best; machines, targets, constraints, locks and borrowing isolate results');
if(process.argv[2]){
 const snapshot=A.readSave(fs.readFileSync(process.argv[2],'utf8')),group=snapshot.machines.filter(m=>m.identifier==='moisture_farm');
 const run=input=>{const p=spawnSync('dotnet',['planner/bin/Release/net10.0/Assembler.Native.dll'],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:20*1024*1024});if(p.status)throw Error(p.stderr||p.stdout);return JSON.parse(p.stdout);};
 const input={type:'joint',snapshot,machines:group,options:{...options,locks:[]},fixedIterations:480};
 const score=r=>{const s=A.jointSummary(group,r.best,input.options);return [...s.water].reverse().concat(-s.power);};
 const compare=(a,b)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
 const strong=run(input),cold=run({...input,fixedIterations:1}),retained=run({...input,fixedIterations:1,retainedBest:strong.best});
 A.validateJoint(snapshot,group,input.options,retained.best);
 console.log('Pure water: stronger, cold short, retained short',score(strong)[0],score(cold)[0],score(retained)[0]);
 assert(compare(retained,strong)>=0,'A weaker search must not replace a retained stronger whole allocation');
 if(process.argv.includes('--wasm')){
  const p=spawnSync('node',['planner/run-wasm.mjs','--trace'],{input:JSON.stringify({...input,fixedIterations:1,retainedBest:strong.best}),encoding:'utf8',maxBuffer:20*1024*1024});
  if(p.status)throw Error(p.stderr||p.stdout);const wasm=JSON.parse(p.stdout.trim().split('\n').at(-1));
  A.validateJoint(snapshot,group,input.options,wasm.best);assert(compare(wasm,strong)>=0);assert.deepEqual(wasm.best,retained.best);
  assert(wasm.trace.some(t=>Object.keys(t.metrics).length===group.length),'WASM publishes the retained best before exploration');
  console.log('PASS WASM retained result matches native and is published live');
 }
 const invalid=structuredClone(strong.best),keys=Object.keys(invalid.machines);invalid.machines[keys[1]].placements=invalid.machines[keys[0]].placements;
 const rejected=run({...input,fixedIterations:1,retainedBest:invalid});A.validateJoint(snapshot,group,input.options,rejected.best);
 assert.deepEqual(rejected.best,cold.best,'Duplicate cross-machine retained pieces must be rejected');
 const changed={...input.options,borrow:false};const restricted=run({...input,options:changed,fixedIterations:1,retainedBest:strong.best});A.validateJoint(snapshot,group,changed,restricted.best);
 const single={...input,type:'search',machines:[group[0]],fixedIterations:1000},singleStrong=run(single);
 const singleRetained=run({...single,fixedIterations:1,retainedBest:{machines:{[group[0].key]:singleStrong.best}}});
 A.validateJoint(snapshot,single.machines,single.options,{machines:{[group[0].key]:singleRetained.best}});
 const s=singleStrong.best.evaluation,r=singleRetained.best.evaluation;
 const singleScore=e=>[e.quality>=150?1:0,e.quality>=150?150:e.tier,e.performance,-e.power];
 let singleComparison=0;for(let i=0;i<4;i++)if(singleScore(r)[i]!==singleScore(s)[i]){singleComparison=singleScore(r)[i]-singleScore(s)[i];break;}
 assert(singleComparison>=0,'Single search must retain the better recommendation too');
 console.log('PASS real-save best retention, duplicate allocation rejection, and changed borrowing constraints');
}
