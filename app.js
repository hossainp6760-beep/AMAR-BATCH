(function () {
  const $app = document.getElementById('app');
  const cfg = window.AMB;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let lang = 'bn';
  try { lang = localStorage.getItem('amb_lang') || 'bn'; } catch (e) {}
  let me = null;           // profile
  let drafts = [];         // File blobs for submit screen

  const t = (k) => (I18N[lang] && I18N[lang][k]) || k;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bnDigits = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
  const num = (x) => (lang === 'bn' ? bnDigits(x) : String(x));
  const fmt = (iso, opts) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', opts || { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(d);
  };
  const setLang = (l) => {
    lang = l; document.documentElement.lang = l;
    try { localStorage.setItem('amb_lang', l); } catch (e) {}
    if (me) sb.from('profiles').update({ lang: l }).eq('id', me.id).then(() => {});
    render();
  };
  window.__setLang = setLang;

  const toggle = () => `<div class="tog"><button class="${lang === 'bn' ? 'on' : ''}" onclick="__setLang('bn')">বাংলা</button><button class="${lang === 'en' ? 'on' : ''}" onclick="__setLang('en')">English</button></div>`;
  const BOOK = (w) => `<svg width="${w}" height="${w * 0.78}" viewBox="0 0 72 56" aria-label="logo"><path d="M36 12C30 7 18 5 6 8V46C18 43 30 45 36 50Z" fill="#fff"/><path d="M36 12C42 7 54 5 66 8V46C54 43 42 45 36 50Z" fill="#CFE0FF"/><path d="M13 18c6-1 11 0 16 2M13 26c6-1 11 0 16 2M13 34c6-1 11 0 16 2M59 18c-6-1-11 0-16 2M59 26c-6-1-11 0-16 2M59 34c-6-1-11 0-16 2" fill="none" stroke="#2B6FE0" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  const tabs = (on) => `<nav>${[['home', '⌂', 'home'], ['classes', '▶', 'classes'], ['hw', '✎', 'hw']].map(([r, i, k]) => `<a href="#/${r}" class="${on === r ? 'on' : ''}"><b>${i}</b>${t(k)}</a>`).join('')}<a href="#/logout"><b>⎋</b>${t('logout')}</a></nav>`;
  const top = (title, sub, back) => `<div class="top"><div class="row">${back ? `<a href="#/${back}" style="color:#C9D3F0;text-decoration:none;font-weight:600">‹ ${t('back')}</a>` : ''}<div class="sp"></div>${toggle()}</div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
  const statusPill = (s, due) => {
    if (!s) return due && new Date(due) < new Date() ? `<span class="pill p-bad">${t('late')}</span>` : `<span class="pill p-warn">${t('pending')}</span>`;
    const m = { submitted: ['p-blue', 'submitted'], checking: ['p-blue', 'checking'], review: ['p-warn', 'review'], published: ['p-ok', 'published'] }[s.status];
    return `<span class="pill ${m[0]}">${t(m[1])}</span>`;
  };

  // ---------- Screens ----------
  function splash() {
    $app.innerHTML = `<div class="splash"><div style="position:absolute;top:-120px;right:-140px;width:360px;height:360px;border-radius:50%;background:#1F5FD6;opacity:.22"></div>
      <div style="position:absolute;top:16px;right:16px;z-index:2">${toggle()}</div>
      <div class="logo">${BOOK(88)}<div style="font-size:34px;font-weight:700">${t('app')}</div><div style="font-size:15px;font-weight:600;color:#CFE0FF">${t('academy')}</div><div style="font-size:14px;color:#B9C9F2">${t('slogan')}</div></div>
      <div style="flex:1"></div>
      <div style="font-size:30px;font-weight:700;line-height:1.2;position:relative">${t('hero')}</div>
      <div style="font-size:16px;line-height:1.6;color:#D3DDF7;margin:12px 0 24px;position:relative">${t('heroSub')}</div>
      <a href="#/login" class="btn" style="background:#1F6FEB;text-decoration:none;position:relative">${t('start')}</a>
      <div style="text-align:center;margin-top:16px;position:relative"><a href="#/login" style="color:#D3DDF7;text-decoration:none">${t('haveAcc')}</a></div></div>`;
  }

  function login() {
    $app.innerHTML = `${top(t('welcome'), t('loginSub'))}<main><div class="card"><label>${t('sid')}</label><input id="sid" placeholder="${esc(t('sidPh'))}" autocapitalize="characters" autocomplete="username">
      <label>${t('pw')}</label><input id="pw" type="password" autocomplete="current-password"><div class="err" id="err"></div><div style="height:12px"></div>
      <button class="btn" id="go">${t('login')}</button></div><div class="muted">${t('newHint')}</div></main>`;
    document.getElementById('go').onclick = async () => {
      const sid = document.getElementById('sid').value.trim().toLowerCase();
      const pw = document.getElementById('pw').value;
      const { error } = await sb.auth.signInWithPassword({ email: `${sid}@${cfg.EMAIL_DOMAIN}`, password: pw });
      if (error) { document.getElementById('err').textContent = t('badLogin'); return; }
      await boot(); location.hash = '#/home';
    };
  }

  async function home() {
    $app.innerHTML = top(`${t('hello')}, ${me.full_name}`, me.student_code || '') + `<main>${t('loading')}</main>${tabs('home')}`;
    const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start.getTime() + 864e5);
    const [cl, hw, subs] = await Promise.all([
      sb.from('classes').select('*').gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
      sb.from('homeworks').select('*').order('due_at').limit(20),
      sb.from('submissions').select('homework_id,status').eq('student_id', me.id)]);
    const sm = Object.fromEntries((subs.data || []).map((s) => [s.homework_id, s]));
    const pend = (hw.data || []).filter((h) => !sm[h.id] && new Date(h.due_at) > new Date()).slice(0, 3);
    $app.innerHTML = top(`${t('hello')}, ${me.full_name}`, me.student_code || '') + `<main>
      ${me.fee_due ? `<div class="card" style="background:#FDF0DC;border-color:#F3D9A8"><b style="color:#7A3A06">${t('feeDue')}</b></div>` : ''}
      <div class="card"><h3>${t('liveNow')}</h3>${(cl.data || []).length ? cl.data.map((c) => `<div class="row" style="margin:8px 0"><div class="sp"><b>${esc(c.title)}</b><div class="muted">${fmt(c.starts_at, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' })} · ${esc(c.teacher_name || '')}</div></div>${c.meet_url ? `<a class="pill p-blue" style="text-decoration:none" href="${esc(c.meet_url)}" target="_blank" rel="noopener">${t('join')}</a>` : ''}</div>`).join('') : `<div class="muted">${t('noClass')}</div>`}</div>
      <div class="card"><h3>${t('due')}</h3>${pend.length ? pend.map((h) => `<a href="#/submit/${h.id}" style="text-decoration:none;color:inherit;display:flex;justify-content:space-between;margin:8px 0"><div><b>${esc(h.title)}</b><div class="muted">${esc(h.subject || '')} · ${fmt(h.due_at)}</div></div><span class="pill p-warn">${t('pending')}</span></a>`).join('') : `<div class="muted">${t('noHw')}</div>`}</div></main>${tabs('home')}`;
  }

  async function classesScreen() {
    $app.innerHTML = top(t('classesT'), '') + `<main>${t('loading')}</main>${tabs('classes')}`;
    const { data } = await sb.from('classes').select('*').order('starts_at', { ascending: false }).limit(30);
    $app.innerHTML = top(t('classesT'), '') + `<main>${(data || []).map((c) => `<div class="card row"><div class="sp"><b>${esc(c.title)}</b><div class="muted">${fmt(c.starts_at)} · ${esc(c.teacher_name || '')}</div></div>${c.record_url ? `<a class="pill p-ok" style="text-decoration:none" href="${esc(c.record_url)}" target="_blank" rel="noopener">${t('watch')}</a>` : c.meet_url && new Date(c.starts_at) > new Date(Date.now() - 36e5) ? `<a class="pill p-blue" style="text-decoration:none" href="${esc(c.meet_url)}" target="_blank" rel="noopener">${t('join')}</a>` : ''}</div>`).join('')}</main>${tabs('classes')}`;
  }

  async function hwList() {
    $app.innerHTML = top(t('hw'), '') + `<main>${t('loading')}</main>${tabs('hw')}`;
    const [hw, subs] = await Promise.all([sb.from('homeworks').select('*').order('due_at', { ascending: false }).limit(40), sb.from('submissions').select('*').eq('student_id', me.id)]);
    const sm = Object.fromEntries((subs.data || []).map((s) => [s.homework_id, s]));
    $app.innerHTML = top(t('hw'), '') + `<main>${(hw.data || []).length ? hw.data.map((h) => { const s = sm[h.id]; const to = s && s.status === 'published' ? `#/result/${h.id}` : `#/submit/${h.id}`;
      return `<a href="${to}" class="card row" style="text-decoration:none;color:inherit"><div class="sp"><b>${esc(h.title)}</b><div class="muted">${esc(h.subject || '')} · ${fmt(h.due_at)}</div></div>${statusPill(s, h.due_at)}</a>`; }).join('') : `<div class="muted">${t('noHw')}</div>`}</main>${tabs('hw')}`;
  }

  // Resize to max 1600px JPEG ~0.72
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(); const u = URL.createObjectURL(file);
      img.onload = () => { const m = 1600, r = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.72); };
      img.onerror = rej; img.src = u;
    });
  }

  async function submitScreen(id) {
    drafts = [];
    const { data: h } = await sb.from('homeworks').select('*').eq('id', id).single();
    const { data: ex } = await sb.from('submissions').select('*').eq('homework_id', id).eq('student_id', me.id).maybeSingle();
    if (!h) { location.hash = '#/hw'; return; }
    const closed = new Date(h.due_at) < new Date();
    const paint = () => {
      $app.innerHTML = top(t('submit'), h.title, 'hw') + `<main>
        <div class="card"><b>${esc(h.title)}</b><div class="muted">${esc(h.subject || '')} · ${t('due')}: ${fmt(h.due_at)}</div>${h.question_url ? `<div style="margin-top:8px"><a href="${esc(h.question_url)}" target="_blank" rel="noopener">PDF</a></div>` : ''}</div>
        ${ex ? `<div class="card">${statusPill(ex, h.due_at)}</div>` : ''}
        <div class="card"><div class="muted" style="margin-bottom:10px">${t('tip')}</div><h3>${t('pages')} (${num(drafts.length)})</h3>
          <div class="thumbs">${drafts.map((d, i) => `<div style="background-image:url(${d.url})"><button onclick="__rm(${i})" aria-label="${t('remove')}">×</button></div>`).join('')}</div>
          <div style="height:10px"></div><input id="file" type="file" accept="image/*" multiple capture="environment" style="display:none">
          <button class="btn ghost" onclick="document.getElementById('file').click()" ${closed ? 'disabled' : ''}>${t('takePhoto')}</button></div>
        <div class="err" id="err"></div><button class="btn" id="send" ${closed ? 'disabled' : ''}>${t('send')}</button></main>`;
      document.getElementById('file').onchange = async (e) => {
        for (const f of e.target.files) { const b = await shrink(f); drafts.push({ blob: b, url: URL.createObjectURL(b) }); } paint(); };
      document.getElementById('send').onclick = async () => {
        const err = document.getElementById('err'); if (!drafts.length) { err.textContent = t('needPhoto'); return; }
        const btn = document.getElementById('send'); btn.disabled = true; btn.textContent = t('sending');
        try {
          const paths = [];
          for (let i = 0; i < drafts.length; i++) { const p = `${me.id}/${id}/${Date.now()}_${i}.jpg`;
            const { error } = await sb.storage.from('scripts').upload(p, drafts[i].blob, { contentType: 'image/jpeg' }); if (error) throw error; paths.push(p); }
          const { error } = await sb.from('submissions').upsert({ homework_id: id, student_id: me.id, pages: paths, status: 'submitted' }, { onConflict: 'homework_id,student_id' });
          if (error) throw error;
          location.hash = '#/hw';
        } catch (e) { err.textContent = t('err'); btn.disabled = false; btn.textContent = t('send'); }
      };
    };
    window.__rm = (i) => { drafts.splice(i, 1); paint(); };
    paint();
  }

  async function result(id) {
    const [{ data: h }, { data: s }] = await Promise.all([sb.from('homeworks').select('*').eq('id', id).single(), sb.from('submissions').select('*').eq('homework_id', id).eq('student_id', me.id).maybeSingle()]);
    if (!h || !s || s.status !== 'published') { $app.innerHTML = top(t('hw'), '', 'hw') + `<main><div class="card">${t('noResult')}</div></main>${tabs('hw')}`; return; }
    const fb = Array.isArray(s.feedback) ? s.feedback : [];
    $app.innerHTML = top(h.title, '', 'hw') + `<main>
      <div class="card" style="text-align:center"><div class="muted">${t('marks')}</div><div style="font-size:44px;font-weight:700;color:var(--navy)">${num(s.marks)} <span style="font-size:20px;color:var(--muted)">/ ${num(h.max_marks)}</span></div></div>
      ${fb.length ? `<div class="card"><h3>${t('whyCut')}</h3>${fb.map((r) => `<div class="row" style="margin:8px 0"><div class="sp"><b>${esc(r.part)}</b> <span class="muted">${esc(r.reason || '')}</span></div><b>${num(r.got)}/${num(r.max)}</b></div>`).join('')}</div>` : ''}
      <div class="muted">${s.ai_checked ? '✦ ' + t('aiNote') + '<br>' : ''}${t('imgDel')}</div></main>${tabs('hw')}`;
  }

  // ---------- Router ----------
  async function boot() {
    const { data } = await sb.auth.getSession();
    if (!data.session) { me = null; return; }
    const { data: p } = await sb.from('profiles').select('*').eq('id', data.session.user.id).single();
    me = p; if (p && (p.lang === 'bn' || p.lang === 'en') && !localStorage.getItem('amb_lang')) lang = p.lang;
  }
  async function render() {
    const h = location.hash.replace(/^#\/?/, '') || 'splash'; const [r, id] = h.split('/');
    document.documentElement.lang = lang;
    try {
      if (r === 'logout') { await sb.auth.signOut(); me = null; location.hash = '#/splash'; return; }
      if (r === 'splash') return splash();
      if (r === 'login') return login();
      if (!me) { location.hash = '#/login'; return; }
      if (r === 'home') return await home();
      if (r === 'classes') return await classesScreen();
      if (r === 'hw') return await hwList();
      if (r === 'submit') return await submitScreen(id);
      if (r === 'result') return await result(id);
      location.hash = '#/home';
    } catch (e) { $app.innerHTML = `<main><div class="card">${t('err')}</div></main>`; console.error(e); }
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', (e) => { if (e.key === 'amb_lang' && (e.newValue === 'bn' || e.newValue === 'en')) { lang = e.newValue; render(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  boot().then(render);
})();
