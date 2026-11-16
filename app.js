// Naše doma – obrazovky a chování. Data a sdílení řeší sync.js (window.Store), texty preklady.js, otázky otazky.js.
(function () {
  const S = window.Store, DAY = 86400000;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- Jazyk a vzhled ---
  function lang() { return S.cfg.lang || ((navigator.language || 'cs').toLowerCase().startsWith('ru') ? 'ru' : 'cs'); }
  function t(key, vars) {
    let s = (window.PREKLADY[lang()] || {})[key]; if (s === undefined) s = window.PREKLADY.cs[key]; if (s === undefined) s = key;
    if (typeof s === 'string' && vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyTheme() { const th = S.cfg.theme || 'auto'; if (th === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', th); document.documentElement.lang = lang(); }

  // --- Lidé ---
  const other = p => p === 'a' ? 'b' : 'a';
  function name(p) { const r = S.state.people[p]; return (r && r.name) ? r.name : t(p === 'a' ? 'personA' : 'personB'); }
  const me = () => S.cfg.me;

  // --- Čas ---
  const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today0 = () => startOfDay(Date.now());
  function weekStart() { const d = new Date(today0()); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; }
  const dateKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function ago(ts) {
    const diff = Date.now() - ts, m = Math.round(diff / 60000), h = Math.round(diff / 3600000), d = Math.round((today0() - startOfDay(ts)) / DAY);
    if (m < 1) return t('justNow'); if (m < 60) return t('minAgo', { n: m }); if (d === 0) return t('hoursAgo', { n: h }); if (d === 1) return t('yesterday'); return t('daysAgo', { n: d });
  }
  function plural(n) { if (n === 1) return t('items1'); if (lang() === 'ru' ? (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) : (n >= 2 && n <= 4)) return t('items234', { n }); return t('items5', { n }); }

  // --- Nákup: kategorie podle klíčových slov (cs + ru), stačí začátek slova ---
  const CATS = ['fruit', 'bakery', 'dairy', 'meat', 'pantry', 'frozen', 'drinks', 'household', 'other'];
  const CAT_ICON = { fruit: '🥦', bakery: '🥖', dairy: '🧀', meat: '🍖', pantry: '🥫', frozen: '🧊', drinks: '🧃', household: '🧴', other: '🛒' };
  const KW = {
    fruit: 'jabl hrušk banán banan pomeranč mandarin citron citrón limet hrozn jahod malin borůvk melou avokád rajč okurk paprik cibul česnek brambor mrkev salát špenát brokol květák cuket lilek zelí kapust petržel pórek hous houb žampion ovoce zelenin bylink kopr bazalk máta kiwi ananas mango broskv švest třešn višn hrách fazol ředkv celer dýně bату яблок груш банан апельсин мандарин лимон лайм виноград клубник малин черник арбуз авокад томат помидор огурц перец лук чеснок картоф картош морков салат шпинат брокколи капуст кабач баклажан петрушк укроп гриб шампиньон овощ фрукт зелень базилик мят киви ананас манго персик слив черешн вишн горох фасол редис сельдерей тыкв',
    bakery: 'chléb chleb rohlík rohlik houск housk bageta toust tortill croissant kobliha koláč buchta vánočk pečivo mouka bulk хлеб булк багет тост тортиль круассан пончик пирог выпечк мука батон лаваш',
    dairy: 'mlék mleko jogurt máslo maslo sýr syr eidam gouda hermelín tvaroh smetan šlehačk kefír zakys vejce vajíčk vajick mozzarel parmazán niva ricott lučin žervé pomazánk молок йогурт масло сыр творог сливк кефир яйц яиц моцарел пармезан рикотт сметан ряженк',
    meat: 'kuře kuřec maso vepřov hověz mleté šunk salám klobás párk slanin ryb losos tuňák treska krůt kach steak karbanát sekaná курин куриц мясо свинин говядин фарш ветчин колбас сосис бекон рыб лосос тунец треск индейк утк стейк котлет',
    pantry: 'rýže ryze těstovin spaget špaget nudl mouk cukr sůl sul olej ocet kečup hořčic majonéz čočk fazol konzerv tuňák ořech mandl müsli musli cereál ovesn vločk med džem marmelád čokolád sušenk keks oplatk chips brambůrk kávа káva kava čaj kakao koření pepř paprika mletá polévk bujón sójov sojov piškot kuskus bulgur quinoa рис макарон спагетт лапш сахар соль масло уксус кетчуп горчиц майонез чечевиц фасоль консерв орех миндал мюсли хлопья овсян мёд мед джем варень шоколад печень вафл чипс кофе чай какао специи перец суп бульон соус кускус булгур',
    frozen: 'mražen zmrzlin nanuk hranolk pizza мороз заморож мороженое картофель фри пицц',
    drinks: 'voda vod minerálk džus dzus limonád kola cola pivo víno vino sekt prosecco energet mattoni kofola šťáva sirup ledový вода минерал сок лимонад кола пиво вино шампанск энергетик сироп напит',
    household: 'toaletní papír ubrousk kapesník mýdlo mydlo šampon sprchov zubní pasta kartáček prášek prac aviváž jar sáčk pytle houbičk utěrk čistič savo domestos deodorant krém holicí vložk tampon odličov prací tablety myčk alobal potravinov fólie svíčk baterie žárovk туалет бумаг салфет мыло шампун гель зубн паст щётк щетк порошок стирал кондиционер пакет мешк губк тряпк чистящ дезодорант крем бритв прокладк тампон таблетки посудомо фольг свеч батарей лампочк',
  };
  const KWS = {}; Object.keys(KW).forEach(c => KWS[c] = KW[c].split(/\s+/).filter(Boolean));
  const norm = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
  function guessCat(nm) {
    const n = norm(nm); const words = n.split(' ');
    for (const c of CATS) { if (!KWS[c]) continue; for (const k of KWS[c]) { if (words.some(w => w.startsWith(k)) || n.startsWith(k)) return c; } }
    return 'other';
  }

  // --- Úkoly ---
  const PERIOD = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, once: 0 };
  function daysUntil(ch) { if (!ch.last) return 0; if (ch.freq === 'once') return 0; return Math.round((startOfDay(ch.last) + PERIOD[ch.freq] * DAY - today0()) / DAY); }
  function turn(ch) { if (ch.who === 'a' || ch.who === 'b') return ch.who; if (ch.who === 'any') return ''; return ch.lastBy ? other(ch.lastBy) : 'a'; }
  function dueLabel(d) { if (d === 0) return [t('today'), 'due']; if (d === 1) return [t('tomorrow'), '']; if (d > 1) return [t('inDays', { n: d }), '']; if (d === -1) return [t('overdue1'), 'late']; return [t('overdue', { n: -d }), 'late']; }
  function weekPoints() { const ws = weekStart(), p = { a: 0, b: 0 }; S.get('log').forEach(l => { if (l.at >= ws && (l.by === 'a' || l.by === 'b')) p[l.by] += l.pts || 0; }); return p; }
  function totalPoints() { const p = { a: 0, b: 0 }; S.get('log').forEach(l => { if (l.by === 'a' || l.by === 'b') p[l.by] += l.pts || 0; }); return p; }
  function doneChore(ch) {
    const prev = { last: ch.last || null, lastBy: ch.lastBy || null };
    const logId = S.uid();
    S.set('log', logId, { chore: ch.id, name: ch.n, by: me(), at: Date.now(), pts: ch.pts || 1 });
    if (ch.freq === 'once') S.del('chores', ch.id); else S.set('chores', ch.id, Object.assign({}, stripId(ch), { last: Date.now(), lastBy: me() }));
    toast(t('doneToast', { name: name(me()), n: ch.pts || 1 }), t('undo'), () => {
      S.del('log', logId);
      const cur = S.state.chores[ch.id] || stripId(ch);
      S.set('chores', ch.id, Object.assign({}, cur, { del: false, last: prev.last, lastBy: prev.lastBy }));
    });
  }
  const stripId = o => { const c = Object.assign({}, o); delete c.id; return c; };

  // --- Otázka dne ---
  function questionIndex(ts) { const d0 = new Date(2026, 0, 1).getTime(); return ((Math.floor((startOfDay(ts) - d0) / DAY) % window.OTAZKY.length) + window.OTAZKY.length) % window.OTAZKY.length; }
  function question(ts) { const q = window.OTAZKY[questionIndex(ts)]; return lang() === 'ru' ? q[1] : q[0]; }

  // --- Toast a spodní panel ---
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const el = $('#toast'); el.innerHTML = esc(msg) + (actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''); el.hidden = false;
    if (actionLabel) el.querySelector('button').onclick = () => { el.hidden = true; action && action(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 2500);
  }
  let sheetRefresh = null; // panel, který se má překreslit, když dorazí změna (např. od partnera)
  function sheet(html, bind, refresh) { const el = $('#sheet'); el.innerHTML = `<div class="panel fade" role="dialog" aria-modal="true">${html}</div>`; el.hidden = false; el.onclick = e => { if (e.target === el) closeSheet(); }; sheetRefresh = refresh || null; bind && bind(el.querySelector('.panel')); }
  function closeSheet() { const el = $('#sheet'); el.hidden = true; el.innerHTML = ''; sheetRefresh = null; }

  // --- Navigace ---
  let tab = 'today';
  function go(tb) { tab = tb; render(); window.scrollTo(0, 0); }

  function render() {
    applyTheme();
    document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const shopN = S.get('shop').filter(i => !i.done).length; const sb = $('#shopBadge'); sb.textContent = shopN; sb.classList.toggle('show', shopN > 0);
    const dueN = S.get('chores').filter(c => daysUntil(c) <= 0).length; const cb = $('#choreBadge'); cb.textContent = dueN; cb.classList.toggle('show', dueN > 0);
    $('#topRight').innerHTML = S.enabled() ? `<span class="dot ${S.status}"></span>${esc(t('shareState_' + S.status))}` : (navigator.onLine === false ? esc(t('offline')) : '');
    const v = $('#view');
    if (!me()) { $('#topTitle').textContent = t('appName'); v.innerHTML = welcomeHTML(); bindWelcome(v); $('#tabs').style.display = 'none'; return; }
    $('#tabs').style.display = '';
    $('#topTitle').textContent = tab === 'today' ? (name(me()) !== t(me() === 'a' ? 'personA' : 'personB') ? t('hello', { name: name(me()) }) : t('helloNoName')) : t({ shop: 'tabShop', chores: 'choresTitle', more: 'tabMore' }[tab]);
    // Rozepsaný text v políčku přežije překreslení (např. když zrovna dorazí změna od partnera).
    const act = document.activeElement, keep = act && act.id && v.contains(act) && 'value' in act ? { id: act.id, value: act.value } : null;
    v.innerHTML = `<div class="fade">${({ today: todayHTML, shop: shopHTML, chores: choresHTML, more: moreHTML })[tab]()}</div>`;
    ({ today: bindToday, shop: bindShop, chores: bindChores, more: bindMore })[tab](v);
    if (keep) { const el = v.querySelector('#' + keep.id); if (el) { el.value = keep.value; el.focus(); } }
    if (sheetRefresh && !$('#sheet').hidden) sheetRefresh();
  }

  // --- Uvítání ---
  function welcomeHTML() {
    return `<div class="welcome"><div class="logo">🏡</div><h1>${esc(t('welcomeTitle'))}</h1><p class="muted">${esc(t('welcomeText'))}</p></div>
      <div class="card">${peopleHTML()}<button class="btn block" id="welcomeGo" style="margin-top:14px" disabled>${esc(t('welcomeGo'))}</button></div>
      <div class="row" style="justify-content:center;margin-top:6px">${segHTML('lang', [['cs', 'Česky'], ['ru', 'Русский']], lang())}</div>`;
  }
  let pendingMe = '';
  function bindWelcome(v) {
    bindPeople(v, p => { pendingMe = p; v.querySelector('#welcomeGo').disabled = false; });
    v.querySelector('#welcomeGo').onclick = () => { if (pendingMe) { S.cfg.me = pendingMe; S.persist(); render(); } };
    bindSeg(v, 'lang', val => { S.cfg.lang = val; S.persist(); render(); });
  }
  function peopleHTML() {
    const cur = me() || pendingMe;
    return `<h2>${esc(t('meTitle'))}</h2><div class="muted">${esc(t('meHint'))}</div>` + ['a', 'b'].map(p => `
      <div class="person ${cur === p ? 'me' : ''}" data-p="${p}"><span class="who ${p}">${p === 'a' ? '1' : '2'}</span>
        <input data-name="${p}" placeholder="${esc(t(p === 'a' ? 'nameA' : 'nameB'))}" value="${esc((S.state.people[p] || {}).name || '')}" maxlength="24">
        <button type="button" class="btn small ${cur === p ? '' : 'secondary'}" data-me="${p}">${cur === p ? '✓ ' : ''}${esc(t('iAm'))}</button></div>`).join('');
  }
  function bindPeople(v, onMe) {
    v.querySelectorAll('[data-name]').forEach(inp => inp.onchange = () => { const nm = inp.value.trim(); S.set('people', inp.dataset.name, { name: nm }); });
    v.querySelectorAll('[data-me]').forEach(b => b.onclick = () => { v.querySelectorAll('[data-name]').forEach(i => i.onchange()); onMe(b.dataset.me); });
  }
  function segHTML(id, opts, cur) { return `<div class="seg" data-seg="${id}">${opts.map(([val, lbl]) => `<button type="button" data-val="${esc(val)}" class="${val === cur ? 'on' : ''}">${esc(lbl)}</button>`).join('')}</div>`; }
  function bindSeg(v, id, fn) { v.querySelectorAll(`[data-seg="${id}"] button`).forEach(b => b.onclick = () => fn(b.dataset.val)); }

  // --- Dnes ---
  function fairHTML(p, title) {
    const sum = p.a + p.b, wa = sum ? Math.round(p.a / sum * 100) : 50;
    let msg = t('fairNone'); if (sum) { const diff = Math.abs(p.a - p.b); msg = diff === 0 ? t('fairEven') : t('fairLead', { name: name(p.a > p.b ? 'a' : 'b'), n: diff }); }
    return `<div class="fair"><div class="row between"><b>${esc(title)}</b><span class="muted">${esc(msg)}</span></div>
      <div class="bar" style="margin-top:6px"><span class="pa" style="width:${sum ? wa : 0}%"></span><span class="pb" style="width:${sum ? 100 - wa : 0}%"></span></div>
      <div class="names"><b class="a">${esc(name('a'))} · ${p.a} ${esc(t('pts'))}</b><b class="b">${p.b} ${esc(t('pts'))} · ${esc(name('b'))}</b></div></div>`;
  }
  function questionHTML(full) {
    const key = dateKey(Date.now()), ans = S.state.answers[key] || {}, mine = ans[me()], theirs = ans[other(me())];
    let body;
    if (!mine) body = `<textarea class="input" id="qText" rows="2" placeholder="${esc(t('qPlaceholder'))}"></textarea>
        <div class="row between" style="margin-top:8px"><span class="muted">${theirs ? esc(t('qWaitingYou')) : ''}</span><button class="btn small" id="qSend">${esc(t('qSend'))}</button></div>`;
    else body = `<div class="answer ${me()}"><div class="by">${esc(name(me()))} (${esc(t('me'))}) <button type="button" class="btn ghost small" id="qEdit" style="float:right;padding:0 6px">${esc(t('qEdit'))}</button></div>${esc(mine.text)}</div>` +
      (theirs ? `<div class="answer ${other(me())}"><div class="by">${esc(name(other(me())))}</div>${esc(theirs.text)}</div>` : `<div class="answer locked">${esc(t('qWaiting', { name: name(other(me())) }))}</div>`);
    return `<div class="card q"><h2>${esc(t('qTitle'))}<small>${esc(t('weekdays')[new Date().getDay()])}</small></h2><div class="question">${esc(question(Date.now()))}</div>${body}
      ${!mine ? `<div class="muted" style="margin-top:8px;font-size:13px">${esc(t('qHint'))}</div>` : ''}</div>` + (full ? historyHTML() : '');
  }
  function historyHTML() {
    const todayK = dateKey(Date.now());
    const keys = Object.keys(S.state.answers).filter(k => k !== todayK && (S.state.answers[k].a || S.state.answers[k].b)).sort().reverse().slice(0, 30);
    if (!keys.length) return '';
    return `<details class="card"><summary><b>${esc(t('qHistory'))}</b> <span class="muted">(${keys.length})</span></summary>${keys.map(k => { const [y, m, d] = k.split('-').map(Number), ts = new Date(y, m - 1, d).getTime(), a = S.state.answers[k];
      return `<div class="hist"><div class="d">${d}. ${m}. ${y}</div><div class="qq">${esc(question(ts))}</div>${['a', 'b'].map(p => a[p] ? `<div class="an"><b class="${p}">${esc(name(p))}</b><span>${esc(a[p].text)}</span></div>` : '').join('')}</div>`; }).join('')}</details>`;
  }
  function todayHTML() {
    const due = S.get('chores').filter(c => daysUntil(c) <= 0).sort((x, y) => daysUntil(x) - daysUntil(y));
    const shopN = S.get('shop').filter(i => !i.done).length;
    return questionHTML(true) +
      `<div class="card"><h2>${esc(t('todayChores'))}</h2>${due.length ? `<ul class="list">${due.map(choreRow).join('')}</ul>` : `<div class="muted">${esc(t('todayNoChores'))}</div>`}${fairHTML(weekPoints(), t('fairTitle'))}</div>
       <div class="card row between"><div><b>${esc(shopN ? t('shopSummary', { n: plural(shopN) }) : t('shopSummary0'))}</b></div><button class="btn small secondary" data-go="shop">${esc(t('openList'))}</button></div>
       <div class="card dec"><h2>🎲 ${esc(t('decTitle'))}</h2><div class="muted">${esc(t('decIntro'))}</div>
         <div class="row" style="margin-top:10px">${KINDS.map(k => `<button type="button" class="btn secondary grow dec-open" data-dec="${k}">${KIND_ICON[k]} ${esc(t('kind_' + k))}${todayPick(k) ? `<small>${esc(t('decToday', { n: todayPick(k).n }))}</small>` : ''}</button>`).join('')}</div></div>`;
  }
  function bindToday(v) { bindQuestion(v); bindChoreRows(v); v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); v.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => openDecider(b.dataset.dec)); }

  // --- Rozhodovač: oba přidávají nápady, náhoda vybere; co padlo naposledy, se hned nevrátí ---
  const KINDS = ['dinner', 'movie'], KIND_ICON = { dinner: '🍝', movie: '🎬' };
  let decKind = 'dinner', decResult = null, decSpinning = false;
  const ideas = k => S.get('ideas').filter(i => i.k === k).sort((x, y) => x.t - y.t);
  const recentIds = k => { const r = S.state.picks[k]; return (r && Array.isArray(r.ids)) ? r.ids : []; };
  function lastPick(k) { const id = recentIds(k)[0]; const i = id && S.state.ideas[id]; return i && !i.del ? i : null; }
  function todayPick(k) { const r = S.state.picks[k]; return r && r.at && startOfDay(r.at) === today0() ? lastPick(k) : null; }
  function pickIdea(k) {
    const all = ideas(k); if (!all.length) return null;
    const skip = recentIds(k).slice(0, Math.min(2, all.length - 1)); // poslední dva nevracet, pokud je z čeho vybírat
    const pool = all.filter(i => !skip.includes(i.id));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function addIdea(k, text) {
    text.split(',').map(s => s.trim()).filter(Boolean).forEach(nm => { if (!ideas(k).some(i => norm(i.n) === norm(nm))) S.set('ideas', S.uid(), { n: nm, k, by: me() }); });
  }
  function deciderHTML() {
    const k = decKind, all = ideas(k), have = new Set(all.map(i => norm(i.n))), last = lastPick(k);
    const sugg = (t('decSugg_' + k) || []).filter(s => !have.has(norm(s))).slice(0, 8);
    const res = decResult && !decResult.del ? decResult : null;
    return `<div class="row between"><h3 style="margin:0">🎲 ${esc(t('decTitle'))}</h3><button type="button" class="btn ghost small" id="decClose">${esc(t('close'))}</button></div>
      <div style="margin-top:10px">${segHTML('kind', KINDS.map(x => [x, KIND_ICON[x] + ' ' + t('kind_' + x)]), k)}</div>
      <div class="wheel ${res ? 'pop' : ''}" id="decResult" aria-live="polite">${res ? `<small>${esc(t('decResult'))}</small>${esc(res.n)}` : (all.length ? '?' : '…')}</div>
      <div class="muted center" style="min-height:20px">${all.length === 0 ? esc(t('decEmpty')) : all.length === 1 ? esc(t('decOne')) : (last && !res ? esc(t('decLast', { n: last.n })) : esc(t('decNoRepeat')))}</div>
      <button type="button" class="btn block" id="decSpin" style="margin-top:10px" ${all.length ? '' : 'disabled'}>${esc(res ? t('decAgain') : t('decSpin'))}</button>
      <label class="field" for="decInput">${esc(t('decIdeas'))} (${all.length})</label>
      <div class="chips" style="margin:0 0 10px">${all.map(i => `<span class="chip rm ${i.by || ''}">${esc(i.n)}<button type="button" class="x" data-decdel="${i.id}" aria-label="${esc(t('decDelete', { n: i.n }))}">✕</button></span>`).join('')}</div>
      <div class="row"><input class="input grow" id="decInput" placeholder="${esc(t('decAddPlaceholder'))}" autocomplete="off" enterkeyhint="done" maxlength="40"><button type="button" class="btn" id="decAdd" aria-label="${esc(t('add'))}">+</button></div>
      ${sugg.length ? `<div class="chips">${sugg.map(s => `<button type="button" class="chip" data-decsugg="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>` : ''}`;
  }
  function bindDecider(p) {
    p.querySelector('#decClose').onclick = closeSheet;
    bindSeg(p, 'kind', val => { if (decSpinning) return; decKind = val; decResult = null; refreshDecider(); });
    const inp = p.querySelector('#decInput'); const add = () => { if (inp.value.trim()) { addIdea(decKind, inp.value); inp.value = ''; inp.focus(); } };
    p.querySelector('#decAdd').onclick = add; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    p.querySelectorAll('[data-decsugg]').forEach(b => b.onclick = () => addIdea(decKind, b.dataset.decsugg));
    p.querySelectorAll('[data-decdel]').forEach(b => b.onclick = () => { if (decResult && decResult.id === b.dataset.decdel) decResult = null; S.del('ideas', b.dataset.decdel); });
    p.querySelector('#decSpin').onclick = () => spinDecider(p);
  }
  function refreshDecider() {
    if (decSpinning) return; // během točení nepřekreslovat
    const p = $('#sheet .panel'); if (!p) return;
    const inp = p.querySelector('#decInput'), keep = inp && document.activeElement === inp ? inp.value : null;
    p.innerHTML = deciderHTML(); bindDecider(p);
    if (keep !== null) { const i = p.querySelector('#decInput'); i.value = keep; i.focus(); }
  }
  function openDecider(k) { decKind = KINDS.includes(k) ? k : 'dinner'; decResult = null; decSpinning = false; sheet(deciderHTML(), bindDecider, refreshDecider); }
  function spinDecider(p) {
    const all = ideas(decKind), final = pickIdea(decKind); if (!final || decSpinning) return;
    const box = p.querySelector('#decResult'), btn = p.querySelector('#decSpin');
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = (reduced || all.length < 2) ? 0 : 12; let i = 0, delay = 55;
    decSpinning = true; decResult = null; box.classList.remove('pop'); box.classList.add('spin'); btn.disabled = true;
    const tick = () => {
      if (i >= steps) {
        decSpinning = false; decResult = final;
        S.set('picks', decKind, { ids: [final.id].concat(recentIds(decKind).filter(x => x !== final.id)).slice(0, 5), at: Date.now() }); // uloží se, překreslí a ukáže výsledek
        return;
      }
      box.textContent = all[(i + 1 + Math.floor(Math.random() * (all.length - 1))) % all.length].n; i++; delay = Math.round(delay * 1.18); setTimeout(tick, delay);
    };
    tick();
  }
  function bindQuestion(v) {
    const send = v.querySelector('#qSend'); if (send) send.onclick = () => { const txt = v.querySelector('#qText').value.trim(); if (!txt) return; S.set('answers', dateKey(Date.now()), { text: txt }, me()); };
    const ed = v.querySelector('#qEdit'); if (ed) ed.onclick = () => { const cur = (S.state.answers[dateKey(Date.now())] || {})[me()]; const txt = prompt(t('qPlaceholder'), cur ? cur.text : ''); if (txt != null && txt.trim()) S.set('answers', dateKey(Date.now()), { text: txt.trim() }, me()); };
  }

  // --- Nákup ---
  function shopHTML() {
    const items = S.get('shop'), open = items.filter(i => !i.done), done = items.filter(i => i.done);
    const onList = new Set(items.map(i => norm(i.n)));
    const favs = Object.values(S.state.fav || {}).filter(f => f && !f.del && !onList.has(norm(f.n))).sort((x, y) => (y.count || 0) - (x.count || 0)).slice(0, 8);
    const byCat = {}; open.forEach(i => (byCat[i.c || 'other'] = byCat[i.c || 'other'] || []).push(i));
    return `<div class="card"><div class="row"><input class="input grow" id="shopInput" placeholder="${esc(t('shopPlaceholder'))}" autocomplete="off" enterkeyhint="done"><button class="btn" id="shopAdd">+</button></div>
      ${favs.length ? `<div class="muted" style="margin-top:10px;font-size:13px">${esc(t('quick'))}</div><div class="chips">${favs.map(f => `<button type="button" class="chip" data-fav="${esc(f.n)}">${esc(f.n)}</button>`).join('')}</div>` : ''}</div>
      ${open.length ? `<div class="card">${CATS.filter(c => byCat[c]).map(c => `<div class="cat-title">${CAT_ICON[c]} ${esc(t('cat_' + c))}</div><ul class="list">${byCat[c].sort((x, y) => x.t - y.t).map(shopRow).join('')}</ul>`).join('')}</div>`
        : `<div class="empty"><span class="big">🧺</span>${esc(t('shopEmpty'))}</div>`}
      ${done.length ? `<div class="card"><div class="row between"><h2 style="margin:0">${esc(t('inCart'))}</h2><button class="btn small secondary" id="emptyCart">${esc(t('emptyCart', { n: done.length }))}</button></div><ul class="list" style="margin-top:6px">${done.sort((x, y) => y.t - x.t).map(shopRow).join('')}</ul></div>` : ''}`;
  }
  function shopRow(i) { return `<li class="item ${i.done ? 'done' : ''}" data-id="${i.id}"><button type="button" class="check ${i.done ? 'on' : ''}" data-check="${i.id}">${i.done ? '✓' : ''}</button><div class="name" data-qty="${i.id}">${esc(i.n)}${i.q ? `<small>${esc(i.q)}</small>` : ''}</div>${i.by ? `<span class="who ${i.by}">${i.by === 'a' ? '1' : '2'}</span>` : ''}<button type="button" class="act" data-del="${i.id}">✕</button></li>`; }
  function addShop(text) {
    text.split(',').map(s => s.trim()).filter(Boolean).forEach(nm => {
      const existing = S.get('shop').find(i => norm(i.n) === norm(nm));
      if (existing) { if (existing.done) S.set('shop', existing.id, Object.assign(stripId(existing), { done: false })); return; }
      const c = guessCat(nm); S.set('shop', S.uid(), { n: nm, q: '', c, done: false, by: me() });
      const fk = norm(nm).replace(/[.#$\[\]\/]/g, '_'); const f = S.state.fav[fk]; S.set('fav', fk, { n: nm, c, count: ((f && f.count) || 0) + 1 });
    });
  }
  function bindShop(v) {
    const inp = v.querySelector('#shopInput'); const add = () => { if (inp.value.trim()) { addShop(inp.value); inp.value = ''; inp.focus(); } };
    v.querySelector('#shopAdd').onclick = add; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    v.querySelectorAll('[data-fav]').forEach(b => b.onclick = () => addShop(b.dataset.fav));
    v.querySelectorAll('[data-check]').forEach(b => b.onclick = () => { const i = S.state.shop[b.dataset.check]; S.set('shop', b.dataset.check, Object.assign({}, i, { done: !i.done })); });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => S.del('shop', b.dataset.del));
    v.querySelectorAll('[data-qty]').forEach(el => el.onclick = () => { const i = S.state.shop[el.dataset.qty]; const q = prompt(t('qtyPlaceholder') + ' – ' + i.n, i.q || ''); if (q != null) S.set('shop', el.dataset.qty, Object.assign({}, i, { q: q.trim() })); });
    const ec = v.querySelector('#emptyCart'); if (ec) ec.onclick = () => S.get('shop').filter(i => i.done).forEach(i => S.del('shop', i.id));
  }

  // --- Úkoly ---
  function choreRow(c) {
    const d = daysUntil(c), [lbl, cls] = dueLabel(d), who = turn(c), last = c.last ? t('lastDone', { who: c.lastBy ? name(c.lastBy) : '', when: ago(c.last) }) : t('never');
    return `<li class="item" data-id="${c.id}"><span class="who ${who || 'any'}">${who ? (who === 'a' ? '1' : '2') : '∞'}</span><div class="name" data-edit="${c.id}">${esc(c.n)}<small>${who ? esc(t('turnOf', { name: name(who) })) + ' · ' : ''}${esc(t('freq_' + (c.freq || 'weekly')))} · ${esc(last)}</small></div><span class="pill ${cls}">${esc(lbl)}</span><button type="button" class="btn small ${d <= 0 ? '' : 'secondary'}" data-done="${c.id}">${esc(t('doneBtn'))}</button></li>`;
  }
  function choresHTML() {
    const all = S.get('chores').sort((x, y) => daysUntil(x) - daysUntil(y) || x.n.localeCompare(y.n)), due = all.filter(c => daysUntil(c) <= 0), later = all.filter(c => daysUntil(c) > 0);
    const logs = S.get('log').sort((x, y) => y.at - x.at).slice(0, 8);
    const names = new Set(all.map(c => norm(c.n)));
    return `<div class="card"><div class="row between"><h2 style="margin:0">${esc(t('scoreTitle'))}</h2><button class="btn small" id="newChore">+ ${esc(t('newChore'))}</button></div>${fairHTML(weekPoints(), t('scoreWeek'))}${fairHTML(totalPoints(), t('scoreTotal'))}</div>
      ${all.length ? `${due.length ? `<div class="card"><h2>${esc(t('due'))}</h2><ul class="list">${due.map(choreRow).join('')}</ul></div>` : ''}${later.length ? `<div class="card"><h2>${esc(t('later'))}</h2><ul class="list">${later.map(choreRow).join('')}</ul></div>` : ''}`
        : `<div class="empty"><span class="big">🧹</span>${esc(t('choresEmpty'))}</div>`}
      <div class="card"><h2>${esc(t('choresSuggest'))}</h2><div class="chips">${t('sugg').filter(s => !names.has(norm(s))).map(s => `<button type="button" class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
      <div class="card"><h2>${esc(t('log'))}</h2>${logs.length ? `<ul class="list">${logs.map(l => `<li class="item"><span class="who ${l.by}">${l.by === 'a' ? '1' : '2'}</span><div class="name">${esc(l.name)}<small>${esc(name(l.by))} · ${esc(ago(l.at))} · +${l.pts} ${esc(t('pts'))}</small></div></li>`).join('')}</ul>` : `<div class="muted">${esc(t('logEmpty'))}</div>`}</div>`;
  }
  function bindChoreRows(v) {
    v.querySelectorAll('[data-done]').forEach(b => b.onclick = () => { const c = S.state.chores[b.dataset.done]; if (c) doneChore(Object.assign({ id: b.dataset.done }, c)); });
    v.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => editChore(el.dataset.edit));
  }
  function bindChores(v) {
    bindChoreRows(v);
    v.querySelector('#newChore').onclick = () => editChore(null);
    v.querySelectorAll('[data-sugg]').forEach(b => b.onclick = () => editChore(null, b.dataset.sugg));
  }
  function editChore(id, presetName) {
    const c = id ? Object.assign({}, S.state.chores[id]) : { n: presetName || '', pts: 2, freq: 'weekly', who: 'turn' };
    const opt = (val, lbl, cur) => `<option value="${val}" ${val === cur ? 'selected' : ''}>${esc(lbl)}</option>`;
    sheet(`<h3>${esc(id ? t('edit') : t('newChore'))}</h3>
      <label class="field">${esc(t('choreName'))}</label><input class="input" id="chN" value="${esc(c.n)}" maxlength="60">
      <label class="field">${esc(t('choreFreq'))}</label><select class="input" id="chF">${['daily', 'weekly', 'biweekly', 'monthly', 'once'].map(f => opt(f, t('freq_' + f), c.freq)).join('')}</select>
      <label class="field">${esc(t('choreWho'))}</label><select class="input" id="chW">${opt('turn', t('who_turn'), c.who)}${opt('any', t('who_any'), c.who)}${opt('a', name('a'), c.who)}${opt('b', name('b'), c.who)}</select>
      <label class="field">${esc(t('chorePts'))}</label>${segHTML('pts', [['1', t('pts1')], ['2', t('pts2')], ['3', t('pts3')]], String(c.pts || 2))}
      <div class="actions">${id ? `<button class="btn danger" id="chDel">${esc(t('delete'))}</button>` : `<button class="btn secondary" id="chCancel">${esc(t('cancel'))}</button>`}<button class="btn" id="chSave">${esc(t('save'))}</button></div>`,
      p => {
        let pts = c.pts || 2; bindSeg(p, 'pts', val => { pts = Number(val); p.querySelectorAll('[data-seg="pts"] button').forEach(b => b.classList.toggle('on', b.dataset.val === val)); });
        p.querySelector('#chSave').onclick = () => { const n = p.querySelector('#chN').value.trim(); if (!n) return; S.set('chores', id || S.uid(), Object.assign(stripId(c), { n, freq: p.querySelector('#chF').value, who: p.querySelector('#chW').value, pts })); closeSheet(); };
        const cancel = p.querySelector('#chCancel'); if (cancel) cancel.onclick = closeSheet;
        const del = p.querySelector('#chDel'); if (del) del.onclick = () => { if (confirm(t('confirmDelete'))) { S.del('chores', id); closeSheet(); } };
        if (!c.n) setTimeout(() => p.querySelector('#chN').focus(), 50);
      });
  }

  // --- Víc ---
  const RULES = '{\n  "rules": {\n    "domy": {\n      "$dum": { ".read": true, ".write": true }\n    }\n  }\n}';
  function inviteLink() { const payload = { db: S.cfg.db, key: S.cfg.key, names: { a: (S.state.people.a || {}).name || '', b: (S.state.people.b || {}).name || '' } }; return location.origin + location.pathname + '#sdilet=' + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/=+$/, ''); }
  function moreHTML() {
    const on = S.enabled();
    return `<div class="card">${peopleHTML()}</div>
      <div class="card"><h2>${esc(t('lang'))}</h2>${segHTML('lang', [['cs', 'Česky'], ['ru', 'Русский']], lang())}<h2 style="margin-top:14px">${esc(t('theme'))}</h2>${segHTML('theme', [['auto', t('theme_auto')], ['light', t('theme_light')], ['dark', t('theme_dark')]], S.cfg.theme || 'auto')}</div>
      <div class="card"><h2>${esc(t('shareTitle'))}</h2>
        <div class="status-line"><span class="dot ${on ? S.status : ''}"></span> ${esc(on ? t('shareOn') + ' – ' + t('shareState_' + S.status) : t('shareOff'))}</div>
        ${on ? `<button class="btn block" id="invite" style="margin-top:12px">${esc(t('invite'))}</button><div class="muted" style="margin-top:6px;font-size:13px">${esc(t('inviteHint'))}</div>` : ''}
        <details style="margin-top:12px" ${on ? '' : 'open'}><summary><b>${esc(on ? t('dbUrl') : t('shareHow'))}</b></summary>
          ${on ? '' : `<div class="steps">${esc(t('shareSteps'))}</div><label class="field">${esc(t('rulesLabel'))}</label><pre class="code" id="rules">${esc(RULES)}</pre><button class="btn small secondary" id="copyRules">${esc(t('copy'))}</button>`}
          <label class="field">${esc(t('dbUrl'))}</label><input class="input" id="dbUrl" placeholder="https://…firebasedatabase.app" value="${esc(S.cfg.db)}" inputmode="url" autocapitalize="off" autocorrect="off">
          <label class="field">${esc(t('dbKey'))}</label><div class="row"><input class="input grow" id="dbKey" value="${esc(S.cfg.key || S.newKey())}" autocapitalize="off" autocorrect="off"><button class="btn small secondary" id="newKey">${esc(t('newKey'))}</button></div><div class="muted" style="font-size:13px;margin-top:4px">${esc(t('keyHint'))}</div>
          <div class="row" style="margin-top:12px"><button class="btn grow" id="connect">${esc(t('connect'))}</button>${on ? `<button class="btn danger" id="disconnect">${esc(t('disconnect'))}</button>` : ''}</div>
        </details></div>
      <div class="card"><h2>${esc(t('installTitle'))}</h2><div class="muted">${esc(t('installSteps'))}</div></div>
      <div class="card"><h2>${esc(t('dataTitle'))}</h2><div class="row"><button class="btn secondary grow" id="exportBtn">${esc(t('exportBtn'))}</button><label class="btn secondary grow" style="text-align:center">${esc(t('importBtn'))}<input type="file" id="importFile" accept=".json,application/json" hidden></label></div>
        <button class="btn danger block" id="resetBtn" style="margin-top:10px">${esc(t('resetBtn'))}</button></div>
      <div class="muted" style="text-align:center;font-size:13px;padding:6px 10px 20px">${esc(t('about'))}</div>`;
  }
  async function copyText(txt) { try { await navigator.clipboard.writeText(txt); return true; } catch (e) { prompt(t('copy'), txt); return false; } }
  function bindMore(v) {
    bindPeople(v, p => { S.cfg.me = p; S.persist(); render(); });
    bindSeg(v, 'lang', val => { S.cfg.lang = val; S.persist(); render(); });
    bindSeg(v, 'theme', val => { S.cfg.theme = val; S.persist(); render(); });
    const cr = v.querySelector('#copyRules'); if (cr) cr.onclick = async () => { if (await copyText(RULES)) toast(t('copied')); };
    v.querySelector('#newKey').onclick = () => { v.querySelector('#dbKey').value = S.newKey(); };
    v.querySelector('#connect').onclick = () => {
      const url = v.querySelector('#dbUrl').value.trim().replace(/\/+$/, ''), key = v.querySelector('#dbKey').value.trim();
      if (!/^https:\/\/[a-z0-9.-]+\.(firebasedatabase\.app|firebaseio\.com)$/i.test(url) || key.length < 8) { toast(t('badUrl')); return; }
      S.setSharing(url, key); render();
    };
    const dc = v.querySelector('#disconnect'); if (dc) dc.onclick = () => { S.setSharing('', ''); render(); };
    const inv = v.querySelector('#invite'); if (inv) inv.onclick = async () => { const link = inviteLink(); if (navigator.share) { try { await navigator.share({ title: t('appName'), url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; } } if (await copyText(link)) toast(t('inviteCopied')); };
    v.querySelector('#exportBtn').onclick = () => { const blob = new Blob([S.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nase-doma-' + dateKey(Date.now()) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    v.querySelector('#importFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { toast(S.importJSON(String(r.result)) ? t('importOk') : t('importBad')); }; r.readAsText(f); };
    v.querySelector('#resetBtn').onclick = () => { if (confirm(t('resetConfirm'))) { S.disconnect(); S.resetLocal(); location.hash = ''; location.reload(); } };
  }

  // --- Pozvánka odkazem (#sdilet=…) ---
  function handleInvite() {
    const m = location.hash.match(/sdilet=([A-Za-z0-9+/=_-]+)/); if (!m) return false;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (o && o.db && o.key) {
        ['a', 'b'].forEach(p => { if (o.names && o.names[p] && !(S.state.people[p] || {}).name) S.state.people[p] = { name: o.names[p], t: 1 }; });
        S.cfg.me = ''; S.setSharing(o.db, o.key); history.replaceState(null, '', location.pathname + location.search);
        setTimeout(() => toast(t('joinedToast')), 300); return true;
      }
    } catch (e) { /* vadný odkaz ignorujeme */ }
    return false;
  }

  // --- Start ---
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => go(b.dataset.tab));
  S.onChange(() => render());
  window.addEventListener('online', render); window.addEventListener('offline', render);
  if (!handleInvite()) S.connect();
  S.purge();
  render();
  setInterval(() => { if (tab === 'today' || tab === 'chores') render(); }, 60000);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.NaseDoma = { t, render, go, guessCat, daysUntil, turn, weekPoints, questionIndex, inviteLink, lang, name, openDecider, pickIdea, ideas, closeSheet, get tab() { return tab; }, get decResult() { return decResult; }, get decSpinning() { return decSpinning; } };
})();
