'use strict';
const $ = id => document.getElementById(id);
const number = id => $(id).value.trim() === '' ? NaN : Number($(id).value);
function selectedRange(id) {
  return $(id).dataset.reputation === 'range' && $(id).value !== '' ? $(id).selectedOptions[0].textContent.trim().replace(/\s+/g, ' ') : null;
}
const fmt = n => n.toLocaleString('zh-CN');
const serviceName = p => [p.fixer && '王尔德的善后人', p.evidence && '清除证据'].filter(Boolean).join(' + ') || '不使用服务';
const dayName = day => day === 1 ? '第 1 天（当天）' : `第 ${day} 天`;
const finishDay = p => p.days + 1;
let input, plans = [], best = -1, generated = null;
function captureFields() {
  return {fields:Object.fromEntries([...$('form').querySelectorAll('input[id],select[id]')].map(n=>[n.id,n.type==='checkbox'?n.checked:n.value])),crimes:crimeRows('crime-rows'),sales:crimeRows('sale-rows')};
}
function restoreFields(saved) {
  for(const n of $('form').querySelectorAll('input[id],select[id]'))if(Object.hasOwn(saved.fields,n.id)){
    if(n.type==='checkbox')n.checked=saved.fields[n.id];else n.value=saved.fields[n.id];
  }
  for(const [id,rows] of [['crime-rows',saved.crimes],['sale-rows',saved.sales]]){$(id).replaceChildren();for(const row of rows)addCrimeRow(id,row.type,row.amount);}
  syncFields();
}
function crimeRows(id) {
  return [...$(id).children].map(row => ({type: row.querySelector('select').value, amount: row.querySelector('input').value}));
}
function addCrimeRow(id, type = '', amount = '') {
  if ($(id).children.length >= 11) return;
  const row = document.createElement('div'); row.className = 'crime-row';
  row.innerHTML = `<select aria-label="${id === 'crime-rows' ? '当前' : '新增'}罪行"><option value="">选择罪行</option>${Object.entries(Crime.crimes).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select><input type="number" min="0" max="10000000" step="1" aria-label="${id === 'crime-rows' ? '当前' : '新增'}犯罪金额" placeholder="金额 ¢"><button type="button" aria-label="删除此项罪行">×</button>`;
  row.querySelector('select').value = type; row.querySelector('input').value = amount;
  row.querySelector('button').addEventListener('click', () => {row.remove(); markDraft();});
  $(id).append(row);
}
const numericRows = rows => rows.map(x => ({type:x.type, amount:x.amount.trim() === '' ? NaN : Number(x.amount)}));
function draft() {
  return {amounts: $('amount').value, split: $('split').checked, crimes: $('split').checked ? crimeRows('crime-rows') : [],
    sales: $('sales').checked, proposed: $('sales').checked ? crimeRows('sale-rows') : [],
    rep: $('rep').value, progress: $('progress').value, upper: $('upper').value, upperRange: selectedRange('upper'),
    fixer: $('fixer').checked, availability: $('availability').value,
    cooldown: $('availability').value === 'cooldown' ? $('cooldown').value : '', officer: $('officer').value};
}
function isStale() {return generated !== null && JSON.stringify(draft()) !== generated.key;}
function describeDraft(d) {
  const describeRows = rows => rows.map(x => `${Crime.crimes[x.type] || '未选罪行'}：${x.amount || '未填金额'}`).join('；');
  return [d.split ? `各罪名金额：${describeRows(d.crimes)}\n当前合计：${d.amounts}` : `预估总计：${d.amounts}`,
    d.sales ? `当天预计新增：${describeRows(d.proposed)}；按今天已正式入账试算` : '未启用追加犯罪金额测算',
    `调查进度：${d.progress}`, `治安部声望：${d.rep}`, `上层区声望：${d.upperRange || d.upper}`,
    '罚款按能付清计算，需自行留足方案所示金额',
    `王尔德的善后人：${d.fixer ? '可用' : '不可用'}`,
    `清除证据：${{ready:'现在可用',cooldown:`冷却中，剩余 ${d.cooldown} 天`,unavailable:'不可使用 / 未解锁'}[d.availability]}`,
    `警官情况：${{auto:'未派来（调查满 100 按已派来处理）',queued:'已派来，尚未开始复核',dialogue:'已进入处罚对话'}[d.officer]}`,
    '计算范围：当前报告，不计后续新增或延迟入账'].join('\n');
}
function markDraft() {
  syncFields();
  const stale = isStale();
  $('stale-notice').hidden = !stale;
  $('schedule-stale').hidden = !stale;
  $('caps-stale').hidden = !stale;
  $('sales-stale').hidden = !stale;
  $('mechanics-stale').hidden = !stale;
  $('input-state').textContent = stale ? '输入已修改，请重新生成。' : generated ? '' : '填写完成后，点击按钮生成方案。';
}
function read() {
  const rep = number('rep');
  let records = $('split').checked ? Crime.mergeCrimes(numericRows(crimeRows('crime-rows'))) : null;
  if ($('sales').checked) records = Crime.mergeCrimes([...records, ...Crime.mergeCrimes(numericRows(crimeRows('sale-rows')))]);
  return {records, amounts: records ? records.map(x => x.amount) : [number('amount')], rep, cash: 299, progress: number('progress'), upper: number('upper'), cooldown: $('availability').value === 'cooldown' ? number('cooldown') : 0, officer: $('officer').value};
}
function note(p) {
  return ({none:'未找到可继续经营的安排', limit:'搜索超限，暂不能判断', dialogue:'处罚对话已生成', reputation:'声望 ≤ −100'})[p.status] || `第 ${finishDay(p)} 天${p.fineTotal ? `结案 · 罚款 ${fmt(p.fineTotal)} ¢` : '清零'} · ${p.loss ? '声望 −' + p.loss : '声望不变'}`;
}
function timeline(p) {
  let amount = Crime.sum(input.amounts), progress = input.progress, rep = input.rep;
  const rows = [];
  const rowHtml = (day, actions, event, done, newRep = rep) => `<tr class="${done ? 'done-row' : event ? 'event-row' : ''}" data-day="${day}"><td class="day-cell">第 ${day} 天${day === 1 ? '<span class="today">（当天）</span>' : ''}</td><td class="money-cell" data-label="预估总计">${fmt(amount)}</td><td data-label="调查进度"><span class="progress-cell">${progress}<span class="progress-track"><i style="width:${progress}%"></i></span></span></td><td class="operation" data-label="当日操作">${actions.join('<br>')}</td><td data-label="治安部声望">${rep}${newRep !== rep ? ` → ${newRep}` : ''}</td></tr>`;
  for (const r of p.rows) {
    amount = r.startTotal ?? amount;
    const actions = [];
    if (r.added) actions.push(`<span class="loss">新增入账 +${fmt(r.added)}（已计入金额）</span>`);
    if (r.resetAt !== null) actions.push('<strong><img src="assets/EVIDENCE_REMOVAL.png" alt="">清除证据</strong>');
    if (r.fine) actions.push(`<strong>缴纳罚款 ${fmt(r.fine)} ¢</strong><br><span class="secondary">结案后金额与调查归零</span><span class="loss">声望 −${r.loss}</span>`);
    else if (r.loss) actions.push(`接待警官 <span class="loss">（声望 −${r.loss}）</span>`);
    if (!r.eventOnly && !r.skipFixer) actions.push(p.fixer ? '<img src="assets/WILD_FIXER.png" alt="">王尔德的善后人' : '<span class="secondary">不使用服务</span>');
    rows.push(rowHtml(r.eventOnly ? r.day + 1 : r.day, actions, r.loss || r.resetAt !== null, !!r.fine && r.eventOnly, r.rep));
    amount = r.total; progress = r.progress; rep = r.rep;
  }
  if (!p.rows.at(-1)?.eventOnly) rows.push(rowHtml(finishDay(p), ['已清零'], false, true));
  return rows.join('');
}
function selectPlan(index) {
  const p = plans[index], good = p && Crime.success(p);
  [...$('plans').children].forEach((b,j) => {b.classList.toggle('selected',j === index);b.setAttribute('aria-pressed',String(j === index));});
  $('recommendation').classList.toggle('warn', !good);
  $('schedule').hidden = !good; $('empty-schedule').hidden = good;
  $('recovery-options').hidden = good;
  $('result-scope').textContent = generated.draft.sales ? '当前＋本次预计新增 · 按今天入账试算' : generated.draft.split ? '按不同罪名分别核算' : '按总计保守核算';
  $('forecast-notice').hidden = false;
  if (!good) {
    $('result-tag').textContent = '暂不能推荐';
    $('result-title').textContent = input.officer === 'dialogue' ? '先处理当前处罚对话' : input.rep <= -100 ? '当前声望超出安全范围' : '当前条件下没有可执行方案';
    const blocked = plans.map(x => x.fineBlocked).filter(Boolean).sort((a,b) => a.amount-b.amount)[0];
    $('result-sub').textContent = plans.some(x => x.status === 'limit') ? '搜索达到限制，不能据此判定无解。' : blocked ? (blocked.reputation ? `罚款会扣 ${blocked.loss} 点声望，将降至 −100 或更低。` : `请留足 ${fmt(blocked.amount)} ¢ 罚款。`) : '请核对可用服务、冷却时间，或按不同罪名分项填写。';
    $('metrics').replaceChildren(); $('timeline').replaceChildren();
    $('actions').textContent = input.officer === 'dialogue' ? '处罚对话已生成，不能按当前金额重新判刑；若已经是罚款对话，请核对实际账单。' : '已考虑罚款与扣声望。没有方案仍不等于必死；恢复声望等其他救济未纳入。';
    return;
  }
  $('result-tag').textContent = index === best ? '推荐方案' : '当前查看';
  $('result-title').textContent = p.fineTotal ? '可以继续经营，需缴纳罚款' : Crime.sum(input.amounts) === 0 ? '当前金额已清零' : '当前金额可以清零';
  const services = [];
  if (p.fixer) services.push('<span class="service-chip"><img src="assets/WILD_FIXER.png" alt="">王尔德的善后人</span>');
  if (p.evidence) services.push('<span class="service-chip"><img src="assets/EVIDENCE_REMOVAL.png" alt="">清除证据</span>');
  $('result-sub').innerHTML = '<span class="service-caption">所需服务</span>' + (services.join('') || '<span class="service-chip">不需要服务</span>');
  const first = p.resets[0], when = first ? `第 ${first.resetAt + 1} 天` : '不需要';
  $('metrics').innerHTML = `<div class="metric"><small>${p.fineTotal ? '预计结案' : '预计清零'}</small><b>第 ${finishDay(p)} 天</b></div><div class="metric"><small>${p.fineTotal ? '罚款合计' : '首次清除证据'}</small><b>${p.fineTotal ? fmt(p.fineTotal) + ' ¢' : when}</b></div><div class="metric"><small>最终声望 · 治安部</small><b>${fmt(input.rep - p.loss)}<em>${p.loss ? '−' + p.loss : '不变'}</em></b></div>`;
  const actions = [];
  if (p.fixer) actions.push('<strong>按下方逐日安排</strong>使用「王尔德的善后人」，结案后停止。');
  for (const r of p.resets) actions.push(`<strong>${dayName(r.resetAt + 1)}</strong>，调查进度 ${r.before} 时使用「清除证据」${r.before >= 100 || (r.resetAt === 0 && input.officer === 'queued') ? '，必须在警官复核前完成' : '，当天完成'}。`);
  for (const r of p.fines) actions.push(`<strong>${dayName(r.eventOnly ? r.day + 1 : r.day)}</strong>，接待警官并缴纳 <strong>${fmt(r.fine)} ¢</strong> 罚款（声望 −${r.loss}），清掉本案。`);
  if (p.fineTotal) actions.push(`请留足 <strong>${fmt(p.fineTotal)} ¢</strong> 罚款；付不起仍可能被拘捕，服务费用另计。`);
  if (p.loss) actions.push(`累计声望降低 <strong>${p.loss}</strong>，已计入后续调查与 −100 边界。`);
  if (!actions.length) actions.push('不使用服务，等待预估总计自然减少。');
  $('actions').innerHTML = actions.map(s => `<div>${s}</div>`).join('');
  $('timeline').innerHTML = timeline(p);
}
function renderMechanics() {
  const amount = Crime.sum(input.amounts), check = input.records ? Crime.inspection(input.records,input.rep) : null;
  $('mechanics-result').hidden = false;
  $('punishment-result').textContent = `本次合计 ${fmt(amount)} ¢：${Crime.punishment(amount)}。这是当前金额对应的报告档位，实际由警官开场复核决定。`;
  $('inspection-result').textContent = !check ? '只填总额无法判断常规检查频率和检查员类型；请按罪名填写。' : check.unknown ? '包含未分类的“其他”金额，不能完整判断检查条件；请尽量选明确罪名。' : `走私＋销赃 ${fmt(check.total)} ¢。${check.vip ? '治安声望 ≥100，默认 VIP 跳过这条常规检查分支。' : !check.active ? '未达到常规检查的 50 门槛。' : `新检查冷却 ${check.min}～${check.max} 天；不是确定到访日期。`}${check.reliable ? '贿赂 ≥500：只派可靠检查员。' : '贿赂 <500：未触发只派可靠检查员。'}${check.additional ? '已达到额外检查提示门槛。' : ''}${check.sting ? '已达到诱捕提示门槛，卧底到访概率未确认。' : ''}`;
}
function renderSales() {
  $('sales-result').hidden = !generated.draft.sales;
  $('sales-values').replaceChildren();
  if (!generated.draft.sales) return;
  const proposed = Crime.mergeCrimes(numericRows(generated.draft.proposed));
  $('sales-summary').textContent = `当前 ${fmt(Number(generated.draft.amounts))} ＋ 本次预计新增 ${fmt(Crime.sum(proposed.map(x => x.amount)))} ＝ ${fmt(Crime.sum(input.amounts))} ¢。上方方案已包含这些新增。`;
  for (const {type} of proposed) {
    const cap = Crime.maxAdditional(input,input.records,type,generated.draft.fixer,generated.draft.availability !== 'unavailable');
    const row = document.createElement('div'); row.className = 'sales-cap';
    const label = document.createElement('strong'); label.textContent = Crime.crimes[type]; row.append(label);
    const detail = document.createElement('p');
    detail.textContent = Crime.success(cap) ? `还能追加 ${cap.atLeast ? '至少 ' : ''}${fmt(cap.amount)} ¢ · ${cap.fineTotal ? `须留罚款 ${fmt(cap.fineTotal)} ¢` : '无需罚款'} · 声望降低 ${cap.loss}` : note(cap);
    row.append(detail);
    if (Crime.success(cap) && cap.amount > 0) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = '填入此额度，查看方案';
      button.addEventListener('click', () => {
        if (isStale()) { $('input-state').textContent = '输入已修改，请先重新生成额度。'; return; }
        const next = proposed.map(x => ({...x, amount:x.amount + (x.type === type ? cap.amount : 0)}));
        $('sale-rows').replaceChildren(); next.forEach(x => addCrimeRow('sale-rows',x.type,x.amount));
        run(); document.querySelector('.result-panel').scrollIntoView({block:'start'});
      });
      row.append(button);
    }
    $('sales-values').append(row);
  }
}
function renderCaps() {
  $('amount-caps').hidden = false;
  $('caps-context').textContent = `治安部声望 ${input.rep} · 上层区${generated.draft.upperRange} · 调查进度 ${input.progress}。沿用本次警官情况及清除证据冷却。`;
  const cells = [[false,false],[true,false],[true,true]].map(([fixer,evidence]) => {
    if ((fixer && !generated.draft.fixer) || (evidence && generated.draft.availability === 'unavailable')) return '<td>服务不可用</td>';
    const cap = Crime.maxAmount(input,fixer,evidence);
    if (!Crime.success(cap)) return `<td>${cap.status === 'limit' ? '暂不能判断' : cap.status === 'dialogue' ? '先处理处罚对话' : '无可行方案'}</td>`;
    return `<td><strong>${cap.atLeast ? '≥ ' : ''}${fmt(cap.amount)}</strong><small>${cap.fineTotal ? `需罚款 ${fmt(cap.fineTotal)} ¢` : '无需罚款'}${cap.loss ? ` · 声望 −${cap.loss}` : ''}</small></td>`;
  });
  $('caps-values').innerHTML = '<tr>' + cells.join('') + '</tr>';
}
function syncFields() {
  $('cooldown-wrap').hidden = $('availability').value !== 'cooldown';
  $('available-day').textContent = Number.isInteger(number('cooldown')) ? `第 ${number('cooldown') + 1} 天可用` : '填写剩余天数';
  $('split-wrap').hidden = !$('split').checked; $('amount').disabled = $('split').checked;
  $('sale-wrap').hidden = !$('sales').checked;
  $('split').disabled = $('sales').checked;
  if ($('split').checked) {
    const amounts = numericRows(crimeRows('crime-rows')).map(x => x.amount);
    if (amounts.length) $('amount').value = amounts.every(x => Number.isInteger(x) && x >= 0) ? Crime.sum(amounts) : '';
  }
  const rep = number('rep');
  $('tier').textContent = Number.isFinite(rep) ? Crime.tier(rep) : '';
}
function run() {
  syncFields();
  try {
    const candidate = read();
    if ($('availability').value === 'cooldown' && candidate.cooldown === 0) throw Error('剩余 0 天请改选「现在可用」。');
    Crime.validate(candidate);
    const nextPlans = Crime.planOptions(candidate,$('fixer').checked,$('availability').value !== 'unavailable');
    input = candidate; plans = nextPlans;
    const d = draft(); generated = {draft:d, key:JSON.stringify(d), fields:captureFields()};
    $('error').hidden = true; $('comparison').hidden = false; $('snapshot').hidden = false;
    $('snapshot-values').textContent = describeDraft(d);
    const eligible = plans.map((p,index) => ({...p,index})).filter(Crime.success).sort((a,b) => a.loss-b.loss || a.fineTotal-b.fineTotal || Number(a.fixer)+Number(a.evidence)-Number(b.fixer)-Number(b.evidence) || a.resets.length-b.resets.length || a.days-b.days);
    best = eligible[0]?.index ?? -1;
    $('plan-count').textContent = `${eligible.length} 个可行方案`;
    $('plans').replaceChildren(...plans.map((p,j) => {
      const b = document.createElement('button');b.type='button';b.className='plan';b.disabled=!Crime.success(p);
      b.dataset.fixer=String(p.fixer);b.dataset.evidence=String(p.evidence);
      b.innerHTML=`${serviceName(p)}${j === best ? '<span class="choice">推荐</span>' : ''}<small>${note(p)}</small>`;
      b.addEventListener('click',()=>selectPlan(j));return b;
    }));
    selectPlan(best);
    renderCaps();
    renderMechanics();
    renderSales();
    markDraft();
  } catch (e) {
    $('error').textContent=e.message;$('error').hidden=false;
    // 无效草稿不能覆盖已生成方案或其计算依据。
    if (!generated) {$('result-tag').textContent='输入待修正';$('result-title').textContent='请先修正输入';$('result-sub').textContent=e.message;}
    markDraft();
  }
}
$('form').addEventListener('submit',e=>{
  e.preventDefault();run();
  if (!$('error').hidden) $('error').scrollIntoView({block:'center'});
  else document.querySelector('.result-panel').scrollIntoView({block:'start'});
});
$('form').addEventListener('input',()=>{$('error').hidden=true;markDraft();});
$('form').addEventListener('change',markDraft);
$('split').addEventListener('change',()=>{if($('split').checked && !$('crime-rows').children.length) addCrimeRow('crime-rows','',$('amount').value);markDraft();});
$('sales').addEventListener('change',()=>{
  if ($('sales').checked) {
    if (!$('split').checked && !$('crime-rows').children.length) addCrimeRow('crime-rows','',$('amount').value);
    $('split').checked = true;
    if (!$('sale-rows').children.length) addCrimeRow('sale-rows','FENCING',0);
  }
  markDraft();
});
document.querySelectorAll('[data-add-crime]').forEach(b => b.addEventListener('click', () => {addCrimeRow(b.dataset.addCrime); markDraft();}));
document.querySelector('.game-version').addEventListener('click',()=>$('research').open=true);
markDraft();

ToolSession.bind('crime',()=>({fields:captureFields(),generated:generated?.fields,selected:[...$('plans').children].findIndex(n=>n.classList.contains('selected'))}));
const savedSession=ToolSession.read('crime');
if(savedSession){
  try{
    if(savedSession.generated){restoreFields(savedSession.generated);run();if(savedSession.selected>=0&&Crime.success(plans[savedSession.selected]))selectPlan(savedSession.selected);}
    restoreFields(savedSession.fields);markDraft();
  }catch{$('error').textContent='上次输入未能完整恢复，请核对当前数字后重新生成方案。';$('error').hidden=false;}
}

// Keep scrolling from silently changing focused numeric inputs.
document.addEventListener('wheel',e=>{if(e.target.matches('input[type=number]') && document.activeElement===e.target)e.preventDefault();},{passive:false});
