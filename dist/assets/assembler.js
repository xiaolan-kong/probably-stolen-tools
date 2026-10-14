(() => {
  'use strict';
  const A=window.Assembler,$=id=>document.getElementById(id),num=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2}),signed=n=>n===0?'0':(n>0?'+':'')+num(n);
  const history={};let jointSeed=null,moves={},guideOpen={},bestPlans={},searchPreviewSignature="";
  const colors=['#d8e6ce','#e9d8ae','#cfe3e8','#e4d3e1','#dbd8ec','#e4d6c4'];
  let snapshot=null,mode='single',step=1,grouping='area',selected=new Set(),locks=new Set(),targets={},result=null,run=null,activeKey=null,worker=null,revision=0,busy=false,pinned=false,detailTrigger=null,hoverSuppressed=false;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action,cls)=>{const n=el('button',text,cls);n.type='button';n.addEventListener('click',action);return n;};
  const name=m=>m.displayName||m.name;
  const machine=key=>snapshot.machines.find(m=>m.key===key);
  const selection=()=>snapshot?snapshot.machines.filter(m=>selected.has(m.key)):[];
  const spriteUrl=item=>Object.hasOwn(window.AssemblerSprites,item.sprite)?`assets/assembler-items/${item.sprite}.png`:null;
  function itemImage(item,cls='item-image'){const image=el('img',null,cls);image.alt='';const src=spriteUrl(item);if(src)image.src=src;else image.hidden=true;image.addEventListener('error',()=>image.hidden=true);return image;}
  const output=(m,e)=>m.identifier==='moisture_farm'?`${num(e.output)} ml/次 · ${e.tierLabel}`:m.identifier==='mirage_projector'&&snapshot.attraction?`本机 +${num(e.output)} · 运行后店铺 ${num(snapshot.attraction.effective+e.output)}`:`${e.label} ${num(e.output)}`;
  const error=message=>{$('error').textContent=message;$('error').hidden=!message;};
  function stop(force=false){if(busy||force){worker?.terminate();worker=null;}busy=false;$('search-button').disabled=false;$('stop-search').hidden=true;}
  function invalidate(){revision++;stop();result=null;run=null;hideTooltip();$('search-progress').hidden=true;updateSteps();}
  function updateSteps(){document.querySelectorAll('[data-step]').forEach(b=>{const n=Number(b.dataset.step);b.disabled=n>1&&!snapshot||n===3&&!selected.size||n===4&&!result;b.setAttribute('aria-current',n===step?'step':'false');});}
  function go(next,scroll=true){if(busy){revision++;stop();}step=next;for(let i=1;i<=4;i++)$('step-'+i).hidden=i!==next;error('');hideTooltip();updateSteps();if(next===2)renderMachines();if(next===3)renderTargets();if(next===4)renderResult();if(scroll)$('workflow-start').scrollIntoView({block:'start'});}
  function setMode(next){if(mode===next)return;invalidate();mode=next;selected.clear();targets={};$('mode-single').setAttribute('aria-pressed',String(mode==='single'));$('mode-joint').setAttribute('aria-pressed',String(mode==='joint'));go(snapshot?2:1,false);}
  function toggleLock(m){invalidate();if(locks.has(m.key))locks.delete(m.key);else{locks.add(m.key);selected.delete(m.key);}renderMachines();}
  function selectMachine(m){if(m.error||locks.has(m.key))return;invalidate();if(mode==='single')selected=new Set([m.key]);else if(selected.has(m.key))selected.delete(m.key);else selected.add(m.key);renderMachines();}
  function toggleGroup(items){const eligible=items.filter(m=>!m.error&&!locks.has(m.key));if(!eligible.length)return;invalidate();const all=eligible.every(m=>selected.has(m.key));for(const m of eligible)all?selected.delete(m.key):selected.add(m.key);renderMachines();}
  function renderMachines(){
    if(!snapshot)return;
    const unlocated=snapshot.pieces.filter(p=>p.reason==='移出位置未记录，重新导入存档后可用').length;
    $('confirmed-notice').hidden=!snapshot.hasConfirmedAssembly;$('confirmed-notice').textContent='已按你确认的装配更新网页记录。已锁定的机器不会参与下一轮。'+(unlocated?`${unlocated} 件移出模组未记录位置，暂不参与下一轮。`:'')+'实际位置有变化时，请保存游戏并重新导入。';
    $('selection-title').textContent=mode==='single'?'选择一台要装配的机器':'选择参与联合装配的机器';
    $('selection-help').textContent=mode==='single'?'按机器区或功能查找。玩家备注会优先显示。':'可逐台勾选，或整组选择；锁定机器会跳过。不同类型分别设置目标。';
    $('select-all').hidden=$('lock-selection').hidden=mode!=='joint';$('lock-selection').disabled=!selected.size;
    $('group-area').setAttribute('aria-pressed',String(grouping==='area'));$('group-function').setAttribute('aria-pressed',String(grouping==='function'));
    $('selection-count').textContent=`共 ${snapshot.machines.length} 台 · 锁定 ${locks.size} 台`;
    $('selected-summary').textContent=selected.size?(mode==='single'?`已选：${name(selection()[0])} #${selection()[0].key}`:`已选 ${selected.size} 台机器`):'尚未选择机器';$('to-targets').disabled=!selected.size;
    const groups=new Map();for(const m of snapshot.machines){const key=grouping==='area'?m.area.key:m.identifier;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
    $('machine-list').replaceChildren();
    for(const [key,items] of groups){
      const section=el('section',null,'machine-group'),header=el('div',null,'machine-group-head');
      header.append(el('h3',grouping==='area'?`${items[0].area.name}${/^\d+$/.test(key)?' #'+key:''}`:A.profiles[key].name),el('span',`${items.length} 台`));
      if(mode==='joint'){const eligible=items.filter(m=>!m.error&&!locks.has(m.key)),all=eligible.length>0&&eligible.every(m=>selected.has(m.key)),b=button(all?'取消本组':'选择本组',()=>toggleGroup(items));b.disabled=!eligible.length;header.append(b);}
      section.append(header);
      for(const m of items){
        const row=el('div',null,'machine-row'+(selected.has(m.key)?' selected':''));row.dataset.machine=m.key;
        const choose=button('',()=>selectMachine(m),'machine-select');choose.setAttribute('aria-pressed',String(selected.has(m.key)));choose.disabled=!!m.error||locks.has(m.key);choose.setAttribute('aria-label',`选择 ${name(m)} #${m.key}`);
        choose.append(el('span',selected.has(m.key)?'✓':mode==='single'?'○':'□','selection-mark'),itemImage(m));
        const identity=el('span',null,'machine-identity');identity.append(el('strong',name(m)),el('small',`${m.note?m.name+' · ':''}#${m.key} · ${m.stage?'升级 '+m.stage+' 次':'未升级'}`));choose.append(identity);
        const location=el('span',null,'machine-area');location.append(el('span',m.area.name),el('small',`格位 ${m.position}`));choose.append(location);
        const current=el('span',null,'machine-output');current.append(el('span',output(m,m.current||m.saved)),el('small',m.error||`耗电 ${m.current?.power??m.saved.power}`));choose.append(current);
        const lock=button(locks.has(m.key)?'已锁定':'锁定',()=>toggleLock(m),'lock-button');lock.setAttribute('aria-label',`${locks.has(m.key)?'解锁':'锁定'} ${name(m)} #${m.key}`);lock.setAttribute('aria-pressed',String(locks.has(m.key)));row.append(choose,lock);section.append(row);
      }$('machine-list').append(section);
    }
    updateSteps();
  }
  function defaults(id){const primary=['mirage_projector','security_alarm','desequencer'].includes(id)?'outcome':A.profiles[id].primary;return {primary,secondary:primary==='outcome'?'power':'performance',preferred:A.targetPresets(snapshot,id,primary).at(-1)?.[0]??null,minQuality:null,minPerformance:null,maxPower:null,requirements:[]};}
  function selectField(title,choices,value,change){const label=el('label',title),input=el('select');input.setAttribute('aria-label',title);for(const [v,t]of choices){const o=el('option',t);o.value=v;input.append(o);}input.value=value;input.onchange=()=>change(input.value);label.append(input);return label;}
  function numberField(title,value,min,change,max=100000){const label=el('label',title),input=el('input');Object.assign(input,{type:'number',min,max,step:1,placeholder:'不限',value:value??''});input.setAttribute('aria-label',title);input.oninput=()=>{invalidate();change(input.value===''?null:Number(input.value));};label.append(input);return label;}
  function renderTargets(){
    const opened=new Set([...document.querySelectorAll('#target-groups details[open]')].map(n=>n.dataset.section));
    $('target-help').textContent=mode==='single'?`为 ${name(selection()[0])} #${selection()[0].key} 设置目标。`:'同类型机器共用一组目标；不同类型的设置互不影响。';
    $('target-groups').replaceChildren();const groups=new Map();for(const m of selection()){if(!groups.has(m.identifier))groups.set(m.identifier,[]);groups.get(m.identifier).push(m);}
    for(const [id,items]of groups){
      const g=targets[id]??(targets[id]=defaults(id)),card=el('section',null,'target-card'),title=A.profiles[id].name;
      const heading=el('div',null,'target-heading');heading.append(itemImage(items[0]),el('h3',title),el('span',mode==='joint'?`${items.length} 台共用`:`${name(items[0])} #${items[0].key}`));card.append(heading,el('p',items.map(m=>`${name(m)} #${m.key}`).join('、'),'muted'));
      const fields=el('div',null,'target-fields'),fixed=g.primary==='outcome',axes=[['quality','质量'],['performance','性能'],['power','最低耗电']];
      if(fixed){const first=el('div',null,'fixed-target');first.append(el('small','第一目标'),el('strong',id==='mirage_projector'?'店铺吸引力':id==='desequencer'?'处理速度':'阻止率'));const second=el('div',null,'fixed-target');second.append(el('small','第二目标'),el('strong','最低耗电'));fields.append(first,second);}
      else {
        fields.append(selectField(`${title} 第一目标`,axes,g.primary,v=>{invalidate();if(v===g.secondary)g.secondary=g.primary;g.primary=v;g.custom=false;g.preferred=A.targetPresets(snapshot,id,v).at(-1)?.[0]??null;renderTargets();}));
        fields.append(selectField(`${title} 第二目标`,axes.filter(([v])=>v!==g.primary),g.secondary,v=>{invalidate();g.secondary=v;}));
      }
      card.append(fields);
      if(id==='mirage_projector'){const a=snapshot.attraction;card.append(el('p',a?`存档当前店铺 ${num(a.current)} · 基础 ${num(a.base)} − 垃圾扣减 ${num(a.penalty)} = 有效基础 ${num(a.effective)} · ${a.hardMode?'困难':'普通'}模式`:'存档缺少店铺吸引力信息，仅可设置本机贡献。','target-context'));if(snapshot.machines.filter(m=>m.identifier===id).length>1)card.append(el('p','多台投影仪共用一个加成，后运行的覆盖前一台，不叠加。预览为本机运行后的店铺吸引力。','muted'));}
      if(g.primary!=='power'){
        const presets=A.targetPresets(snapshot,id,g.primary),target=el('div',null,'target-fields');
        if(presets.length)target.append(selectField(`${title} 期望目标`,[...presets,['custom','自定义目标']],g.custom?'custom':g.preferred??'custom',v=>{invalidate();g.custom=v==='custom';if(!g.custom)g.preferred=Number(v);renderTargets();}));
        if(!presets.length||g.custom){const offset=id==='mirage_projector'&&snapshot.attraction?snapshot.attraction.effective:0;target.append(numberField(`${title} ${id==='mirage_projector'&&snapshot.attraction?'期望店铺吸引力':'自定义目标'}`,g.preferred==null?null:g.preferred+offset,g.primary==='outcome'?Math.max(0,offset):-10000,v=>g.preferred=v==null?null:v-offset,id==='security_alarm'?100:100000));}
        card.append(target,el('p','优先达到期望目标，再比较第二目标；未达到时保留本次最佳方案。','muted'));
      }
      const advanced=el('details');advanced.dataset.section=id+'-limits';advanced.open=opened.has(advanced.dataset.section);advanced.append(el('summary','组合限制（全部满足）'));const limits=el('div',null,'target-fields');
      for(const [key,text,min]of [['minQuality','每台最低质量（%）',-10000],['minPerformance','每台最低性能（%）',-10000],['maxPower','每台最高耗电',1]])limits.append(numberField(`${title} ${text}`,g[key],min,v=>g[key]=v));advanced.append(limits);card.append(advanced);
      const required=el('details');required.dataset.section=id+'-required';required.open=opened.has(required.dataset.section)||g.requirements.length>0;required.append(el('summary','必选模组（按种类）'),el('p',mode==='joint'?'数量按每台机器计算，共享库存中的同一件模组不能重复使用。':'可设置至少／恰好数量；恰好 0 件表示不使用该种类。','muted'));
      const availableKeys=new Set(items.flatMap(m=>A.availablePieces(snapshot,m,[...locks],$('borrow').checked).map(p=>p.key))),available=snapshot.pieces.filter(p=>availableKeys.has(p.key)),pool=new Map();for(const p of A.availablePieces(snapshot,items[0],[...locks],true))if(!pool.has(p.identifier))pool.set(p.identifier,p);
      for(const r of g.requirements){const p=pool.get(r.identifier)||snapshot.pieces.find(p=>p.identifier===r.identifier);if(!p)continue;const row=el('div',null,'required-row'),identity=el('div',null,'required-identity');identity.append(itemImage(p),el('span',p.name),el('small',`共享可用 ${available.filter(p=>p.identifier===r.identifier).length} 件`));row.append(identity,selectField(`${p.name} 数量规则`,[['atleast','至少'],['exact','恰好']],r.exact?'exact':'atleast',v=>{invalidate();r.exact=v==='exact';}),numberField(`${p.name} ${mode==='joint'?'每台数量':'数量'}`,r.count,0,v=>r.count=v,35),button('移除',()=>{invalidate();g.requirements=g.requirements.filter(x=>x!==r);renderTargets();}));const labels=row.querySelectorAll('label');labels[0].firstChild.textContent='数量规则';labels[1].firstChild.textContent=mode==='joint'?'每台数量':'数量';required.append(row);}
      required.append(selectField(`${title} 添加必选模组`,[['','选择模组或节点…'],...[...pool].filter(([id])=>!g.requirements.some(r=>r.identifier===id)).map(([id,p])=>[id,p.name])],'',value=>{if(!value)return;invalidate();g.requirements.push({identifier:value,count:1,exact:false});renderTargets();}));card.append(required);$('target-groups').append(card);
    }
    updateAvailable();$('search-progress').hidden=true;
  }
  function updateAvailable(){const keys=new Set(selection().flatMap(m=>A.availablePieces(snapshot,m,[...locks],$('borrow').checked).map(p=>p.key)));$('available-count').textContent=`${selection().length} 台机器 · 可用 ${keys.size} 件模组／节点`;}
  async function importFile(file){
    const ticket=++revision;stop(true);snapshot=null;for(const key of Object.keys(history))delete history[key];jointSeed=null;moves={};guideOpen={};bestPlans={};selected.clear();locks.clear();targets={};result=run=null;$('save-bar').hidden=true;go(1);
    if(!file||!file.size||file.size>40*1024*1024){error('请选择非空且不超过 40 MB 的存档。');return;}$('import-status').textContent='正在读取存档…';
    try{const text=await file.text();if(ticket!==revision)return;worker??=new Worker('assets/assembler-worker.js',{type:'module'});worker.onerror=()=>{if(ticket===revision){stop();error('存档读取失败，请重试。');}};
      worker.onmessage=({data})=>{if(ticket!==revision)return;if(data.type==='error'){stop();error(data.message);$('import-status').textContent='读取未完成，请检查存档。';return;}if(data.type!=='parsed')return;stop();snapshot=data.snapshot;$('save-status').textContent=`${file.name} · 第 ${snapshot.day??'?'} 天 · ${snapshot.machines.length} 台机器 · ${snapshot.pieces.length} 件模组／节点`;$('save-bar').hidden=false;go(2);if(!snapshot.machines.length)error(snapshot.warnings.join('；'));};worker.postMessage({type:'parse',text});
    }catch(e){if(ticket===revision){stop();error(e.message);}}
  }
  function startSearch(event){event.preventDefault();if(busy||!selected.size)return;error('');const machines=selection(),options={targets:structuredClone(targets),borrow:$('borrow').checked,locks:[...locks],...A.searchBudget($('search-mode').value)};
    const searchKey=A.searchContextKey(mode,machines,options);
    let retainedBest=null;try{if(bestPlans[searchKey])retainedBest=A.validateJoint(snapshot,machines,options,bestPlans[searchKey]);}catch{delete bestPlans[searchKey];}
    const ticket=++revision;stop();result=retainedBest;run={mode,machines,options,searchKey,retained:!!retainedBest};searchPreviewSignature="";activeKey=machines[0].key;busy=true;$('search-button').disabled=true;$('search-progress').hidden=false;$('stop-search').hidden=false;$('progress').value=0;$('search-status').textContent=mode==='joint'?'正在搜索共享库存中的整体方案…':'正在搜索装配方案…';renderSearchBest();updateSteps();
    try{worker??=new Worker('assets/assembler-worker.js',{type:'module'});worker.onerror=()=>{if(ticket===revision){stop();error('计算任务失败，请重试。');}};worker.onmessage=({data})=>{if(ticket!==revision)return;if(data.type==='error'){stop();error(data.message);return;}
      if(data.type==='loading'){$('progress').removeAttribute('value');$('search-status').textContent=data.message;return;}
      if(data.best){try{result=A.preferLocalPieces(snapshot,machines,options,mode==='joint'?data.best:{machines:{[machines[0].key]:data.best}});}catch(e){stop();error(e.message);return;}}
      if(result){jointSeed=Object.fromEntries(Object.entries(result.machines).map(([key,p])=>[key,p.placements]));bestPlans[searchKey]=result;}renderSearchBest();
      $('progress').value=Math.min(100,(data.elapsed||0)/(options.exhaustive?300:options.seconds)*100);
      const phase=data.phase==='exhaustive'?'正在检查剩余排列':'正在寻优';
      $('search-status').textContent=`${phase} · ${num(data.elapsed||0)} 秒 · 已比较 ${num(data.layouts||0)} 个机器布局`+(mode==='joint'?` / ${num(data.evaluated||0)} 个整体方案`:result?` · 当前最佳：${output(machines[0],result.machines[machines[0].key].evaluation)}`:'');
      if(data.type==='done'){
        if(data.hints)history[machines[0].key]=data.hints;
        if(result)for(const [key,p]of Object.entries(result.machines))history[key]=[p.placements,...(history[key]||[])].slice(0,96);
        busy=false;stop();if(result){$('result-status').textContent=$('search-status').textContent.replace(phase,'搜索完成')+' · '+(data.isExhaustive?'已检查全部可行排列':data.timeLimitReached?'已达时间上限，保留本次最佳方案':'本次最佳可行方案，尚未穷尽');go(4);}else error('本次未找到满足全部限制的方案。可放宽限制或允许借用更多模组；未找到不代表无解。');
      }
    };worker.postMessage({type:mode==='joint'?'joint':'search',snapshot,machines,options,history,jointSeed,retainedBest});
    }catch(e){stop();error(e.message);}
  }
  function comparisonRow(label,before,after,higher=true,unit=''){
    const row=el('div',null,'summary-metric'),heading=el('div',label,'metric-heading'),values=el('div',null,'metric-values');
    values.append(el('span',typeof before==='number'?num(before)+unit:before,'metric-before'),el('span','→','metric-arrow'),el('strong',typeof after==='number'?num(after)+unit:after));
    if(typeof before==='number'&&typeof after==='number'){
      const d=after-before,n=el('small',d===0?'不变':signed(d)+unit);n.className=d!==0&&(d>0)!==higher?'worse':'delta';heading.append(n);
      const bars=el('div',null,'metric-bars'),scale=Math.max(Math.abs(before),Math.abs(after),1);
      for(const [value,cls]of [[before,'bar-before'],[after,'bar-after']]){const bar=el('span',null,cls);bar.style.width=Math.abs(value)/scale*100+'%';bars.append(bar);}bars.setAttribute('aria-hidden','true');row.append(heading,values,bars);
    }else row.append(heading,values);return row;
  }
  function machineRows(m,b,a){const rows=[];if(m.identifier==='mirage_projector'&&snapshot.attraction)rows.push(comparisonRow('本机运行后店铺吸引力',snapshot.attraction.effective+b.output,snapshot.attraction.effective+a.output));if(m.identifier==='moisture_farm')rows.push(comparisonRow('水质',b.tierLabel,a.tierLabel));rows.push(comparisonRow(b.label,b.output,a.output,m.identifier!=='water_purifier'),comparisonRow('质量',b.quality,a.quality,true,'%'),comparisonRow('耗电',b.power,a.power,false));return rows;}
  function jointRows(machines,candidate,options){const before={machines:Object.fromEntries(machines.map(m=>[m.key,{evaluation:m.current}]))},b=A.jointSummary(machines,before,options),a=A.jointSummary(machines,candidate,options),rows=[];
      rows.push(comparisonRow('达到期望目标',`${b.reached}/${b.count} 台`,`${a.reached}/${a.count} 台`));if(machines.some(m=>m.identifier==='moisture_farm')){const grades=['污水','锈水','幽水','基础水','优质水','纯水'];for(let i=5;i>=0;i--)if(i>=3||b.water[i]||a.water[i])rows.push(comparisonRow(grades[i],b.water[i],a.water[i],true,' ml'));rows.push(comparisonRow('总产水量',b.water.reduce((s,v)=>s+v,0),a.water.reduce((s,v)=>s+v,0),true,' ml'));}rows.push(comparisonRow('总耗电',b.power,a.power,false));return rows;}
  function renderSearchBest(){
    $('search-best').hidden=!result;
    if(!result)return;
    const signature=JSON.stringify([run.searchKey,run.retained,Object.values(result.machines).map(p=>['output','tier','performance','efficiency','quality','power'].map(k=>p.evaluation[k]))]);
    if(signature===searchPreviewSignature)return;searchPreviewSignature=signature;
    $('search-best-title').textContent=run.mode==='joint'?'当前最佳 · 整组效果':'当前最佳 · 本机效果';
    $('search-best-note').textContent=(run.retained?'已保留同条件的历史最佳。':'')+'找到更优方案时更新；停止后保留当前方案。';
    const m=run.machines[0];
    const rows=run.mode==='joint'?jointRows(run.machines,result,run.options):machineRows(m,m.current,result.machines[m.key].evaluation);
    if(run.mode==='joint')for(const item of run.machines.filter(m=>m.identifier!=='moisture_farm'))rows.push(comparisonRow(`${name(item)} #${item.key} · ${item.current.label}`,item.current.output,result.machines[item.key].evaluation.output,item.identifier!=='water_purifier'));
    else for(const [axis,label]of [['performance','性能'],['efficiency','效率']])rows.push(comparisonRow(label,m.current[axis],result.machines[m.key].evaluation[axis],true,'%'));
    $('search-best-metrics').replaceChildren(...rows);
  }
  function renderResult(){
    if(!result||!run)return;const joint=run.mode==='joint',m=machine(activeKey),plan=result.machines[activeKey];
    $('result-title').textContent=joint?`${run.machines.length} 台机器的联合方案`:`${name(m)}的装配方案`;$('summary-title').textContent=joint?'参与机器总体对比':'效果对比';$('result-machines-wrap').hidden=!joint;
    if(joint){$('overall-metrics').replaceChildren(...jointRows(run.machines,result,run.options));
      $('result-machines').replaceChildren(...run.machines.map(item=>{const b=button('',()=>{activeKey=item.key;hideTooltip();renderResult();},'result-machine');b.setAttribute('aria-pressed',String(item.key===activeKey));b.append(itemImage(item),el('strong',`${name(item)} #${item.key}`),el('small',output(item,item.current)+' → '+output(item,result.machines[item.key].evaluation)));return b;}));
    }else $('overall-metrics').replaceChildren(...machineRows(m,m.current,plan.evaluation));
    $('goal-note').textContent=joint?(run.machines.some(m=>m.identifier==='moisture_farm'&&run.options.targets[m.identifier].primary==='quality')?'优先比较总纯水，再比较优质水、基础水等产量；达标台数仅供参考。':'按各类型目标比较整体方案。每件模组只分配一次。'):'调整前来自存档或你已确认的装配。按右侧方案和下方清单操作。';
    $('machine-picture').replaceChildren(itemImage(m,'machine-portrait'));$('board-title').textContent=`${name(m)} #${m.key}`;$('machine-location').textContent=`${m.note?m.name+' · ':''}${m.source} · 本机格位 ${m.position}`;
    const caption=(id,e)=>{const stats=el('span',null,'board-stats');for(const [label,value]of [['性能',signed(e.performance)+'%'],['效率',signed(e.efficiency)+'%'],['质量',e.quality+'%'],['耗电',e.power]]){const stat=el('span');stat.append(el('small',label),el('b',value));stats.append(stat);}$(id).replaceChildren(el('strong',output(m,e),'board-output'),stats);};
    caption('before-caption',m.current);caption('after-caption',plan.evaluation);
    $('complete-plan').textContent=joint?`已装好并锁定这 ${run.machines.length} 台`:'已装好并锁定本机';
    const order=plan.placements.slice().sort((a,b)=>a.y-b.y||a.x-b.x),keys=[...new Set([...order,...m.installed].map(p=>p.key))],labels=new Map(keys.map((key,i)=>[key,i+1]));
    renderBoard('board-before',m,m.installed,m.current,labels,false);renderBoard('board-after',m,plan.placements,plan.evaluation,labels,true);renderSources(m,plan,order,labels);renderDonors();
  }
  function svg(tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));if(text!=null)n.textContent=text;return n;}
  function renderBoard(id,m,placements,evaluation,labels,proposed){
    const canvas=svg('svg',{viewBox:'0 0 400 295',role:'group','aria-label':`${name(m)} ${proposed?'方案配装':'原配装'}`}),size=50,ox=36,oy=26;
    for(let x=0;x<7;x++)canvas.append(svg('text',{x:ox+x*size+25,y:16,'text-anchor':'middle',class:'board-label'},x+1));
    for(let y=0;y<5;y++){canvas.append(svg('text',{x:18,y:oy+y*size+30,'text-anchor':'middle',class:'board-label'},y+1));for(let x=0;x<7;x++){const blocked=!!(BigInt(m.blocked)&(1n<<BigInt(y*7+x)));canvas.append(svg('rect',{x:ox+x*size,y:oy+y*size,width:size,height:size,class:blocked?'board-cell blocked':'board-cell'}));if(blocked)canvas.append(svg('text',{x:ox+x*size+25,y:oy+y*size+30,'text-anchor':'middle',class:'board-label'},'×'));}}
    for(const pl of placements){const p=snapshot.pieces.find(p=>p.key===pl.key),shape=A.transform(p.shape,pl.rotation,pl.flipped),index=labels.get(p.key),g=svg('g',{class:'piece-shape',tabindex:0,role:'button','aria-label':`${index} ${name(p)} #${p.key}`,'data-piece':p.key,style:`--piece-color:${colors[(index-1)%colors.length]}`});
      const cells=new Set(shape.cells.map(c=>`${c.x}:${c.y}`));let edges='';for(const c of shape.cells){const x=ox+(pl.x+c.x)*size,y=oy+(pl.y+c.y)*size;g.append(svg('rect',{x:x+1,y:y+1,width:48,height:48,class:'piece-cell'}));if(!cells.has(`${c.x-1}:${c.y}`))edges+=`M${x+1},${y+1}v48`;if(!cells.has(`${c.x+1}:${c.y}`))edges+=`M${x+49},${y+1}v48`;if(!cells.has(`${c.x}:${c.y-1}`))edges+=`M${x+1},${y+1}h48`;if(!cells.has(`${c.x}:${c.y+1}`))edges+=`M${x+1},${y+49}h48`;}
      const url=spriteUrl(p);if(url){const w=p.shape.width*size,h=p.shape.height*size,rot=['',`matrix(0 -1 1 0 0 ${w})`,`matrix(-1 0 0 -1 ${w} ${h})`,`matrix(0 1 -1 0 ${h} 0)`];g.append(svg('image',{href:url,width:w,height:h,transform:`translate(${ox+pl.x*size} ${oy+pl.y*size}) ${rot[pl.rotation]} ${pl.flipped?`translate(${w} 0) scale(-1 1)`:''}`,class:'board-item-image','pointer-events':'none'}));}
      g.append(svg('path',{d:edges,class:'piece-outline'}));const first=shape.cells.slice().sort((a,b)=>a.y-b.y||a.x-b.x)[0],x=ox+(pl.x+first.x)*size+3,y=oy+(pl.y+first.y)*size+3;g.append(svg('rect',{x,y,width:20,height:17,rx:2,class:'board-number'}),svg('text',{x:x+10,y:y+13,'text-anchor':'middle',class:'piece-number'},index));
      g.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!compactDetails()&&!pinned&&!hoverSuppressed)showPiece(p,pl,evaluation,proposed,false,e);});g.addEventListener('pointermove',e=>{if(!pinned&&!$('piece-tooltip').hidden)positionTooltip(e);});g.addEventListener('pointerleave',()=>{hoverSuppressed=false;if(!pinned)hideTooltip();});g.addEventListener('focus',e=>{if(!compactDetails()&&!pinned)showPiece(p,pl,evaluation,proposed,false,e);});g.addEventListener('blur',()=>{if(!pinned)hideTooltip();});g.addEventListener('click',e=>showPiece(p,pl,evaluation,proposed,true,e));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPiece(p,pl,evaluation,proposed,true,e);}});canvas.append(g);
    }$(id).replaceChildren(canvas);
  }
  const direction=pl=>`${pl.flipped?'先水平翻转，再':''}逆时针 ${pl.rotation*90}°`;
  const compactDetails=()=>matchMedia('(max-width:600px), (pointer:coarse)').matches;
  function positionTooltip(event){const box=$('piece-tooltip');if(compactDetails()){box.style.left=box.style.top='';return;}const anchor=event?.currentTarget?.getBoundingClientRect?.(),x=event?.clientX||anchor?.right||innerWidth/2,y=event?.clientY||anchor?.top||innerHeight/2,w=box.offsetWidth,h=box.offsetHeight;box.style.left=Math.max(12,Math.min(x+18+w>innerWidth-12?x-w-18:x+18,innerWidth-w-12))+'px';box.style.top=Math.max(12,Math.min(y+18,innerHeight-h-12))+'px';}
  function showPiece(p,pl,evaluation,proposed,pin,event){pinned=pin;if(pin)detailTrigger=event?.currentTarget;const t=$('piece-detail');t.replaceChildren(itemImage(p,'detail-image'),el('small',`${proposed?'方案配装':'原配装'} · #${p.key}`),el('h3',name(p)));if(p.note)t.append(el('p',p.name));const dl=el('dl'),stats=evaluation.perPiece[p.key]||p.base;for(const [key,label]of [['performance','性能'],['efficiency','效率'],['quality','质量']])dl.append(el('dt',label),el('dd',signed(stats[key])+'%'));t.append(dl,el('p',`来源：${p.source} · 原格位 ${p.position}`),el('p',`图中格位：(${pl.x+1}, ${pl.y+1}) · ${direction(pl)}`));if(p.effects.length)t.append(el('p',p.effects.map(e=>A.effectNames[e]||e).join(' · ')));if(p.description)t.append(el('p',p.description));$('piece-tooltip').classList.toggle('pinned',pin);$('piece-tooltip').hidden=false;$('piece-tooltip').scrollTop=0;positionTooltip(event);document.querySelectorAll('[data-piece]').forEach(n=>n.classList.toggle('active',n.dataset.piece===p.key));}
  function hideTooltip(){pinned=false;$('piece-tooltip').hidden=true;document.querySelectorAll('[data-piece].active').forEach(n=>n.classList.remove('active'));}
  function renderSources(m,plan,order,labels){
    $('guide-intro').textContent='先移出，再按箭头装配。位置来自存档中的库存、柜台和储物容器；剩余空位请在游戏中确认。';
    $('source-count').textContent=`${order.length} 件模组／节点`;$('sources').replaceChildren();
    const assigned=new Map(Object.entries(result.machines).flatMap(([key,p])=>p.placements.map(pl=>[pl.key,{machineKey:key,...pl}])));
    const groups=A.assemblyActions(m,plan);
    const coords=value=>String(value).replace(/[()]/g,c=>c==='('? '[':']').replace(/,\s*/g,',');
    const sourcePath=p=>p.source.split(' › ').filter((_,i,all)=>i>0||all.length===1).map(part=>coords(part.replace(/ #\d+(?= \()/g,'').replace(/ (?=\()/g,''))).join('·')+'·原格位'+coords(p.position);
    const destinationText=d=>`${d.machineKey===m.key?'本机':name(machine(d.machineKey))+coords(machine(d.machineKey).position)+'·格位'}[${d.x+1},${d.y+1}]`;
    const shortDirection=d=>[d.flipped?'翻转':'',d.rotation?`逆时针 ${d.rotation*90}°`:'0°'].filter(Boolean).join(' · ');
    for(const [kind,title] of [['out','移出机器'],['move','机器内移动'],['in','移入机器'],['stay','无需移动']]){
      const section=el('details',null,'move-group'),sectionKey=m.key+':'+kind;section.dataset.kind=kind;section.open=guideOpen[sectionKey]??(kind!=='stay'&&groups[kind].length>0);
      section.append(el('summary',`${title} · ${groups[kind].length} 件`));
      section.ontoggle=()=>{guideOpen[sectionKey]=section.open;saveSession();};
      if(!groups[kind].length){section.append(el('p','无','muted'));$('sources').append(section);continue;}
      const list=el('div',null,'move-list');
      for(const pl of groups[kind]){
        const p=snapshot.pieces.find(p=>p.key===pl.key),destination=assigned.get(p.key),row=el('article',null,'move-item');row.dataset.piece=p.key;
        const identity=button('',e=>showPiece(p,pl,kind==='out'?m.current:plan.evaluation,kind!=='out',true,e),'source-piece');identity.append(el('span',labels.get(p.key),'piece-badge'),itemImage(p),el('strong',`${name(p)} #${p.key}`));
        const route=el('div',null,'move-route'),source=el('span',sourcePath(p),'move-from');source.title=`导入时：${p.source} · 原格位 ${p.position}`;
        route.append(source,el('span','→','move-arrow'));
        const state=moves[p.key]??(moves[p.key]={taken:false,installed:null,temporary:''});
        const storedLocation=()=>state.storage!==undefined?[state.storage,state.storageSlot].filter(Boolean).join('·'):state.temporary;
        if(kind==='out'){
          const location=el('select');location.setAttribute('aria-label',`模组 #${p.key} 存放位置`);
          const empty=el('option',snapshot.storage?'选择存放位置':'重新导入以读取位置');empty.value='';location.append(empty);
          for(const storage of snapshot.storage||[]){const option=el('option',storage.label);option.value=storage.key;option.title=storage.source;location.append(option);}
          location.value=state.storageKey||'';location.disabled=!snapshot.storage;
          const slot=el('input');slot.type='text';slot.maxLength=80;slot.placeholder='格位／备注（可选）';slot.setAttribute('aria-label',`模组 #${p.key} 存放格位`);slot.value=state.storageSlot??(state.storage===undefined?state.temporary:'')??'';
          route.append(location,slot);
          location.onchange=()=>{state.storageKey=location.value;state.storage=snapshot.storage.find(s=>s.key===location.value)?.label||'';state.storageSlot=slot.value;state.temporary=storedLocation();refresh();saveSession();};
          slot.oninput=()=>{state.storageSlot=slot.value;state.temporary=state.storage?[state.storage,slot.value].filter(Boolean).join('·'):slot.value;saveSession();};
          if(destination)route.append(el('small',`后续 → ${destinationText(destination)}`,'move-next'));
        }else{
          route.append(el('strong',kind==='stay'?'原位不动':destinationText(destination),'move-to'));
          if(kind!=='stay'&&shortDirection(destination))route.append(el('small',shortDirection(destination),'move-turn'));
        }
        row.append(identity,route);
        const doneLabel=el('label',null,'move-complete'),done=el('input');done.type='checkbox';done.setAttribute('aria-label',`完成 ${title} 模组 #${p.key}`);doneLabel.append(done,document.createTextNode('完成'));
        function refresh(){
          const placed=state.installed&&destination&&['machineKey','x','y','rotation','flipped'].every(k=>state.installed[k]===destination[k]);
          done.checked=kind==='out'?state.taken:!!placed;done.disabled=kind==='out'&&!state.storage&&!state.taken;
          if(kind==='in'&&state.taken&&storedLocation()){source.textContent=storedLocation();source.title=`已记录存放位置；导入时：${p.source} · 原格位 ${p.position}`;}
          row.classList.toggle('move-done',done.checked);
        }
        done.onchange=()=>{state.taken=done.checked;state.installed=kind!=='out'&&done.checked?{...destination}:null;refresh();saveSession();};
        if(kind!=='stay'){refresh();row.append(doneLabel);}
        list.append(row);
      }
      section.append(list);$('sources').append(section);
    }
    $('sources').append(el('p','原格位来自导入存档；进度需手动标记。完成装配后，保存游戏并重新导入。','muted'));
  }
  $('complete-plan').onclick=()=>{
    try{
      const completed=run.machines.map(m=>m.key);
      snapshot=A.completeAssembly(snapshot,run.machines,run.options,result,moves);
      completed.forEach(key=>locks.add(key));selected.clear();invalidate();
      for(const key of Object.keys(history))delete history[key];jointSeed=null;moves={};guideOpen={};bestPlans={};
      go(2);saveSession();
    }catch(e){error(e.message);}
  };
  function renderDonors(){const used=new Set(Object.values(result.machines).flatMap(p=>p.placements.map(pl=>pl.key))),donors=snapshot.machines.filter(m=>!result.machines[m.key]&&m.installed.some(pl=>used.has(pl.key)));$('impact-wrap').hidden=$('donor-link').hidden=!donors.length;$('donor-link').textContent=`查看 ${donors.length} 台借出机器的变化`; $('impact-title').textContent=`另有 ${donors.length} 台未参与机器借出模组 · 查看影响`;$('impacts').replaceChildren(...donors.map(m=>{const after=A.evaluate(m,snapshot.pieces,m.installed.filter(pl=>!used.has(pl.key))),row=el('tr');row.append(el('td',`${name(m)} #${m.key}`),el('td',output(m,m.current)+' → '+output(m,after)),el('td',`${m.current.power} → ${after.power}`));return row;}));}
  $('mode-single').onclick=()=>setMode('single');$('mode-joint').onclick=()=>setMode('joint');document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{if(!b.disabled)go(Number(b.dataset.step));});
  $('group-area').onclick=()=>{grouping='area';renderMachines();};$('group-function').onclick=()=>{grouping='function';renderMachines();};$('select-all').onclick=()=>toggleGroup(snapshot.machines);$('lock-selection').onclick=()=>{const keys=[...selected];invalidate();for(const key of keys)locks.add(key);selected.clear();renderMachines();};$('to-targets').onclick=()=>go(3);$('back-selection').onclick=()=>go(2);$('edit-targets').onclick=()=>go(3);$('change-save').onclick=()=>{revision++;stop();go(1);};
  $('search-form').onsubmit=startSearch;$('borrow').onchange=()=>{invalidate();renderTargets();};$('stop-search').onclick=()=>{revision++;stop();if(result){for(const [key,p]of Object.entries(result.machines))history[key]=[p.placements,...(history[key]||[])].slice(0,96);$('result-status').textContent='搜索已停止 · 保留已找到的可行方案';go(4);}else error('搜索已停止，尚未找到满足限制的方案。');};
  $('save-file').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)importFile(file);};$('drop-zone').ondragover=e=>e.preventDefault();$('drop-zone').ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length!==1){error('请一次选择一个存档。');return;}importFile(e.dataTransfer.files[0]);};$('copy-path').onclick=async()=>{try{await navigator.clipboard.writeText('%USERPROFILE%\\AppData\\LocalLow\\Questing Goose Studio\\Probably Stolen');$('copy-path').textContent='已复制';}catch{$('copy-path').textContent='请手动复制上方路径';}};
  $('donor-link').onclick=()=>{$('impact-wrap').open=true;$('impact-wrap').scrollIntoView({block:'center'});};
  window.assemblerFeedbackContext=()=>JSON.stringify({tool:'模块组装器',version:snapshot?.version||null,mode,selected:selection().map(m=>({type:m.identifier,key:m.key})),locks:[...locks],borrow:$('borrow').checked,targets,status:busy?'计算中':result?'已生成':'未生成',results:result?Object.fromEntries(Object.entries(result.machines).map(([key,p])=>[key,{performance:p.evaluation.performance,quality:p.evaluation.quality,power:p.evaluation.power,output:p.evaluation.output}])):null},null,2);
  document.addEventListener('pointerdown',e=>{if(!$('piece-tooltip').hidden&&!e.target.closest('#piece-tooltip,.piece-shape,.source-piece'))hideTooltip();});
  window.addEventListener('resize',hideTooltip);window.addEventListener('scroll',()=>{if(!compactDetails())hideTooltip();});
  const saveSession=ToolSession.bind('assembler',()=>({snapshot,mode,step:busy&&result?4:step,grouping,selected:[...selected],locks:[...locks],targets,result,run,activeKey,history,jointSeed,moves,guideOpen,bestPlans,borrow:$('borrow').checked,searchMode:$('search-mode').value,saveStatus:$('save-status').textContent,resultStatus:busy?'搜索已暂停 · 保留离开页面前找到的方案':$('result-status').textContent}));
  function restoreSession(){
    const saved=ToolSession.read('assembler');if(!saved)return;
    try{
      if(!['single','joint'].includes(saved.mode))return;
      mode=saved.mode;grouping=saved.grouping==='function'?'function':'area';
      $('mode-single').setAttribute('aria-pressed',String(mode==='single'));$('mode-joint').setAttribute('aria-pressed',String(mode==='joint'));
      if(!saved.snapshot)return;
      snapshot=saved.snapshot;selected=new Set(saved.selected);locks=new Set(saved.locks);targets=saved.targets;run=saved.run;activeKey=saved.activeKey;result=saved.result;
      Object.assign(history,saved.history);jointSeed=saved.jointSeed;moves=saved.moves||{};guideOpen=saved.guideOpen||{};bestPlans=saved.bestPlans||{};$('borrow').checked=saved.borrow;$('search-mode').value=saved.searchMode;
      $('save-status').textContent=saved.saveStatus;$('save-bar').hidden=false;$('result-status').textContent=saved.resultStatus;
      if(result){result=A.validateJoint(snapshot,run.machines,run.options,result);bestPlans[A.searchContextKey(run.mode,run.machines,run.options)]=result;}
      go(saved.step===4&&result?4:saved.step===3&&selected.size?3:saved.step===1?1:2,false);
    }catch{snapshot=null;selected.clear();locks.clear();targets={};result=run=null;for(const key of Object.keys(history))delete history[key];jointSeed=null;$('save-bar').hidden=true;go(1,false);error('上次装配数据无法恢复，请重新导入存档。');}
  }
  const closeDetails=()=>{hoverSuppressed=true;if(pinned)detailTrigger?.focus({preventScroll:true});hideTooltip();};$('close-tooltip').onclick=closeDetails;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetails();});go(1,false);restoreSession();
})();
