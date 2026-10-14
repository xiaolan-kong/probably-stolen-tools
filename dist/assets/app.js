'use strict';
const $ = id => document.getElementById(id);
const number = id => $(id).value.trim() === '' ? NaN : Number($(id).value);
function selectedRange(id) {
  return $(id).dataset.reputation === 'range' && $(id).value !== '' ? $(id).selectedOptions[0].textContent.trim().replace(/\s+/g, ' ') : null;
}
const fmt = n => n.toLocaleString('zh-CN');
const serviceName = p => [p.fixer && '王尔德的善后人', p.evidence && '清除证据'].filter(Boolean).join(' + ') || '不使用服务';
const dayName = day => day === 1 ? '第 1 天（当天）' : `第 ${day} 天`;
const finishDay = p => (p.rows.filter(r => !r.eventOnly).at(-1)?.day ?? 0) + 1;
let input, plans = [], best = -1, generated = null;
function draft() {
  return {amounts: $('split').checked ? $('amounts').value : $('amount').value, split: $('split').checked,
    rep: $('rep').value, repRange: selectedRange('rep'), progress: $('progress').value, upper: $('upper').value, upperRange: selectedRange('upper'),
    fixer: $('fixer').checked, availability: $('availability').value,
    cooldown: $('availability').value === 'cooldown' ? $('cooldown').value : '', officer: $('officer').value};
}
function isStale() {return generated !== null && JSON.stringify(draft()) !== generated.key;}
function describeDraft(d) {
  return [d.split ? `各罪名金额：${d.amounts}` : `预估总计：${d.amounts}`,
    `调查进度：${d.progress}`, `治安部声望：${d.repRange || d.rep}`, `上层区声望：${d.upperRange || d.upper}`,
    `王尔德的善后人：${d.fixer ? '可用' : '不可用'}`,
    `清除证据：${{ready:'现在可用',cooldown:`冷却中，剩余 ${d.cooldown} 天`,unavailable:'不可使用 / 未解锁'}[d.availability]}`,
    `警官情况：${{auto:'未派来（调查满 100 按已派来处理）',queued:'已派来，尚未开始复核',dialogue:'已进入处罚对话'}[d.officer]}`,
    d.repRange ? '计算范围：声望区间内按较不利情况估算；不计新增或延迟入账' : '计算范围：当前报告，不计后续新增或延迟入账'].join('\n');
}
function markDraft() {
  syncFields();
  const stale = isStale();
  $('stale-notice').hidden = !stale;
  $('schedule-stale').hidden = !stale;
  $('input-state').textContent = stale ? '输入已修改，请重新生成。' : generated ? '' : '填写完成后，点击按钮生成方案。';
}
function read() {
  return {amounts: $('split').checked ? $('amounts').value.trim().split(/\s+/).map(Number) : [number('amount')], rep: number('rep'), progress: number('progress'), upper: number('upper'), cooldown: $('availability').value === 'cooldown' ? number('cooldown') : 0, officer: $('officer').value};
}
function note(p) {
  return ({none:'无法按此方案清零', limit:'搜索超限，暂不能判断', dialogue:'处罚对话已生成', reputation:'声望 ≤ −100'})[p.status] || `第 ${finishDay(p)} 天清零 · ${p.loss ? (generated?.draft.repRange ? '声望最多 −' : '声望 −') + p.loss : '声望不变'}`;
}
function timeline(p) {
  let amount = Crime.sum(input.amounts), progress = input.progress, rep = input.rep;
  const rows = [];
  const rowHtml = (day, actions, event, done, newRep = rep) => `<tr class="${done ? 'done-row' : event ? 'event-row' : ''}" data-day="${day}"><td class="day-cell">第 ${day} 天${day === 1 ? '<span class="today">（当天）</span>' : ''}</td><td class="money-cell" data-label="预估总计">${fmt(amount)}</td><td data-label="调查进度"><span class="progress-cell">${generated.draft.repRange && day > 1 ? '≤ ' : ''}${progress}<span class="progress-track"><i style="width:${progress}%"></i></span></span></td><td class="operation" data-label="当日操作">${actions.join('<br>')}</td><td data-label="治安部声望">${generated.draft.repRange ? (input.rep === newRep ? '不变' : `最多 −${fmt(input.rep-newRep)}`) : `${rep}${newRep !== rep ? ` → ${newRep}` : ''}`}</td></tr>`;
  for (const r of p.rows) {
    amount = r.startTotal ?? amount;
    const actions = [];
    if (r.added) actions.push(`<span class="loss">新增入账 +${fmt(r.added)}（已计入金额）</span>`);
    if (r.resetAt !== null) actions.push('<strong><img src="assets/EVIDENCE_REMOVAL.png" alt="">清除证据</strong>');
    if (r.loss) actions.push(`${generated.draft.repRange ? '如已派警，接待警官' : '接待警官'} <span class="loss">（声望 −${r.loss}）</span>`);
    if (!r.eventOnly) actions.push(p.fixer ? '<img src="assets/WILD_FIXER.png" alt="">王尔德的善后人' : '<span class="secondary">不使用服务</span>');
    rows.push(rowHtml(r.eventOnly ? r.day + 1 : r.day, actions, r.loss || r.resetAt !== null, false, r.rep));
    amount = r.total; progress = r.progress; rep = r.rep;
  }
  if (!p.rows.at(-1)?.eventOnly) rows.push(rowHtml(finishDay(p), ['已清零'], false, true));
  return rows.join('');
}
function selectPlan(index) {
  const p = plans[index], good = p?.status === 'clear';
  [...$('plans').children].forEach((b,j) => {b.classList.toggle('selected',j === index);b.setAttribute('aria-pressed',String(j === index));});
  $('recommendation').classList.toggle('warn', !good);
  $('schedule').hidden = !good; $('empty-schedule').hidden = good;
  $('result-scope').textContent = generated.draft.repRange ? (generated.draft.split ? '分罪名计算 · 声望区间保守估算' : '总计与声望区间保守估算') : generated.draft.split ? '按不同罪名分别核算' : '按总计保守核算';
  $('forecast-notice').hidden = false;
  if (!good) {
    $('result-tag').textContent = '暂不能推荐';
    $('result-title').textContent = input.officer === 'dialogue' ? '先处理当前处罚对话' : input.rep <= -100 ? '当前声望超出安全范围' : generated.draft.repRange ? '此区间未找到通用方案' : '当前条件下没有可执行方案';
    $('result-sub').textContent = plans.some(x => x.status === 'limit') ? '搜索达到限制，不能据此判定无解。' : '请核对可用服务、冷却时间，或按不同罪名分项填写。';
    $('metrics').replaceChildren(); $('timeline').replaceChildren();
    $('actions').textContent = input.officer === 'dialogue' ? '处罚对话已生成，不能假定再清除证据仍可撤销处罚。' : '没有方案不等于必死。罚款、恢复声望等其他处理方式不在计算范围内。';
    return;
  }
  $('result-tag').textContent = index === best ? '推荐方案' : '当前查看';
  $('result-title').textContent = Crime.sum(input.amounts) === 0 ? '当前金额已清零' : '当前金额可以清零';
  const services = [];
  if (p.fixer) services.push('<span class="service-chip"><img src="assets/WILD_FIXER.png" alt="">王尔德的善后人</span>');
  if (p.evidence) services.push('<span class="service-chip"><img src="assets/EVIDENCE_REMOVAL.png" alt="">清除证据</span>');
  $('result-sub').innerHTML = '<span class="service-caption">所需服务</span>' + (services.join('') || '<span class="service-chip">不需要服务</span>');
  const first = p.resets[0], when = first ? `第 ${first.resetAt + 1} 天` : '不需要';
  $('metrics').innerHTML = `<div class="metric"><small>预计清零</small><b>第 ${finishDay(p)} 天</b></div><div class="metric"><small>首次清除证据</small><b>${when}</b></div><div class="metric"><small>${generated.draft.repRange ? '治安部声望损失' : '最终声望 · 治安部'}</small><b>${generated.draft.repRange ? (p.loss ? '最多 ' + p.loss : '不变') : fmt(input.rep - p.loss)}${generated.draft.repRange ? '' : `<em>${p.loss ? '−' + p.loss : '不变'}</em>`}</b></div>`;
  const actions = [];
  if (p.fixer) actions.push('<strong>今天起</strong>，每天使用「王尔德的善后人」。');
  for (const r of p.resets) actions.push(`<strong>${dayName(r.resetAt + 1)}</strong>，${generated.draft.repRange ? `调查进度预计 ≤ ${r.before}，` : `调查进度 ${r.before} 时`}使用「清除证据」${r.before >= 100 || (r.resetAt === 0 && input.officer === 'queued') ? '，必须在警官复核前完成' : '，当天完成'}。`);
  if (p.loss) actions.push(`${generated.draft.repRange ? '预计接待警官，治安部声望最多降低' : '接待已派警官：治安部声望 −'}<strong>${p.loss}</strong>，已计入后续安排。`);
  if (!actions.length) actions.push('不使用服务，等待预估总计自然减少。');
  $('actions').innerHTML = actions.map(s => `<div>${s}</div>`).join('');
  $('timeline').innerHTML = timeline(p);
}
function syncFields() {
  $('cooldown-wrap').hidden = $('availability').value !== 'cooldown';
  $('available-day').textContent = Number.isInteger(number('cooldown')) ? `第 ${number('cooldown') + 1} 天可用` : '填写剩余天数';
  $('split-wrap').hidden = !$('split').checked; $('amount').disabled = $('split').checked;
  $('tier').textContent = Number.isFinite(number('rep')) ? Crime.tier(number('rep')) : '';
}
function run() {
  syncFields();
  try {
    const candidate = read();
    if ($('split').checked && !$('amounts').value.trim()) throw Error('请填写报告中每条罪名的金额。');
    if ($('availability').value === 'cooldown' && candidate.cooldown === 0) throw Error('剩余 0 天请改选「现在可用」。');
    Crime.validate(candidate);
    const nextPlans = Crime.planOptions(candidate,$('fixer').checked,$('availability').value !== 'unavailable');
    input = candidate; plans = nextPlans;
    const d = draft(); generated = {draft:d, key:JSON.stringify(d)};
    $('error').hidden = true; $('comparison').hidden = false; $('snapshot').hidden = false;
    $('snapshot-values').textContent = describeDraft(d);
    const eligible = plans.map((p,index) => ({...p,index})).filter(p => p.status === 'clear').sort((a,b) => a.loss-b.loss || Number(a.fixer)+Number(a.evidence)-Number(b.fixer)-Number(b.evidence) || a.resets.length-b.resets.length || a.days-b.days);
    best = eligible[0]?.index ?? -1;
    $('plan-count').textContent = `${eligible.length} 个可行方案`;
    $('plans').replaceChildren(...plans.map((p,j) => {
      const b = document.createElement('button');b.type='button';b.className='plan';b.disabled=p.status !== 'clear';
      b.dataset.fixer=String(p.fixer);b.dataset.evidence=String(p.evidence);
      b.innerHTML=`${serviceName(p)}${j === best ? '<span class="choice">推荐</span>' : ''}<small>${note(p)}</small>`;
      b.addEventListener('click',()=>selectPlan(j));return b;
    }));
    selectPlan(best);
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
$('split').addEventListener('change',()=>{if($('split').checked && !$('amounts').value.trim()) $('amounts').value=$('amount').value;markDraft();});
document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{
  $('amount').value=13276;$('rep').value=60;$('progress').value=0;$('upper').value=$('upper').dataset.reputation === 'range' ? 0 : 27;
  $('fixer').checked=true;$('availability').value='ready';$('cooldown').value=1;$('officer').value='auto';$('split').checked=false;
  $('error').hidden=true;markDraft();$('input-state').textContent='示例已填入，请点击「生成清理方案」。';$('form').scrollIntoView({block:'start'});
}));
document.querySelectorAll('[data-future]').forEach(b=>b.addEventListener('click',()=>{$('future-title').textContent=b.dataset.future;$('future-dialog').showModal();}));
document.querySelectorAll('#future-dialog .close,#future-dialog .close-dialog').forEach(b=>b.addEventListener('click',()=>$('future-dialog').close()));
$('caps-link').addEventListener('click',()=>$('amount-caps').open=true);
document.querySelectorAll('a[href="#plan-guide"]').forEach(a=>a.addEventListener('click',()=>$('plan-guide').open=true));
document.querySelector('.game-version').addEventListener('click',()=>$('research').open=true);
markDraft();

// Keep scrolling from silently changing focused numeric inputs.
document.querySelectorAll('input[type=number]').forEach(el=>el.addEventListener('wheel',e=>{if(document.activeElement===el)e.preventDefault();},{passive:false}));
