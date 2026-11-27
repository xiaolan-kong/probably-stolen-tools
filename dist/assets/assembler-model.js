/* Read-only adapter for the Easy Save text dialect: VERSION 100 and Demo 049-Rev5-L. */
(function(root) {
  'use strict';
  function parseSaveText(text) {
    if (typeof text !== 'string' || text.length > 40 * 1024 * 1024) throw Error('存档为空或超过 40 MB。');
    let i = 0, nodes = 0;
    const fail = () => { throw Error(`存档格式不完整或暂不支持（字符 ${i + 1}）。请等待游戏保存结束后重新选择。`); };
    const space = () => { while (/\s/.test(text[i] || '') && i < text.length) i++; };
    function string() {
      if (text[i++] !== '"') fail();
      let result = '';
      while (i < text.length) {
        let c = text[i++];
        if (c === '"') return result;
        if (c === '\\') {
          c = text[i++];
          const escapes = {'"':'"', '\\':'\\', '/':'/', b:'\b', f:'\f', n:'\n', r:'\r', t:'\t'};
          if (Object.hasOwn(escapes, c)) result += escapes[c];
          else if (c === 'u') {
            const hex = text.slice(i, i + 4); if (!/^[0-9a-f]{4}$/i.test(hex)) fail();
            result += String.fromCharCode(parseInt(hex, 16)); i += 4;
          } else if ('“”‘’'.includes(c)) result += c; // ES3 also escapes localized quotation marks.
          else fail();
        } else { if (c.charCodeAt(0) < 32) fail(); result += c; }
      }
      fail();
    }
    function value(depth = 0) {
      if (depth > 100 || ++nodes > 1500000) throw Error('存档层级或内容数量超过支持范围。');
      space(); const c = text[i];
      if (c === '"') return string();
      if (c === '{' || c === '[') {
        const array = c === '[', end = array ? ']' : '}', out = array ? [] : Object.create(null);
        i++; space(); if (text[i] === end) { i++; return out; }
        while (i < text.length) {
          if (array) out.push(value(depth + 1));
          else {
            space(); let key;
            if (text[i] === '"') key = string();
            else { const m = /^-?\d+/.exec(text.slice(i)); if (!m) fail(); key = m[0]; i += key.length; }
            if (Object.hasOwn(out, key)) throw Error('存档包含重复字段，无法可靠读取。');
            space(); if (text[i++] !== ':') fail(); out[key] = value(depth + 1);
          }
          space(); const next = text[i++]; if (next === end) return out; if (next !== ',') fail();
        }
        fail();
      }
      for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) {
        if (text.startsWith(literal, i)) { i += literal.length; return result; }
      }
      const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (!m) fail(); i += m[0].length; const n = Number(m[0]); if (!Number.isFinite(n)) fail(); return n;
    }
    const result = value(); space(); if (i !== text.length) fail(); return result;
  }
  const profiles = {
    moisture_farm: {name:'水分收集器', power:4, primary:'quality', tiers:true},
    water_purifier: {name:'净水器', power:5, primary:'quality', tiers:true},
    furnace: {name:'熔炉', power:8, primary:'quality', tiers:true},
    wine_rack: {name:'催陈器', power:24, primary:'quality', tiers:true},
    mirage_projector: {name:'幻影投影仪', power:16, primary:'performance'},
    security_alarm: {name:'警报系统', power:4, primary:'performance'},
    desequencer: {name:'密码解序器', power:10, primary:'performance'},
    hydroponic: {name:'水培机', power:8, primary:'performance'},
    plant_dna_manipulator: {name:'DNA 操作机', power:12, primary:'quality'},
    printer: {name:'3D 打印机', power:8, primary:'performance'},
    deal_maker: {name:'议价设备', power:25, primary:'quality'},
    evaporator: {name:'蒸发器', power:6, primary:'quality'}
  };
  const effectNames = {MODULE_EFFECT_PREMIUM:'优质', MODULE_EFFECT_INFERIOR:'劣质',
    MODULE_EFFECT_LEARNING_ALGORITHM:'自学习', MODULE_EFFECT_DEGRADING:'退化', MODULE_EFFECT_OVERVOLTED:'超压',
    MODULE_EFFECT_RECEIVER:'接收器', MODULE_EFFECT_TOP_MOUNT:'顶部安装', MODULE_EFFECT_SIDE_MOUNT:'侧面安装',
    MODULE_EFFECT_NEGATIVE_FEEDBACK:'负反馈', NODE_EFFECT_SUPPORT:'支援节点'};
  const axes = ['performance','efficiency','quality'];
  const bp = (obj, key) => obj?.[`<${key}>k__BackingField`];
  const plain = text => String(text ?? '').replace(/<[^>]*>/g, '').slice(0, 2000);
  function integer(n, label, min=-2147483648, max=2147483647) {
    if (!Number.isSafeInteger(n) || n < min || n > max) throw Error(`${label}超出支持范围。`); return n;
  }
  function shapeOf(raw) {
    const width=integer(bp(raw,'width'),'形状宽度',1,64), height=integer(bp(raw,'height'),'形状高度',1,64);
    if (!Array.isArray(raw.data) || raw.data.length!==width*height || raw.data.some(v=>v!==0&&v!==1)) throw Error('物品形状数据不完整。');
    return {width,height,cells:raw.data.flatMap((v,i)=>v ? [{x:i%width,y:Math.floor(i/width)}] : [])};
  }
  function transform(shape, rotation=0, flipped=false) {
    integer(rotation,'旋转方向',0,3);
    return {width:rotation%2?shape.height:shape.width,height:rotation%2?shape.width:shape.height,
      cells:shape.cells.map(c=>{const x=flipped?shape.width-1-c.x:c.x,y=c.y;
        return rotation===0?{x,y}:rotation===1?{x:y,y:shape.width-1-x}:rotation===2?{x:shape.width-1-x,y:shape.height-1-y}:{x:shape.height-1-y,y:x};})};
  }
  function geometry(piece, placement, machine = {}) {
    const shape=transform(piece.shape,placement.rotation,placement.flipped), {x,y}=placement;
    const width=machine.width??7,height=machine.height??5;
    integer(x,'目标列',0,width-1); integer(y,'目标行',0,height-1);
    if(x+shape.width>width || y+shape.height>height) throw Error('模组超出机器边界。');
    let mask=0n,touch=0n;
    for(const c of shape.cells) {const xx=x+c.x, yy=y+c.y,bit=yy*width+xx;mask|=1n<<BigInt(bit);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) if(xx+dx>=0&&xx+dx<width&&yy+dy>=0&&yy+dy<height) touch|=1n<<BigInt((yy+dy)*width+xx+dx);
    }
    return {mask,touch:touch&~mask};
  }
  const compatible = (machine,piece) => piece.effects.every(e=>Object.hasOwn(effectNames,e)) &&
    (piece.kind==='node'||piece.allowed.includes(machine.identifier));
  // Captured with the published Mod's native rule reader on Build 26525552.
  const purityThresholds=[15,25,50,75,100,200];
  const purityCaps=[99.01,99.16,99.36,99.65,99.8,99.9,100];
  function readParameters(id,tags) {
    const read=(key,fallback)=>tags[key]===undefined&&fallback!==undefined?fallback:integer(tags[key]?.valueInt,key);
    const ratio=key=>tags[key]?.valueEnabled?integer(read(key),key,1):null;
    const params={basePower:integer(read('MACHINERY_DRAWN_POWER_BASE'),'基础耗能',0),
      performanceRatio:ratio('MACHINE_PERFORMANCE_RATIO_INT'),efficiencyRatio:ratio('MACHINE_EFFICIENCY_RATIO_INT'),
      performanceReducesPower:!!tags.MACHINE_PERFORMANCE_REDUCES_POWER_TAG?.valueEnabled,
      qualityRatio:read('MACHINE_QUALITY_RATIO_INT',0),processLowPower:!!tags.LOW_POWER_MODE_BOOL?.valueBool,
      processUsesSystemPower:['printer','evaporator'].includes(id)&&!!tags.SYSTEM_TAG?.valueEnabled};
    if(['desequencer','hydroponic','plant_dna_manipulator','printer'].includes(id))params.baseProcessingSpeed=integer(read('BASE_PROCESSING_SPEED_TAG'),'基础处理速度',0);
    if(id==='water_purifier'){
      params.purityThresholds=purityThresholds;
      params.purityCaps=purityCaps;
    }
    if(id==='mirage_projector'){
      params.projectorPerformanceRatio=Math.max(1,read('MACHINE_PERFORMANCE_RATIO_INT',0));
      params.projectorQualityRatio=Math.max(1,read('MACHINE_QUALITY_RATIO_INT',0));
    }
    return params;
  }
  function formalStats(machine,stats,blast) {
    const v=machine.parameters,{performance:p,efficiency:e,quality:q}=stats,b=v.basePower;
    const mul=(a,b)=>integer(a*b,'属性乘积');
    let power=b-Math.trunc(mul(b,e)/100);
    if(v.efficiencyRatio)power=Math.trunc(Math.fround(b-Math.fround(Math.trunc(mul(b,e)/v.efficiencyRatio)/100)));
    if(v.performanceReducesPower&&v.performanceRatio)power-=Math.trunc(Math.fround(Math.trunc(mul(b,p)/v.performanceRatio)/100));
    if(machine.identifier==='deal_maker')power=b-Math.trunc(mul(b,integer(e+p,'性能与效率合计'))/100);
    power=Math.max(1,power);
    if(v.processUsesSystemPower&&!v.processLowPower){power=b-Math.trunc(mul(b,e)/100);if(power<1)throw Error('当前原生机器耗能无效。');}
    if(v.processLowPower&&['printer','evaporator'].includes(machine.identifier))power=0;
    let output=0,tier=0,tierLabel='',label='',adjustedQuality=v.qualityRatio>0?Math.trunc(q/v.qualityRatio):0;
    switch(machine.identifier){
      case 'moisture_farm':tier=[-50,0,50,100,150].filter(t=>q>=t).length;tierLabel=['污水','锈水','幽水','基础水','优质水','纯水'][tier];output=Math.max(0,Math.trunc(mul(integer(p+100,'性能'),850000)/100))/1000;label='标称产量（ml）';break;
      case 'water_purifier':tier=v.purityThresholds.filter(t=>q>=t).length;output=v.purityCaps[tier];label='最高纯度（%）';break;
      case 'furnace':tier=Math.max(0,Math.trunc(Math.max(0,q)/100)-(blast?1:0));output=tier;label='纯度提升档数（最终成色取决于原料）';break;
      case 'wine_rack':tier=1+Math.trunc(Math.max(0,q)/125);output=tier;label='催陈天数';break;
      case 'mirage_projector':output=Math.max(0,integer(100+Math.trunc(p/v.projectorPerformanceRatio)+Math.trunc(q/v.projectorQualityRatio),'吸引力'));label='吸引力';break;
      case 'security_alarm':output=Math.max(0,integer(50+p,'阻止率'));label='阻止率原值（%）';break;
      case 'desequencer':case 'hydroponic':case 'plant_dna_manipulator':case 'printer':{
        const speed=v.baseProcessingSpeed;output=v.performanceRatio?Math.trunc(Math.fround(speed+Math.fround(Math.trunc(mul(speed,p)/v.performanceRatio)/100))):integer(speed+Math.trunc(mul(speed,p)/100),'处理速度');label='处理速度';break;
      }
      case 'deal_maker':output=Math.max(0,integer(10+adjustedQuality,'议价加成'));label='议价成功率加成（百分点）';break;
      case 'evaporator':output=Math.min(100,Math.max(0,q));label='馏出液回收率（%）';break;
      default:throw Error('暂不支持这类机器。');
    }
    return {...stats,power,output,label,tier,tierLabel,adjustedQuality,purityCap:machine.identifier==='water_purifier',sharedAir:machine.identifier==='moisture_farm'};
  }
  function fromStats(machine, stats, blast=false) {
    if(machine.formal)return formalStats(machine,stats,blast);
    const {performance:p,efficiency:e,quality:q}=stats, profile=profiles[machine.identifier];
    const mul=(a,b)=>integer(a*b,'属性乘积');
    const power=Math.max(1,machine.identifier==='wine_rack' ? Math.trunc(Math.fround(24-Math.fround(Math.trunc(mul(24,e)/2)/100)))+Math.trunc(Math.fround(Math.trunc(mul(24,p)/2)/-100)) : profile.power-Math.trunc(mul(profile.power,e)/100));
    let output=0,label='',tier=0,tierLabel='';
    switch(machine.identifier) {
      case 'moisture_farm': tier=[-50,0,50,100,150].filter(t=>q>=t).length; tierLabel=['污水','锈水','幽水','基础水','优质水','纯水'][tier]; output=Math.max(0,Math.trunc(mul(integer(p+100,'性能'),1000000)/100))/1000;label='产水量（ml）';break;
      case 'water_purifier':tier=[15,25,50,75,100,200].filter(t=>q>=t).length;output=[100,85,65,35,20,10,0][tier];label='剩余杂质下限（%）';break;
      case 'furnace':tier=Math.max(0,Math.trunc(Math.max(0,q)/100)-(blast?1:0));output=tier;label='纯度提升（档）';break;
      case 'wine_rack':tier=1+Math.trunc(Math.max(0,q)/125);output=tier;label='催陈天数';break;
      case 'mirage_projector':output=Math.max(0,integer(100+p+q,'吸引力'));label='吸引力';break;
      case 'security_alarm':output=Math.max(0,integer(50+p,'阻止率'));label='阻止率原值（%）';break;
      case 'desequencer':output=33+Math.trunc(mul(33,p)/100);label='处理速度';break;
      default:throw Error('暂不支持这类机器。');
    }
    return {...stats,power,output,label,tier,tierLabel};
  }
  function evaluate(machine, pieces, placements, cached) {
    const byKey=pieces instanceof Map?pieces:new Map(pieces.map(p=>[p.key,p]));
    const selected=[],seen=new Set();let occupied=BigInt(machine.blocked);
    for(const pl of placements) {
      const piece=byKey.get(pl.key);
      if(!piece||seen.has(pl.key)||!compatible(machine,piece)) throw Error('方案含重复、未知或不兼容模组。');
      seen.add(pl.key);const g=cached?.get(`${pl.key}:${pl.x}:${pl.y}:${pl.rotation}:${+pl.flipped}`)||geometry(piece,pl,machine);
      if(occupied&g.mask) throw Error('模组重叠或占用了锁闭格。'); occupied|=g.mask;
      selected.push({piece,pl,...g});
    }
    const total={performance:0,efficiency:0,quality:0},perPiece={};
    for(const a of selected) {
      let nodes=a.piece.mergedEffects&&a.piece.kind==='node'&&a.piece.shape.cells.some(c=>a.piece.shape.cells.some(d=>d.x===c.x+1&&d.y===c.y||d.x===c.x&&d.y===c.y+1))?1:0;const negative={performance:0,efficiency:0,quality:0},modules={...negative};
      for(const b of selected) if(a!==b&&(a.touch&b.mask)) {
        if(b.piece.kind==='node')nodes++;
        const base=a.piece.mergedEffects?(b.piece.enabledBase||b.piece.base):b.piece.base;
        for(const k of axes) {negative[k]=integer(negative[k]+Math.min(0,base[k]),'相邻属性');if(b.piece.kind==='module')modules[k]=integer(modules[k]+base[k],'相邻属性');}
      }
      const stats={...a.piece.base};
      for(const {effect,count} of a.piece.mergedEffects||a.piece.effects.map(effect=>({effect,count:1}))) for(const k of axes) {
        if(effect==='NODE_EFFECT_SUPPORT')stats[k]=Math.trunc(integer(modules[k]*count,'支援属性')/5);
        else {let extra=0;
          if(effect==='MODULE_EFFECT_RECEIVER')extra=Math.trunc(integer(a.piece.base[k]*nodes*10*count,'接收器属性')/100);
          if(effect==='MODULE_EFFECT_TOP_MOUNT'&&a.pl.y===0||effect==='MODULE_EFFECT_SIDE_MOUNT'&&a.pl.x===0)extra=Math.trunc(integer(a.piece.base[k]*20*count,'安装属性')/100);
          if(effect==='MODULE_EFFECT_NEGATIVE_FEEDBACK')extra=Math.trunc(integer(negative[k]*count,'负反馈属性')/4);
          stats[k]=integer(stats[k]+extra,'模组属性');
        }
      }
      const bonus=machine.formal && machine.parameters?.moduleSkillBonus;
      if(bonus>0 && a.piece.kind==='module' && a.piece.moduleSkillEligible!==false){
        const enabled=a.piece.enabledBase || a.piece.base;
        for(const k of axes)if(stats[k]>0 && enabled[k]>0)stats[k]=integer(stats[k]+bonus,'模组技能加成');
      }
      perPiece[a.piece.key]=stats;for(const k of axes)total[k]=integer(total[k]+stats[k],'总属性');
    }
    return {...fromStats(machine,total,selected.some(s=>s.piece.identifier==='furnace_module_blast')),perPiece};
  }
  function variantIdentity(tags) {
    const ignored=new Set(['BOUGHT_PRICE_TAG','IS_OWNED_TAG','ITEM_BEHIND_LOCK_TAG','STOLEN_TAG','STOLEN_VALUE_INT','TEMP_PERCENTAGE_EFFICIENCY_INT','TEMP_PERCENTAGE_PERFORMANCE_INT','TEMP_PERCENTAGE_QUALITY_INT']);
    return JSON.stringify(Object.keys(tags).filter(k=>!ignored.has(k)).sort().map(k=>{const t=tags[k];return [k,t.valueEnabled,t.valueInt,t.valueLong,t.valueFloat,t.valueDouble,t.valueBool,t.internalValueString];}));
  }
  function readSave(text,options={}) {
    const raw=parseSaveText(text), player=raw?.playerStore?.value;
    if(!player||typeof player.saveVersion!=='string')throw Error('请选择游戏槽位 save_数字.es3，不是存档索引或设置文件。');
    if(!['VERSION 049-Rev5-L','VERSION 100','VERSION 100-Rev5','VERSION 100-Rev6','VERSION 100-Rev13'].includes(player.saveVersion))throw Error(`不支持此存档版本：${plain(player.saveVersion)}。支持 VERSION 100、100-Rev5、100-Rev6、100-Rev13 及 Demo 049-Rev5-L。`);
    if(!['auto','formal','demo',undefined].includes(options.rules))throw Error('规则选择无效。');
    const formal=options.rules==='formal'||options.rules!=='demo'&&player.saveVersion.startsWith('VERSION 100');
    const roots={mainInvJSON:'主库存',backInvJSON:'柜台',hiddenInvJSON:'暗格',showcaseInvJSON:'展示柜'};
    const items=[],byId=new Set(),warnings=[];
    for(const [field,title] of Object.entries(roots)) {
      if(!player[field])continue;
      const list=parseSaveText(player[field]).saveItems;
      if(!Array.isArray(list)||list.length===0||list.length>50000)throw Error(`${title}的物品列表不完整。`);
      const parents=new Map(), local=[];
      for(let i=0;i<list.length;i++) {
        const x=list[i]; if(!x||typeof x.identifier!=='string'||!Array.isArray(x._keys)||!Array.isArray(x._values)||x._keys.length!==x._values.length||new Set(x._keys).size!==x._keys.length)throw Error('存档物品属性不完整或重复。');
        const tags=Object.fromEntries(x._keys.map((k,j)=>[k,x._values[j]]));
        const node={raw:x,tags,identifier:x.identifier,key:String(integer(x.uniqueId,'实例编号',1)),name:plain(x.name||x.identifier),root:field};
        node.note=tags.CUSTOM_NAME_TAG?.valueEnabled?plain(tags.CUSTOM_NAME_TAG.internalValueString).trim():'';
        node.displayName=node.note||node.name;
        if(byId.has(node.key))throw Error('发现重复物品实例，无法安全分配。');byId.add(node.key);
        if(!Array.isArray(x.childItems)||!Array.isArray(x.childItemInventoryNode)||x.childItems.length!==x.childItemInventoryNode.length)throw Error('存档容器关系不完整。');
        for(let j=0;j<x.childItems.length;j++) {
          const child=integer(x.childItems[j],'子物品索引',1,list.length-1);
          if(parents.has(child))throw Error('同一物品出现多个来源容器。');parents.set(child,{parent:i,node:integer(x.childItemInventoryNode[j],'容器编号',0,1000)});
        }
        local.push(node);
      }
      for(let i=0;i<local.length;i++) {
        const item=local[i],path=[];let at=i,seen=new Set(),reason='',machineKey=null,area=null;
        while(at!==0) {
          if(seen.has(at)||seen.size>100||!parents.has(at))throw Error('存档容器关系出现循环或缺少来源。');seen.add(at);
          const current=local[at],owner=parents.get(at),parent=local[owner.parent];
          if(current.tags.ITEM_BEHIND_LOCK_TAG?.valueEnabled || parent.tags.LOCKED_CONTAINER_TAG?.valueEnabled&&parent.tags.LOCK_STATUS?.valueBool!==false)reason='容器尚未解密';
          if(!current.tags.IS_OWNED_TAG?.valueEnabled)reason=reason||'尚未拥有';
          if(current!==item&&(Object.hasOwn(profiles,current.identifier)||current.raw.itemTypes?.includes('MACHINE')))machineKey=current.key;
          if(current!==item&&!area&&['machine_bay','machine_bay_ext'].includes(current.identifier))area={key:current.key,name:current.displayName,baseName:current.name};
          const sh=current.raw.itemModifiedShape;
          const pos=`(${integer(bp(sh,'minX'),'来源列',0,10000)+1}, ${integer(bp(sh,'minY'),'来源行',0,10000)+1})`;
          if(at===i)item.position=pos;
          else path.unshift(`${current.displayName} #${current.key} ${pos}`);
          at=owner.parent;
        }
        item.inMachineArea=!!area;item.source=[title,...path].join(' › ');item.machineKey=machineKey;item.reason=reason;item.area=area||{key:field,name:title+' · 未放入机器区'};
        item.parentNode=parents.get(i)?.node;item.parentKey=parents.has(i)?local[parents.get(i).parent].key:null;
        item.children=item.raw.childItems.map(k=>local[k]);
        items.push(item);
      }
    }
    const pieces=[],machines=[];
    const intTag=(item,k,fallback)=> {const t=item.tags[k];if(t===undefined&&fallback!==undefined)return fallback;return integer(t?.valueInt,`${item.name} 的 ${k}`);};
    for(const item of items) {
      const types=item.raw.itemTypes;if(!Array.isArray(types))throw Error('物品类型缺失。');
      if(!types.includes('MODULE')&&!types.includes('NODE'))continue;
      const kind=types.includes('NODE')?'node':'module',tags=item.tags;
      let effects=['MODULE_EFFECT1_TAG','MODULE_EFFECT2_TAG'].flatMap(k=>tags[k]?.valueEnabled&&tags[k].internalValueString?[tags[k].internalValueString]:[]),mergedEffects;
      if(options.moduleUpgrade&&tags.MODULE_UPGRADE_EFFECTS_JSON?.valueEnabled){
        const json=tags.MODULE_UPGRADE_EFFECTS_JSON.internalValueString;
        let values;try{values=JSON.parse(json);}catch{}
        if(values&&typeof values==='object'&&!Array.isArray(values))mergedEffects=Object.entries(values).filter(([effect,count])=>effect.trim()&&Number.isInteger(count)&&count>0).map(([effect,count])=>({effect,count:integer(count,'词条层数',1)}));
        if(!mergedEffects?.length){const counts=new Map();for(const effect of effects)counts.set(effect,(counts.get(effect)||0)+1);mergedEffects=[...counts].map(([effect,count])=>({effect,count}));}
        effects=mergedEffects.map(s=>s.effect);
      }
      const allowed=kind==='node'||tags.MODULE_TYPE_UNIVERSAL?.valueEnabled?Object.keys(profiles):Object.entries({MODULE_TYPE_FURNACE:['furnace'],MODULE_TYPE_ALARM:['security_alarm','desequencer'],MODULE_TYPE_HYDROPONIC:['hydroponic'],MODULE_TYPE_DNA_MANIPULATOR:['plant_dna_manipulator'],MODULE_TYPE_PRINTER:['printer'],MODULE_TYPE_EVAPORATOR:['evaporator']}).filter(([k])=>tags[k]?.valueEnabled).flatMap(([,ids])=>ids);
      const base=Object.fromEntries(axes.map(k=>[k,intTag(item,`BONUS_PERCENTAGE_${k.toUpperCase()}_INT`,kind==='node'?0:undefined)]));
      const shape=shapeOf(item.raw.itemShape);
      if(shape.width>7||shape.height>7||!shape.cells.length)throw Error('模组形状不在支持范围内。');
      let reason=item.reason;
      if(tags.MODULE_UPGRADE_EFFECTS_JSON?.valueEnabled&&!options.moduleUpgrade)reason=reason||'含合并词条；请确认 ModuleUpgrade 2.1.0 已启用后重新导入';
      if(mergedEffects&&effects.includes('MODULE_EFFECT_NEGATIVE_FEEDBACK')&&!effects.includes('NODE_EFFECT_SUPPORT')&&axes.some(k=>base[k]!==0&&!tags[`TEMP_PERCENTAGE_${k.toUpperCase()}_INT`]?.valueEnabled))reason=reason||'合并负反馈临时属性未稳定，请在游戏中重算并保存';
      if(item.machineKey&&(item.parentKey!==item.machineKey||item.parentNode!==3))reason=reason||'物品不在已核对的模组舱内，不能借用';
      if(item.raw.unitCount!==1)reason=reason||'不支持堆叠模组';
      if(tags.MODULE_STUCK_TAG?.valueEnabled)reason=reason||'模组不可拆卸';
      if(effects.some(e=>!Object.hasOwn(effectNames,e)))reason=reason||'暂不支持的特性';
      if(!allowed.length)reason=reason||'机器兼容类型未知';
      const sh=item.raw.itemModifiedShape;
      pieces.push({key:item.key,identifier:item.identifier,name:item.name,note:item.note,displayName:item.displayName,sprite:`${item.raw.spriteAtlasPath?.split('/').pop()}/${item.raw.spritePath}`,kind,base,shape,effects,mergedEffects,enabledBase:Object.fromEntries(axes.map(k=>[k,tags[`BONUS_PERCENTAGE_${k.toUpperCase()}_INT`]?.valueEnabled?base[k]:0])),canLearn:effects.includes('MODULE_EFFECT_LEARNING_ALGORITHM'),allowed,source:item.source,position:item.position,machineKey:item.machineKey,inMachineArea:item.inMachineArea,variantIdentity:variantIdentity(tags),reason,
        moduleSkillEligible:!!tags.MODULE_TAG?.valueEnabled&&!tags.MODULE_STUCK_TAG?.valueEnabled,
        description:plain(item.raw.shortDescription),placement:{key:item.key,x:bp(sh,'minX'),y:bp(sh,'minY'),rotation:integer(bp(sh,'orientation'),'方向',0,3),flipped:!!bp(sh,'flipped')}});
    }
    const pieceMap=new Map(pieces.map(p=>[p.key,p]));
    for(const item of items) {
      if(!Object.hasOwn(profiles,item.identifier))continue;
      const stage=intTag(item,'MODULE_UPGRADE_STAGE_INT',0);
      if(stage<0||stage>2)throw Error('机器升级等级不受支持。');
      const fixed=item.identifier==='evaporator';
      const cells=fixed||stage===2?[]:stage===1?[0,6,28,34]:[0,6,10,16,17,18,24,28,34];
      const machine={key:item.key,name:item.name,note:item.note,displayName:item.displayName,area:item.area,sprite:`${item.raw.spriteAtlasPath?.split('/').pop()}/${item.raw.spritePath}`,identifier:item.identifier,source:item.source,position:item.position,stage,formal,width:fixed?4:7,height:fixed?4:5,blocked:cells.reduce((m,c)=>m|(1n<<BigInt(c)),0n).toString(),installed:[],error:item.reason};
      machine.requiredModules=[];
      if(formal&&item.identifier==='printer')try{
        const chip=item.children.find(c=>c.parentNode===5);
        if(chip){
          machine.inputName=chip.displayName;
          const count=chip.tags.PROGRESS_ITEM_REQUIRED_MACHINE_TAG_COUNT?.valueEnabled?intTag(chip,'PROGRESS_ITEM_REQUIRED_MACHINE_TAG_COUNT'):0;
          integer(count,'芯片功能要求数量',0,64);
          for(let i=0;i<count;i++){
            const tag=chip.tags[`PROGRESS_ITEM_REQUIRED_MACHINE_TAG_${i}`]?.internalValueString;
            const identifier={'Metal Printing Module':'printer_module_metal','CNC Module':'printer_module_cnc'}[tag];
            if(!identifier)throw Error('暂不支持的打印芯片功能要求：'+plain(tag));
            if(!machine.requiredModules.some(r=>r.identifier===identifier))machine.requiredModules.push({identifier,count:1,exact:false});
          }
          machine.taskWork=intTag(chip,'PROGRESS_ITEM_TARGET_TAG',0);
        }
      }catch(e){machine.error=machine.error||e.message;}
      if(formal&&item.tags.MACHINE_STATE_TAG?.internalValueString==='STATE_WORKING')machine.error='机器正在工作；完成任务并重新保存后再装配';
      if(fixed&&stage!==0)machine.error='蒸发器固定舱位与升级标记不一致';
      for(const child of item.children)if(child.parentNode===3) {
        const piece=pieceMap.get(child.key);if(!piece){machine.error='模组舱内含暂不支持的物品';continue;}
        machine.installed.push(piece.placement);if(piece.reason)machine.error=piece.reason;
      }
      const saved={performance:intTag(item,'TOTAL_PERCENTAGE_PERFORMANCE_BONUS_INT',0),efficiency:intTag(item,'TOTAL_PERCENTAGE_POWER_BONUS_INT',0),quality:intTag(item,'TOTAL_PERCENTAGE_QUALITY_BONUS_INT',0)};
      try {
        if(formal)machine.parameters=readParameters(item.identifier,item.tags);
        machine.saved=fromStats(machine,saved,machine.installed.some(pl=>pieceMap.get(pl.key).identifier==='furnace_module_blast'));
        machine.current=evaluate(machine,pieceMap,machine.installed);
        if(axes.some(k=>machine.current[k]!==saved[k]))machine.error=machine.error||'存档属性与重算不一致，暂不可生成方案';
      }catch(e){machine.error=machine.error||e.message;machine.saved??={...saved,power:0,output:0,label:'无法核对',tier:0,tierLabel:''};}
      machines.push(machine);
    }
    if(!machines.length)warnings.push('此存档的主库存、柜台、暗格和展示柜中，没有找到支持的机器。');
    const validMachines=new Set(machines.map(m=>m.key));
    for(const piece of pieces)if(piece.machineKey&&!validMachines.has(piece.machineKey))piece.reason=piece.reason||'所在机器暂不支持';
    const attraction=storeAttraction(player);
    // Save bags are serialization wrappers, not physical backpacks. Only list known general storage.
    const storage=items.filter(item=>!item.reason&&!(item.tags.LOCKED_CONTAINER_TAG?.valueEnabled&&item.tags.LOCK_STATUS?.valueBool!==false)&&(
      !item.parentKey&&['mainInvJSON','backInvJSON'].includes(item.root)||
      item.tags.CONTAINER_TAG?.valueEnabled&&/^(storage_bay(_large)?|smuggler_bay(_mod)?|backpack_(small|medium|large))$/.test(item.identifier)
    )).map(item=>({key:item.key,label:item.parentKey?`${item.displayName} #${item.key} ${item.position}`:roots[item.root],source:item.source,identifier:item.identifier}));
    return {version:player.saveVersion,formal,rulesBuild:formal?26525552:null,coreVersion:'2.5.1',moduleUpgrade:!!options.moduleUpgrade,scope:`${player.saveSlotId}:${player.runID}`,day:raw.storeStation?.value?.dayCounter,machines,pieces,warnings,attraction,storage};
  }
  function storeAttraction(player) {
    const base=player.baseStoreAttractiveness,bonus=player.projectorAttractivenessBonus,garbage=player.garbageLevel;
    if(![base,bonus,garbage].every(Number.isSafeInteger)||typeof player.isHardMode!=='boolean')return null;
    const penalty=Math.trunc(base*(garbage>2?garbage*5/100:0)),effective=base-penalty;
    return {base,bonus,garbage,penalty,effective,current:effective+bonus,hardMode:player.isHardMode};
  }
  function targetPresets(snapshot,id,primary) {
    if(snapshot.formal&&id==='evaporator'&&primary==='quality')return [[100,'回收率 100% · 质量 100%']];
    if(id==='moisture_farm'&&primary==='quality')return [[50,'基础水 · 50%'],[100,'优质水 · 100%'],[150,'纯水 · 150%']];
    if(id==='water_purifier'&&primary==='outcome'&&snapshot.formal)return purityCaps.map(v=>[v,`最高纯度 ${v}%`]);
    if(primary!=='outcome')return [];
    if(id==='desequencer')return [75,100,125].map(v=>[v,`处理速度 ${v}`]);
    if(id==='security_alarm')return [[100,'阻止率 100%']];
    if(id!=='mirage_projector'||!snapshot.attraction)return [];
    const a=snapshot.attraction,rewards=[[100,'橱窗客源'],[200,'普通客流',true],[250,'普通客流',true],[300,'客户预算'],[400,'客源等级'],[450,'客户预算'],[500,'普通客流',true],[600,'客户预算'],[650,'客源等级'],[750,'客户预算'],[900,'客户预算上限']];
    const remaining=rewards.filter(([v,,ordinary])=>v>a.effective&&!(a.hardMode&&ordinary));
    return remaining.length?remaining.map(([v,label])=>[v-a.effective,`店铺 ${v} · ${label}`]):[[0,'店铺基础吸引力已覆盖全部档位']];
  }
  const secondaryFor=g=>g.secondary||(g.primary==='outcome'?'power':g.primary==='performance'?'quality':'performance');
  const metric=(machine,e,axis)=>axis==='power'?-e.power:axis==='outcome'?(machine.identifier==='water_purifier'&&!machine.formal?-e.output:e.output):e[axis];
  function validateGoal(machine,g) {
    if(!['quality','performance','power','outcome'].includes(g.primary)||!['quality','performance','power'].includes(secondaryFor(g))||g.primary===secondaryFor(g))throw Error('第一、第二目标无效或重复。');
    for(const key of ['preferred','minQuality','minPerformance','maxPower'])if(g[key]!=null&&(!(key==='preferred'&&machine.formal&&machine.identifier==='water_purifier'?Number.isFinite(g[key]):Number.isInteger(g[key]))||g[key]<(key==='maxPower'?0:-10000)||g[key]>100000))throw Error('装配目标或限制无效。');
    if(g.primary==='outcome'&&g.preferred!=null&&(g.preferred<0||machine.identifier==='security_alarm'&&g.preferred>100))throw Error('产出目标不能为负，警报系统的目标上限为 100%。');
    if(g.requirements!=null&&!Array.isArray(g.requirements))throw Error('必选模组设置无效。');
    const seen=new Set();for(const r of g.requirements||[]){if(!r||typeof r.identifier!=='string'||seen.has(r.identifier)||!Number.isInteger(r.count)||r.count<0||r.count>128||typeof r.exact!=='boolean')throw Error('必选模组数量或种类无效。');seen.add(r.identifier);}
  }
  function requirementDeficit(pieces,placements,g) {
    if(!g.requirements?.length)return 0;
    const counts=new Map();for(const pl of placements){const id=pieces.get(pl.key)?.identifier;counts.set(id,(counts.get(id)||0)+1);}
    return (g.requirements||[]).reduce((sum,r)=>sum+(r.exact?Math.abs(r.count-(counts.get(r.identifier)||0)):Math.max(0,r.count-(counts.get(r.identifier)||0))),0);
  }
  const statDeficit=(e,g)=>Math.max(0,(g.minQuality??-10000)-e.quality)+Math.max(0,(g.minPerformance??-10000)-e.performance)+Math.max(0,e.power-(g.maxPower??2147483647));
  function availablePieces(snapshot,machine,locks=[],borrow=false) {
    const locked=new Set(locks);
    const unsupported=new Set(snapshot.machines.filter(m=>m.error).map(m=>m.key));
    return snapshot.pieces.filter(p=>!p.reason&&compatible(machine,p)&&!locked.has(p.machineKey)&&!unsupported.has(p.machineKey)&&(!p.machineKey||p.machineKey===machine.key||borrow));
  }
  const api = {parseSaveText,readSave,readParameters,purityCaps,profiles,effectNames,transform,geometry,evaluate,fromStats,availablePieces,storeAttraction,targetPresets,secondaryFor,metric,validateGoal,requirementDeficit,statDeficit};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Assembler = api;
})(typeof self === 'object' ? self : globalThis);
