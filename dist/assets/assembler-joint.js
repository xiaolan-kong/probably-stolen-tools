/* Display summaries and independently validate allocations returned by the Mod core. */
(function(root){
  'use strict';
  const A=typeof module==='object'?require('./assembler-model.js'):root.Assembler;
  const goalFor=(m,options)=>options.targets?.[m.identifier]||{primary:A.profiles[m.identifier].primary};
  const raw=(m,e,g)=>g.primary==='power'?-e.power:g.primary==='outcome'?(m.identifier==='water_purifier'?-e.output:e.output):e[g.primary];
  const searchBudget=mode=>({seconds:mode==='deep'?300:mode==='quick'?5:60,exhaustive:false});
  function searchContextKey(mode,machines,options) {
    const goals=[...new Set(machines.map(m=>m.identifier))].sort().map(id=>{
      const g=goalFor({identifier:id},options);
      return [id,g.primary,A.secondaryFor(g),...['preferred','minQuality','minPerformance','maxPower'].map(k=>g[k]??null),
        (g.requirements||[]).map(r=>[r.identifier,r.count,r.exact]).sort((a,b)=>a[0].localeCompare(b[0]))];
    });
    return JSON.stringify([mode,machines.map(m=>m.key).sort(),[...(options.locks||[])].sort(),!!options.borrow,goals]);
  }
  function jointSummary(machines,candidate,options={}) {
    const water=Array(6).fill(0);let power=0,reached=0;
    for(const m of machines){const e=candidate.machines[m.key].evaluation,g=goalFor(m,options);power+=e.power;if(m.identifier==='moisture_farm')water[e.tier]+=e.output;if(g.preferred==null||raw(m,e,g)>=g.preferred)reached++;}
    return {water,power,reached,count:machines.length};
  }
  function validateJoint(snapshot,machines,options,candidate) {
    if(Object.keys(candidate.machines).length!==machines.length)throw Error('联合方案的机器数量不匹配。');
    const used=new Set(),clean={machines:{}};
    for(const m of machines){
      if(m.error||options.locks?.includes(m.key))throw Error(m.error||'联合选择中含锁定机器。');
      const p=candidate.machines[m.key];if(!p)throw Error('联合方案缺少机器。');
      const available=new Set(A.availablePieces(snapshot,m,options.locks,options.borrow).map(p=>p.key));
      for(const pl of p.placements){if(used.has(pl.key)||!available.has(pl.key))throw Error('联合方案重复使用或借用了不可用模组。');used.add(pl.key);}
      const e=A.evaluate(m,snapshot.pieces,p.placements),g=goalFor(m,options);
      A.validateGoal(m,g);
      if(A.statDeficit(e,g)||A.requirementDeficit(new Map(snapshot.pieces.map(p=>[p.key,p])),p.placements,g))throw Error('联合方案未满足每台机器的限制或必选模组数量。');
      clean.machines[m.key]={placements:p.placements.map(pl=>({...pl})),evaluation:e};
    }
    return clean;
  }
  // Reassign only physically interchangeable instances, after the whole allocation is known.
  function preferLocalPieces(snapshot,machines,options,candidate) {
    const clean=validateJoint(snapshot,machines,options,candidate),groups=new Map();
    const identity=p=>JSON.stringify([p.identifier,p.kind,...['performance','efficiency','quality'].map(k=>p.base[k]),p.shape.width,p.shape.height,[...p.shape.cells].sort((a,b)=>a.y-b.y||a.x-b.x),p.effects,[...(p.allowed||[])].sort(),p.variantIdentity||'']);
    const pieces=new Map(snapshot.pieces.map(p=>[p.key,p]));
    for(const m of machines)for(const pl of clean.machines[m.key].placements){const id=identity(pieces.get(pl.key));if(!groups.has(id))groups.set(id,[]);groups.get(id).push({m,pl});}
    const available=new Map(machines.map(m=>[m.key,new Set(A.availablePieces(snapshot,m,options.locks,options.borrow).map(p=>p.key))]));
    for(const [id,slots] of groups){
      const pool=snapshot.pieces.filter(p=>identity(p)===id),used=new Set(),assigned=new Set();
      const assign=(slot,p)=>{slot.pl.key=p.key;used.add(p.key);assigned.add(slot);};
      const sameSlot=(a,b)=>a.x===b.x&&a.y===b.y&&a.rotation===b.rotation&&a.flipped===b.flipped;
      // Reserve every machine's own pieces before any other machine can borrow them.
      for(const exact of [true,false])for(const slot of slots)if(!assigned.has(slot)){
        const p=pool.find(p=>!used.has(p.key)&&p.machineKey===slot.m.key&&available.get(slot.m.key).has(p.key)&&(!exact||slot.m.installed.some(pl=>pl.key===p.key&&sameSlot(pl,slot.pl))));
        if(p)assign(slot,p);
      }
      pool.sort((a,b)=>Number(!!a.machineKey||!!a.inMachineArea)-Number(!!b.machineKey||!!b.inMachineArea)||a.key.localeCompare(b.key));
      for(const slot of slots)if(!assigned.has(slot)){
        const p=pool.find(p=>!used.has(p.key)&&available.get(slot.m.key).has(p.key));
        if(!p)throw Error('无法分配等效模组。');assign(slot,p);
      }
    }
    const normalized=validateJoint(snapshot,machines,options,clean);
    for(const m of machines)for(const k of ['performance','efficiency','quality','power','output','tier'])
      if(normalized.machines[m.key].evaluation[k]!==clean.machines[m.key].evaluation[k])throw Error('等效模组替换改变了机器效果。');
    return normalized;
  }
  function assemblyActions(machine,plan) {
    const proposed=new Map(plan.placements.map(p=>[p.key,p])),original=new Map(machine.installed.map(p=>[p.key,p]));
    const actions={out:machine.installed.filter(p=>!proposed.has(p.key)),move:[],in:[],stay:[]};
    for(const p of [...plan.placements].sort((a,b)=>a.y-b.y||a.x-b.x)){
      const old=original.get(p.key);
      actions[!old?'in':['x','y','rotation','flipped'].every(k=>old[k]===p[k])?'stay':'move'].push(p);
    }
    return actions;
  }
  function completeAssembly(snapshot,machines,options,candidate,moves={}) {
    const clean=validateJoint(snapshot,machines,options,candidate),next=structuredClone(snapshot),chosen=new Set(machines.map(m=>m.key));
    const destinations=new Map(Object.entries(clean.machines).flatMap(([key,plan])=>plan.placements.map(pl=>[pl.key,{machineKey:key,pl}])));
    for(const p of next.pieces){
      const to=destinations.get(p.key);
      if(to){const m=next.machines.find(m=>m.key===to.machineKey);p.machineKey=m.key;p.inMachineArea=true;p.placement={...to.pl};p.position=`(${to.pl.x+1}, ${to.pl.y+1})`;p.source=`${m.source} › ${m.displayName||m.name} #${m.key} ${m.position}`;}
      else if(chosen.has(p.machineKey)){
        const state=moves[p.key],storage=next.storage?.find(s=>s.key===state?.storageKey);
        p.machineKey=null;p.inMachineArea=false;p.source=storage?.label||'已移出机器（位置未记录）';p.position=state?.storageSlot||'待确认';
        if(!storage)p.reason='移出位置未记录，重新导入存档后可用';
      }
    }
    for(const m of next.machines){
      const placements=clean.machines[m.key]?.placements||m.installed.filter(pl=>!destinations.has(pl.key));
      if(chosen.has(m.key)||placements.length!==m.installed.length){m.installed=placements;m.current=A.evaluate(m,next.pieces,placements);m.confirmed=true;}
    }
    next.hasConfirmedAssembly=true;return next;
  }
  Object.assign(A,{jointSummary,validateJoint,preferLocalPieces,assemblyActions,completeAssembly,searchBudget,searchContextKey});
  if(typeof module==='object')module.exports=A;
})(typeof self==='object'?self:globalThis);
