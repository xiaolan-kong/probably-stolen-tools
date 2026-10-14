/* Rules: Demo 049-Rev5-L; see README for evidence and exclusions. */
(function (root) {
  'use strict';
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const even = x => x % 1 === .5 ? Math.floor(x) + Math.floor(x) % 2 : Math.round(x);
  const clean = a => Math.max(0, a - Math.trunc(Math.fround(Math.fround(a) * Math.fround(.15))) - 50);
  function rate(a, r, u) {
    let n = a < 100 ? 0 : a < 300 ? 2 : a < 850 ? 6 : a < 1200 ? 9 : a < 1500 ? 12 : a < 2500 ? 20 : 33;
    if (r >= 60) n = Math.floor(n / 2);
    if (r <= -60) n = even(n * 1.5);
    else if (r <= -20) n = even(n * Math.fround(1.2));
    return u <= -60 ? even(n * 1.5) : n;
  }
  const tier = r => r >= 60 ? '值得信赖' : r <= -60 ? '头号通缉' : r <= -20 ? '重点盯防' : '';
  const success = p => p.status === 'clear' || p.status === 'fine';
  const crimes = {
    FENCING: '销赃（赃物）', CONTRABAND_TRAFFICKING: '一般违禁品走私',
    WEAPON_TRAFFICKING: '武器走私', DRUG_TRAFFICKING: '毒品走私', CARD_TRAFFICKING: '门禁卡走私',
    FRAUD: '欺诈（错标水等）', ENDANGERMENT: '危害消费者安全（幽灵水等）',
    BRIBERY: '贿赂', OPERATING_WITHOUT_LICENSE: '无证经营', MANSLAUGHTER: '过失杀人', OTHER: '其他（合并保守计算）'
  };
  function mergeCrimes(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 22) throw Error('请选择罪行并填写金额。');
    const merged = new Map();
    for (const {type, amount} of rows) {
      if (!Object.hasOwn(crimes, type)) throw Error('每一行都需要选择罪行。');
      if (!Number.isInteger(amount) || amount < 0 || amount > 10000000) throw Error('每项犯罪金额请填 0～10,000,000 的整数。');
      merged.set(type, (merged.get(type) || 0) + amount);
      if (merged.get(type) > 10000000) throw Error('同一罪名合计不能超过 10,000,000。');
    }
    return [...merged].map(([type, amount]) => ({type, amount}));
  }
  function inspection(rows, rep) {
    const recorded = mergeCrimes(rows);
    const trafficking = sum(recorded.filter(x => x.type.endsWith('_TRAFFICKING')).map(x => x.amount));
    const total = trafficking + (recorded.find(x => x.type === 'FENCING')?.amount || 0);
    let [min, max] = total < 150 ? [3,5] : total < 300 ? [3,4] : total < 450 ? [3,3] : total < 600 ? [2,3] : total < 750 ? [2,2] : [1,2];
    if (rep >= 60) {min += 2; max += 4;}
    if (rep <= -80) {min--; max--;}
    return {total, min: Math.max(1,min), max: Math.max(2,max), active: total >= 50 && rep < 100,
      vip: rep >= 100, additional: total >= 1000, sting: trafficking > 1000,
      reliable: (recorded.find(x => x.type === 'BRIBERY')?.amount || 0) >= 500,
      unknown: recorded.some(x => x.type === 'OTHER' && x.amount > 0)};
  }
  const punishment = amount => amount < 100 ? '报告不显示刑罚' : amount < 300 ? '罚款' : amount < 1500 ? '监禁（结束本局）' : '处决（结束本局）';
  function validate(i) {
    if (!Array.isArray(i.amounts) || !i.amounts.length || i.amounts.length > 11 || i.amounts.some(a => !Number.isInteger(a) || a < 0 || a > 10000000)) throw Error('金额请填 0～10,000,000 的整数；最多 11 条不同罪名。');
    if (!Number.isInteger(i.progress) || i.progress < 0 || i.progress > 100) throw Error('调查进度请填 0～100 的整数。');
    if (![i.rep, i.upper].every(Number.isFinite)) throw Error('请填写两项声望，可填小数。');
    if (i.cash !== undefined && (!Number.isInteger(i.cash) || i.cash < 0 || i.cash > 10000000)) throw Error('罚款备用金请填 0～10,000,000 的整数。');
    if (!Number.isInteger(i.cooldown) || i.cooldown < 0 || i.cooldown > 14) throw Error('冷却请填 0～14 天。');
    if (!['auto', 'queued', 'dialogue'].includes(i.officer)) throw Error('请选择警官当前情况。');
    if (i.additions !== undefined && (!Array.isArray(i.additions) || i.additions.length > 30 || i.additions.some(x => !Number.isInteger(x.day) || x.day < 2 || x.day > 365 || !Number.isInteger(x.amount) || x.amount < 1 || x.amount > 10000000))) throw Error('新增计划最多 30 笔；日期填第 2～365 天，新增金额填 1～10,000,000 的整数。');
  }
  function solve(i, fixer, evidence) {
    validate(i);
    if (i.officer === 'dialogue') return {status: 'dialogue', rows: []};
    if (i.rep <= -100) return {status: 'reputation', rows: []};
    const penalty = i.upper <= -60 ? 40 : 20, fineLoss = penalty / 2, initialCash = i.cash ?? 0;
    const additions = i.additions || [], lastAddition = Math.max(0, ...additions.map(x => x.day - 1));
    let nodes = 0, fineBlocked = null;
    // shortcut: bounded offline planning, no new crimes or reputation repair; expand when these become inputs.
    for (let budget = 0; budget < i.rep + 100; budget += initialCash ? fineLoss : penalty) {
      const failed = new Set();
      function visit(amounts, p, r, c, day, spent, pending, cash) {
        if (++nodes > 120000 || day > 365) throw Error('limit');
        // 开门入账发生在换日调查增长之后，不能提前享受上一晚善后。
        const added = sum(additions.filter(x => x.day === day + 1).map(x => x.amount));
        if (added) amounts = [sum(amounts) + added];
        const total = sum(amounts);
        // A fine replaces the evidence-gone penalty; never charge both for one case.
        if (pending && p >= 95 && total > 0 && total < 300) {
          if (cash < total || r - fineLoss <= -100) {
            const blocked = {day: day + 1, amount: total, cash, loss: fineLoss, reputation: r - fineLoss <= -100};
            if (!fineBlocked || total < fineBlocked.amount) fineBlocked = blocked;
          } else if (spent + fineLoss <= budget) {
            const nr = r - fineLoss, remaining = cash - total;
            const row = {day: day >= lastAddition ? day : day + 1, startTotal: total, added, total: 0, before: p, progress: 0, delta: 0, rep: nr, loss: fineLoss, fine: total, cash: remaining, resetAt: null, cooldown: c, skipFixer: true, eventOnly: day >= lastAddition};
            if (day >= lastAddition) return [row];
            const tail = visit([0], 0, nr, Math.max(0, c - 1), day + 1, spent + fineLoss, false, remaining);
            if (tail) return [row, ...tail];
          }
        }
        const loss = pending ? penalty : 0;
        if (spent + loss > budget || r - loss <= -100) return null;
        const nr = r - loss;
        const mustReset = pending && p >= 95 && total > 0;
        if (!total && day >= lastAddition) return loss ? [{day, total: 0, startTotal:total, added, progress: p, delta: 0, rep: nr, loss, resetAt: null, cooldown: c, eventOnly: true}] : [];
        const key = [amounts.join(','), p, r, c, spent, pending, cash, additions.length ? day : ''].join('|');
        if (failed.has(key)) return null;
        for (const reset of mustReset ? [true] : [false, true]) {
          if (reset && (!evidence || c > 0 || p === 0)) continue;
          const before = reset ? 0 : p;
          let next = fixer ? amounts.map(clean) : [...amounts];
          if (before < 80) next = next.map(a => Math.max(0, a - 20));
          const na = sum(next), delta = rate(na, nr, i.upper), np = Math.min(100, before + delta), nc = Math.max(0, (reset ? 14 : c) - 1);
          if (day >= lastAddition && na === total && np === p && nr === r && nc === c) continue;
          const tail = visit(next, np, nr, nc, day + 1, spent + loss, np >= 100 && na > 0, cash);
          if (tail) return [{day: day + 1, total: na, startTotal:total, added, progress: np, before: p, delta, rep: nr, loss, resetAt: reset ? day : null, cooldown: nc}, ...tail];
        }
        failed.add(key); return null;
      }
      try {
        const rows = visit(additions.length ? [sum(i.amounts)] : i.amounts, i.progress, i.rep, i.cooldown, 0, 0, i.progress >= 100 || i.officer === 'queued', initialCash);
        if (rows) {
          const fines = rows.filter(r => r.fine), fineTotal = sum(fines.map(r => r.fine));
          return {status: fines.length ? 'fine' : 'clear', rows, fines, fineTotal, cashLeft: initialCash - fineTotal, loss: rows.reduce((a, r) => a + r.loss, 0), resets: rows.filter(r => r.resetAt !== null), days: rows.at(-1)?.day ?? 0};
        }
      } catch (e) { if (e.message === 'limit') return {status: 'limit', rows: []}; throw e; }
      if (!evidence && !initialCash && i.progress < 100 && i.officer !== 'queued') break;
    }
    return {status: 'none', rows: [], fineBlocked};
  }
  function tomorrow(i, fixer, reset) {
    validate(i);
    if (i.officer === 'dialogue') return {blocked: '处罚对话已生成，不能按清除成功核算'};
    if (reset && i.cooldown) return {blocked: '清除证据尚在冷却'};
    const pending = i.progress >= 100 || i.officer === 'queued';
    if (pending && i.progress >= 95 && sum(i.amounts) && !reset) return {blocked: '需先处理已派警官'};
    const rep = i.rep - (pending ? (i.upper <= -60 ? 40 : 20) : 0);
    if (rep <= -100) return {blocked: '治安声望将降至 −100 或更低'};
    const source = i.additions?.length ? [sum(i.amounts)] : i.amounts;
    let amounts = fixer ? source.map(clean) : [...source];
    const before = reset ? 0 : i.progress;
    if (before < 80) amounts = amounts.map(a => Math.max(0, a - 20));
    const total = sum(amounts), delta = rate(total, rep, i.upper);
    const added = sum((i.additions || []).filter(x => x.day === 2).map(x => x.amount));
    return {total:total + added, delta, progress: Math.min(100, before + delta), rep};
  }
  function planOptions(i, allowFixer, allowEvidence) {
    const options = [];
    for (const [fixer, evidence] of [[false,false],[true,false],[false,true],[true,true]]) {
      if ((fixer && !allowFixer) || (evidence && !allowEvidence)) continue;
      const result = solve(i, fixer, evidence);
      const usedFixer = success(result) ? fixer && result.rows.some(r => !r.eventOnly && !r.skipFixer) : fixer;
      const usedEvidence = success(result) ? result.resets.length > 0 : evidence;
      const option = {...result, fixer: usedFixer, evidence: usedEvidence};
      // A service being allowed does not mean the returned plan uses it.
      if (success(result) && options.some(p => success(p) && p.fixer === usedFixer && p.evidence === usedEvidence && p.status === result.status && p.fineTotal === result.fineTotal && p.loss === result.loss)) continue;
      options.push(option);
    }
    return options;
  }
  function maxAmount(i, fixer, evidence) {
    // Single recorded crime, no new crimes; the displayed fine must be affordable.
    const candidate = {...i, cash: 299, additions: []};
    let low = 0, high = 10000000;
    while (low < high) {
      const amount = Math.ceil((low + high) / 2);
      const p = solve({...candidate, amounts: [amount]}, fixer, evidence);
      if (p.status === 'limit') return {status: 'limit'};
      if (success(p)) low = amount;
      else high = amount - 1;
    }
    const p = solve({...candidate, amounts: [low]}, fixer, evidence);
    return {status: p.status, amount: low, fineTotal: p.fineTotal, loss: p.loss, atLeast: low === 10000000};
  }
  function maxAdditional(i, rows, type, allowFixer, allowEvidence) {
    const recorded = mergeCrimes([...rows, {type, amount: 0}]);
    const index = recorded.findIndex(x => x.type === type);
    const amounts = recorded.map(x => x.amount);
    const evaluate = extra => {
      const next = [...amounts]; next[index] += extra;
      const options = planOptions({...i, amounts: next, cash: 299, additions: []}, allowFixer, allowEvidence);
      return options.filter(success).sort((a,b) => a.loss-b.loss || a.fineTotal-b.fineTotal || a.days-b.days)[0]
        || {status: options.some(p => p.status === 'limit') ? 'limit' : options[0]?.status || 'none'};
    };
    // shortcut: only an amount booked today; delayed tracker conversion needs its own dated model.
    let low = 0, high = 10000000 - amounts[index];
    const zero = evaluate(0);
    if (['dialogue', 'reputation', 'limit'].includes(zero.status)) return zero;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2), p = evaluate(mid);
      if (p.status === 'limit') return p;
      if (success(p)) low = mid; else high = mid - 1;
    }
    return {...evaluate(low), amount: low, atLeast: low === 10000000 - amounts[index]};
  }
  const api = {sum, clean, rate, tier, validate, solve, tomorrow, planOptions, success, maxAmount, crimes, mergeCrimes, inspection, punishment, maxAdditional};
  if (typeof module !== 'undefined') module.exports = api;
  else root.Crime = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
