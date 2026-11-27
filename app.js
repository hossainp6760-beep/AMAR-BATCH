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

  const toggle = (light) => `<div class="tog${light ? ' light' : ''}"><button class="${lang === 'bn' ? 'on' : ''}" onclick="__setLang('bn')">বাংলা</button><button class="${lang === 'en' ? 'on' : ''}" onclick="__setLang('en')">English</button></div>`;
  const BOOK = (w) => `<svg width="${w}" height="${w * 0.78}" viewBox="0 0 72 56" aria-label="logo"><path d="M36 12C30 7 18 5 6 8V46C18 43 30 45 36 50Z" fill="#fff"/><path d="M36 12C42 7 54 5 66 8V46C54 43 42 45 36 50Z" fill="#CFE0FF"/><path d="M13 18c6-1 11 0 16 2M13 26c6-1 11 0 16 2M13 34c6-1 11 0 16 2M59 18c-6-1-11 0-16 2M59 26c-6-1-11 0-16 2M59 34c-6-1-11 0-16 2" fill="none" stroke="#2B6FE0" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  const tabs = (on) => `<nav>${(me && (me.role === 'admin' || me.role === 'assistant') ? [['admin', '⚙', 'adminT']] : me && me.role === 'teacher' ? [['mine', '▶', 'mineT']] : [['home', '⌂', 'home'], ['classes', '▶', 'classes'], ['hw', '✎', 'hw'], ['batches', '☰', 'batches']]).map(([r, i, k]) => `<a href="#/${r}" class="${on === r ? 'on' : ''}"><b>${i}</b>${t(k)}</a>`).join('')}<a href="#/logout"><b>⎋</b>${t('logout')}</a></nav>`;
  const top = (title, sub, back, av) => `<div class="top"><div class="row">${back ? `<a href="#/${back}" style="color:#C9D3F0;text-decoration:none;font-weight:600">‹ ${t('back')}</a>` : ''}<div class="sp"></div>${toggle()}</div>${av ? `<div class="row" style="gap:12px;align-items:center">${av}<div>` : ''}<h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}${av ? '</div></div>' : ''}</div>`;
  const avatar = (p, size, edit) => {
    const s = size || 48; const ini = esc(((p && p.full_name) || '?').trim().charAt(0).toUpperCase());
    const inner = p && p.photo_url ? `<img src="${esc(p.photo_url)}" alt="" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;display:block">`
      : `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#2B6FE0;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(s * 0.45)}px">${ini}</div>`;
    return edit ? `<label style="cursor:pointer;display:block;flex:none" title="${esc(t('changePhoto'))}">${inner}<input id="avin" type="file" accept="image/*" hidden></label>` : `<div style="flex:none">${inner}</div>`;
  };
  async function uploadAvatar(uid, file) {
    const blob = await shrink(file, 480);
    const path = `${uid}/avatar.jpg`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) return false;
    const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    const { error: e2 } = await sb.from('profiles').update({ photo_url: url }).eq('id', uid);
    return !e2;
  }
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
      <a href="#/signup" class="btn" style="background:#1F6FEB;text-decoration:none;position:relative">${t('start')}</a>
      <div style="text-align:center;margin-top:16px;position:relative"><a href="#/login" style="color:#D3DDF7;text-decoration:none">${t('haveAcc')}</a></div></div>`;
  }

  const authEmail = (v) => (v.includes('@') ? v : `${v.replace(/\s/g, '')}@${cfg.EMAIL_DOMAIN}`);
  let loginRole = 'student';
  function login() {
    const tabBtn = (r, k) => `<button onclick="__role('${r}')" style="flex:1;border:0;border-radius:12px;padding:10px 0;font:700 14px inherit;font-family:inherit;cursor:pointer;${loginRole === r ? 'background:var(--blue);color:#fff' : 'background:transparent;color:var(--muted)'}">${t(k)}</button>`;
    const logo = `<svg width="64" height="50" viewBox="0 0 72 56" aria-label="logo"><path d="M36 12C30 7 18 5 6 8V46C18 43 30 45 36 50Z" fill="#0D1B4C"/><path d="M36 12C42 7 54 5 66 8V46C54 43 42 45 36 50Z" fill="#1F5FD6"/><path d="M13 18c6-1 11 0 16 2M13 26c6-1 11 0 16 2M13 34c6-1 11 0 16 2M59 18c-6-1-11 0-16 2M59 26c-6-1-11 0-16 2M59 34c-6-1-11 0-16 2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    $app.innerHTML = `<div style="padding:10px 18px 0"><div class="row"><div class="sp"></div>${toggle(true)}</div></div>
      <main><div style="text-align:center;margin-top:6px">${logo}<div style="font-size:20px;font-weight:700;color:var(--navy)">${t('academy')}</div><div style="font-size:14px;font-weight:600;color:var(--navy)">${t('tracker')}</div></div>
      <div><div style="font-size:24px;font-weight:700">${t('welcomeBack')}</div><div class="muted">${t('loginSub2')}</div></div>
      <div style="display:flex;background:#EAF0FB;border-radius:14px;padding:4px;gap:2px">${tabBtn('student', 'roleStudent')}${tabBtn('teacher', 'roleTeacher')}${tabBtn('parent', 'roleParent')}</div>
      <div class="card"><label style="margin-top:0">${t('sidOrPhone')}</label><input id="sid" placeholder="${esc(t('phonePh'))}" autocapitalize="characters" autocomplete="username">
      <label>${t('pw')}</label><div style="position:relative"><input id="pw" type="password" autocomplete="current-password" style="padding-right:64px"><button id="eye" type="button" style="position:absolute;right:8px;top:8px;height:32px;border:0;background:transparent;color:var(--blue);font:600 13px inherit;font-family:inherit;cursor:pointer">${t('showPw')}</button></div>
      <div style="text-align:right;margin-top:8px"><a href="javascript:void(0)" id="fg" style="color:var(--blue);font-size:13px;font-weight:600;text-decoration:none">${t('forgot')}</a></div>
      <div class="err" id="err"></div><div style="height:10px"></div><button class="btn" id="go">${t('login')}</button></div>
      <div style="text-align:center"><a href="#/signup" style="color:var(--blue);font-weight:600;text-decoration:none">${t('noAcc')}</a></div></main>`;
    window.__role = (r) => { loginRole = r; login(); };
    document.getElementById('eye').onclick = () => { const p = document.getElementById('pw'); const show = p.type === 'password'; p.type = show ? 'text' : 'password'; };
    document.getElementById('fg').onclick = async () => {
      const v = document.getElementById('sid').value.trim().toLowerCase(); const err = document.getElementById('err');
      if (v.includes('@')) { const { error } = await sb.auth.resetPasswordForEmail(v, { redirectTo: location.origin + location.pathname }); err.style.color = error ? '' : 'var(--ok)'; err.textContent = error ? t('err') : t('resetSent'); }
      else { err.style.color = ''; err.textContent = t('forgotMsg'); }
    };
    document.getElementById('go').onclick = async () => {
      const sid = document.getElementById('sid').value.trim().toLowerCase();
      const pw = document.getElementById('pw').value;
      const { error } = await sb.auth.signInWithPassword({ email: authEmail(sid), password: pw });
      if (error) { document.getElementById('err').textContent = t('badLogin'); return; }
      await boot();
      if (!me) { document.getElementById('err').textContent = 'Profile error: ' + (window.__bootErr || 'unknown'); return; }
      const ok = loginRole === 'teacher' ? (me.role === 'teacher' || me.role === 'admin') : me.role === loginRole;
      if (!ok) { await sb.auth.signOut(); me = null; document.getElementById('err').textContent = t('wrongRole'); return; }
      if (location.hash === '#/home') render(); else location.hash = '#/home';
    };
  }


  function resetScreen() {
    $app.innerHTML = `${top(t('resetT'), '')}<main><div class="card"><label style="margin-top:0">${t('newPw')}</label><input id="np" type="password" autocomplete="new-password"><div class="err" id="err"></div><div style="height:10px"></div><button class="btn" id="go">${t('savePw')}</button></div></main>`;
    document.getElementById('go').onclick = async () => {
      const np = document.getElementById('np').value; const err = document.getElementById('err');
      if (np.length < 6) { err.textContent = t('pwShort'); return; }
      const { error } = await sb.auth.updateUser({ password: np });
      if (error) { err.textContent = t('err'); return; }
      await boot(); location.hash = me ? '#/home' : '#/login';
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
    const { data: myEn } = await sb.from('enrollments').select('id').eq('student_id', me.id).eq('status', 'approved').limit(1);
    const hasBatch = !!(myEn && myEn.length);
    const pend = (hw.data || []).filter((h) => !sm[h.id] && new Date(h.due_at) > new Date()).slice(0, 3);
    $app.innerHTML = top(`${t('hello')}, ${me.full_name}`, me.role === 'teacher' ? (me.subject || '') : [me.student_code, me.class_level ? (me.class_level === 'admission' ? t('admissionOpt') : t('classWord') + ' ' + num(me.class_level)) : ''].filter(Boolean).join(' · '), null, avatar(me, 52, true)) + `<main>
      ${hasBatch ? '' : `<a href="#/batches" class="card" style="text-decoration:none;color:inherit;background:var(--soft);border-color:#C9D8F6"><b style="color:var(--blue)">${t('joinPrompt')} ›</b></a>`}
      <a href="#/faculty" class="card" style="text-decoration:none;color:inherit"><b>${t('tabFaculty')} ›</b><div class="muted">${t('facSub')}</div></a>
      ${me.fee_due ? `<div class="card" style="background:#FDF0DC;border-color:#F3D9A8"><b style="color:#7A3A06">${t('feeDue')}</b></div>` : ''}
      <div class="card"><h3>${t('liveNow')}</h3>${(cl.data || []).length ? cl.data.map((c) => `<div class="row" style="margin:8px 0"><div class="sp"><b>${esc(c.title)}</b><div class="muted">${fmt(c.starts_at, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' })}</div></div>${c.status === 'cancelled' ? pill('p-bad', 'cancelledW') : c.meet_url ? `<a class="pill p-blue" style="text-decoration:none" href="${esc(c.meet_url)}" target="_blank" rel="noopener">${t('join')}</a>` : ''}</div>`).join('') : `<div class="muted">${t('noClass')}</div>`}</div>
      <div class="card"><h3>${t('due')}</h3>${pend.length ? pend.map((h) => `<a href="#/submit/${h.id}" style="text-decoration:none;color:inherit;display:flex;justify-content:space-between;margin:8px 0"><div><b>${esc(h.title)}</b><div class="muted">${esc(h.subject || '')} · ${fmt(h.due_at)}</div></div><span class="pill p-warn">${t('pending')}</span></a>`).join('') : `<div class="muted">${t('noHw')}</div>`}</div></main>${tabs('home')}`;
    const avin = document.getElementById('avin');
    if (avin) avin.onchange = async () => { if (!avin.files[0]) return; const ok = await uploadAvatar(me.id, avin.files[0]); if (ok) { await boot(); home(); } else alert(t('err')); };
  }

  async function classesScreen() {
    $app.innerHTML = top(t('classesT'), '') + `<main>${t('loading')}</main>${tabs('classes')}`;
    const { data } = await sb.from('classes').select('*').order('starts_at', { ascending: false }).limit(30);
    $app.innerHTML = top(t('classesT'), '') + `<main>${(data || []).map((c) => `<div class="card row"><div class="sp"><b>${esc(c.title)}</b><div class="muted">${fmt(c.starts_at)}</div></div>${c.status === 'cancelled' ? pill('p-bad', 'cancelledW') : c.record_url ? `<a class="pill p-ok" style="text-decoration:none" href="${esc(c.record_url)}" target="_blank" rel="noopener">${t('watch')}</a>` : c.meet_url && new Date(c.starts_at) > new Date(Date.now() - 36e5) ? `<a class="pill p-blue" style="text-decoration:none" href="${esc(c.meet_url)}" target="_blank" rel="noopener">${t('join')}</a>` : ''}</div>`).join('')}</main>${tabs('classes')}`;
  }

  async function hwList() {
    $app.innerHTML = top(t('hw'), '') + `<main>${t('loading')}</main>${tabs('hw')}`;
    const [hw, subs] = await Promise.all([sb.from('homeworks').select('*').order('due_at', { ascending: false }).limit(40), sb.from('submissions').select('*').eq('student_id', me.id)]);
    const sm = Object.fromEntries((subs.data || []).map((s) => [s.homework_id, s]));
    $app.innerHTML = top(t('hw'), '') + `<main>${(hw.data || []).length ? hw.data.map((h) => { const s = sm[h.id]; const to = s && s.status === 'published' ? `#/result/${h.id}` : `#/submit/${h.id}`;
      return `<a href="${to}" class="card row" style="text-decoration:none;color:inherit"><div class="sp"><b>${esc(h.title)}</b><div class="muted">${esc(h.subject || '')} · ${fmt(h.due_at)}</div></div>${statusPill(s, h.due_at)}</a>`; }).join('') : `<div class="muted">${t('noHw')}</div>`}</main>${tabs('hw')}`;
  }

  // Resize to max 1600px JPEG ~0.72
  function shrink(file, maxPx) {
    return new Promise((res, rej) => {
      const img = new Image(); const u = URL.createObjectURL(file);
      img.onload = () => { const m = maxPx || 1600, r = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement('canvas');
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


  let signRole = 'student';
  function signup() {
    const chip = (r, k) => `<button onclick="__srole('${r}')" style="flex:1;border:0;border-radius:12px;padding:10px 0;font:700 14px inherit;font-family:inherit;cursor:pointer;${signRole === r ? 'background:var(--blue);color:#fff' : 'background:transparent;color:var(--muted)'}">${t(k)}</button>`;
    const keep = (id) => { const e = document.getElementById(id); return e ? esc(e.value) : ''; };
    const v = { nm: keep('nm'), ph: keep('ph'), em: keep('em'), sj: keep('sj'), sc: keep('sc'), sk: keep('sk'), gp: keep('gp') };
    const clsOpts = ['5','6','7','8','9','10','11','12','admission'].map((c) => `<option value="${c}">${c === 'admission' ? t('admissionOpt') : t('classWord') + ' ' + num(c)}</option>`).join('');
    $app.innerHTML = `${top(t('createAcc'), t('signupSub'))}<main><div class="card">
      <div style="display:flex;gap:4px;background:var(--soft);border-radius:14px;padding:4px;margin-bottom:6px">${chip('student', 'roleStudent')}${chip('teacher', 'roleTeacher')}${chip('parent', 'roleParent')}</div>
      <label>${t('fullName')}</label><input id="nm" autocomplete="name" value="${v.nm}">
      <label>${t('phone')}</label><input id="ph" type="tel" inputmode="numeric" placeholder="${esc(t('phonePh'))}" autocomplete="tel" value="${v.ph}">
      ${signRole === 'student' ? `<label>${t('classLbl')}</label><select id="cl"><option value="">${t('classPick')}</option>${clsOpts}</select>
      <label>${t('schoolLbl')}</label><input id="sk" value="${v.sk}">
      <label>${t('guardianPh')}</label><input id="gp" type="tel" inputmode="numeric" placeholder="${esc(t('phonePh'))}" value="${v.gp}">` : ''}
      ${signRole === 'teacher' ? `<label>${t('subjectLbl')}</label><input id="sj" placeholder="${esc(t('subjectPh'))}" value="${v.sj}"><div class="muted" style="font-size:12px;margin-top:4px">${t('teacherNote')}</div>` : ''}
      ${signRole === 'parent' ? `<label>${t('childId')}</label><input id="sc" placeholder="AB-2026-015" autocapitalize="characters" value="${v.sc}"><div class="muted" style="font-size:12px;margin-top:4px">${t('childIdHint')}</div>` : ''}
      <label>${t('emailLbl')}</label><input id="em" type="email" autocomplete="email" value="${v.em}"><div class="muted" style="font-size:12px;margin-top:4px">${t('emailHint')}</div>
      <label>${t('photoOpt')}</label><input id="pic" type="file" accept="image/*">
      <label>${t('pw')}</label><input id="pw" type="password" autocomplete="new-password"><div class="err" id="err"></div><div style="height:12px"></div>
      <button class="btn" id="go">${t('signup')}</button></div>
      <div style="text-align:center"><a href="#/login" style="color:var(--blue);font-weight:600;text-decoration:none">${t('hasAcc')}</a></div></main>`;
    window.__srole = (r) => { signRole = r; signup(); };
    document.getElementById('go').onclick = async () => {
      const err = document.getElementById('err');
      const nm = document.getElementById('nm').value.trim();
      const ph = document.getElementById('ph').value.replace(/\D/g, '');
      const pw = document.getElementById('pw').value;
      const em = document.getElementById('em').value.trim().toLowerCase();
      const sj = signRole === 'teacher' ? document.getElementById('sj').value.trim() : '';
      const sc = signRole === 'parent' ? document.getElementById('sc').value.trim().toUpperCase() : '';
      const cl = signRole === 'student' ? document.getElementById('cl').value : '';
      const sk = signRole === 'student' ? document.getElementById('sk').value.trim() : '';
      const gp = signRole === 'student' ? document.getElementById('gp').value.replace(/\D/g, '') : '';
      const pic = document.getElementById('pic').files[0];
      if (!nm) { err.textContent = t('nameNeed'); return; }
      if (!/^01\d{9}$/.test(ph)) { err.textContent = t('phoneBad'); return; }
      if (signRole === 'teacher' && !sj) { err.textContent = t('subjectNeed'); return; }
      if (signRole === 'student' && !cl) { err.textContent = t('classNeed'); return; }
      if (signRole === 'student' && !/^01\d{9}$/.test(gp)) { err.textContent = t('guardianBad'); return; }
      if (pw.length < 6) { err.textContent = t('pwShort'); return; }
      const btn = document.getElementById('go'); btn.disabled = true;
      if (signRole === 'parent') {
        if (!sc) { err.textContent = t('childIdNeed'); btn.disabled = false; return; }
        const { data: ok } = await sb.rpc('student_exists', { code: sc });
        if (!ok) { err.textContent = t('childIdBad'); btn.disabled = false; return; }
      }
      const { data, error } = await sb.auth.signUp({ email: em || `${ph}@${cfg.EMAIL_DOMAIN}`, password: pw, options: { data: { full_name: nm, phone: ph, lang, role: signRole, subject: sj, class_level: cl, school: sk, guardian_phone: gp } } });
      if (error) { btn.disabled = false; err.textContent = /registered|exists/i.test(error.message) ? t('exists') : error.message; return; }
      if (!data.session) { btn.disabled = false; err.textContent = t('err'); return; }
      if (signRole === 'parent') { const { data: linked } = await sb.rpc('link_parent', { code: sc }); if (!linked) { btn.disabled = false; err.textContent = t('childIdBad'); return; } }
      if (pic) { try { await uploadAvatar(data.session.user.id, pic); } catch (e) {} }
      btn.disabled = false;
      await boot();
      if (!me) { err.textContent = 'Profile error: ' + (window.__bootErr || 'unknown'); return; }
      location.hash = me.role === 'student' ? '#/batches' : '#/home';
    };
  }

  // ================= Office (admin / assistant): batches, routine, classes =================
  const DAYS = { bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
  const dayName = (d) => DAYS[lang][d];
  const fmtT = (st) => (st ? new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date('1970-01-01T' + String(st).slice(0, 5) + ':00')) : '');
  const toMin = (st) => { const p = String(st).split(':'); return (+p[0]) * 60 + (+p[1]); };
  const clsName = (c) => (c === 'admission' ? t('admissionOpt') : t('classWord') + ' ' + num(c));
  const pill = (cls, k) => `<span class="pill ${cls}">${t(k)}</span>`;
  let batchEdit = null, routineView = 'batch', routineBatch = '', slotEdit = null, gridCls = '', gridTeacher = '';

  async function regen(slotId) {
    if (slotId) await sb.from('classes').delete().eq('slot_id', slotId).gt('starts_at', new Date().toISOString());
    await sb.rpc('generate_classes', { weeks: 4 });
  }

  function slotClash(slots, s, selfId) {
    if (!s.teacher_id) return [];
    const a0 = toMin(s.start_time), a1 = a0 + (+s.duration_min || 60);
    return slots.filter((o) => o.id !== selfId && o.teacher_id === s.teacher_id && +o.day === +s.day
      && (() => { const b0 = toMin(o.start_time), b1 = b0 + (+o.duration_min || 60); return a0 < b1 && b0 < a1; })());
  }

  // ---- Pending approvals block (admin only) ----
  function pendApprovals(c) {
    const { batches, slots, byId, bm } = c;
    const bName = (id) => { const b = bm[id]; return b ? (b.subject || b.name) : ''; };
    const slotTxt = (s) => `${dayName(s.day)} ${fmtT(s.start_time)} · ${num(s.duration_min)} ${t('minShort')}${s.topic ? ' · ' + esc(s.topic) : ''} · ${esc(byId[s.teacher_id] ? byId[s.teacher_id].full_name : '—')}`;
    const ob = (cls, act, id, label) => `<button class="pill ${cls}" style="border:0;cursor:pointer;font-family:inherit;margin:2px 0 2px 6px" onclick="__o('${act}','${id}')">${t(label)}</button>`;
    const card = (title, sub, actions) => `<div class="card" style="display:flex;gap:10px;align-items:center"><div class="sp" style="min-width:0"><b>${title}</b><div class="muted">${sub}</div></div><div style="flex:none;display:flex;flex-wrap:wrap;justify-content:flex-end;max-width:46%">${actions}</div></div>`;
    const bp = batches.filter((b) => b.status === 'pending');
    const bc = batches.filter((b) => b.status === 'active' && b.pending);
    const sp = slots.filter((s) => !s.approved);
    const sc = slots.filter((s) => s.approved && s.pending);
    const none = !(bp.length || bc.length || sp.length || sc.length);
    let h = `<h3 style="margin:14px 0 8px">${t('batchReq')}</h3>`;
    if (none) return h + `<div class="muted">${t('nothingPending')}</div>`;
    h += bp.map((b) => card(esc(b.subject || b.name), `${esc(b.name)} · ${b.class_level ? clsName(b.class_level) : ''}${b.fee ? ' · ৳' + num(b.fee) : ''}`, ob('p-ok', 'bAp', b.id, 'approve') + ob('p-bad', 'bRt', b.id, 'sendBack'))).join('');
    h += bc.map((b) => card(esc(b.subject || b.name) + ' ' + pill('p-warn', 'changeReq'), esc(Object.entries(b.pending).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : v}`).join(' · ')), ob('p-ok', 'bCa', b.id, 'approve') + ob('p-bad', 'bCr', b.id, 'reject'))).join('');
    h += `<h3 style="margin:14px 0 8px">${t('routineReq')}</h3>`;
    h += sp.map((s) => card(esc(bName(s.batch_id)), slotTxt(s), ob('p-ok', 'sAp', s.id, 'approve') + ob('p-bad', 'sRj', s.id, 'reject'))).join('');
    h += sc.map((s) => { const p = s.pending; const txt = p._delete ? t('delSlot') : slotTxt({ ...s, ...p });
      return card(esc(bName(s.batch_id)) + ' ' + pill('p-warn', 'changeReq'), txt, ob('p-ok', 'sCa', s.id, 'approve') + ob('p-bad', 'sCr', s.id, 'reject')); }).join('');
    if (!sp.length && !sc.length) h += `<div class="muted">${t('nothingPending')}</div>`;
    return h;
  }

  // ---- Batches tab ----
  function batchesTab(c) {
    const { head, bar, isAdmin, people, byId, batches, enrolls } = c;
    const staffAll = people.filter((p) => (p.role === 'teacher' || p.role === 'assistant') && p.approved);
    const cur = batchEdit && batchEdit !== 'new' ? batches.find((b) => b.id === batchEdit) : null;
    const cnt = (id) => enrolls.filter((e) => e.batch_id === id && e.status === 'approved').length;
    const stPill = (b) => (b.status === 'active' ? pill('p-ok', 'stActive') : b.status === 'returned' ? pill('p-bad', 'stReturned') : pill('p-warn', 'stPending')) + (b.status === 'active' && b.pending ? ' ' + pill('p-warn', 'changeReq') : '');
    const list = batches.length ? batches.map((b) => { const n = cnt(b.id); const over = b.capacity && n > b.capacity;
      return `<div class="card"><div class="row"><div class="sp"><b>${esc(b.subject || b.name)}</b> ${stPill(b)}<div class="muted">${esc(b.name)} · ${b.class_level ? clsName(b.class_level) : ''}${b.fee ? ' · ৳' + num(b.fee) : ''}</div>
        <div class="muted" style="${over ? 'color:#B42318;font-weight:700' : ''}">${t('seats')}: ${num(n)}${b.capacity ? ' / ' + num(b.capacity) : ''}${over ? ' ⚠' : ''}${b.is_open ? '' : ' · ' + t('admClosed')}</div>
        ${b.status === 'returned' && b.admin_note ? `<div class="muted" style="color:#B42318">${t('note')}: ${esc(b.admin_note)}</div>` : ''}</div>
        <button class="pill p-blue" style="border:0;cursor:pointer;font-family:inherit" onclick="__o('bEdit','${b.id}')">${t('fEdit')}</button></div></div>`; }).join('') : `<div class="muted">${t('noBatch')}</div>`;
    const sel = cur ? cur.staff_ids || [] : [];
    const val = (k) => (cur ? esc(cur[k] == null ? '' : cur[k]) : '');
    const form = batchEdit ? `<div class="card"><h3 style="margin-top:0">${cur ? t('fEdit') : t('newBatch')}</h3>
      <label style="margin-top:0">${t('batchName')}</label><input id="bn" value="${val('name')}">
      <label>${t('facSubject')}</label><input id="bs" list="subjList2" value="${val('subject')}"><datalist id="subjList2">${['গণিত', 'উচ্চতর গণিত', 'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'ইংরেজি', 'বাংলা', 'আইসিটি', 'সাধারণ বিজ্ঞান'].map((s) => `<option value="${s}">`).join('')}</datalist>
      <label>${t('classLbl')}</label><select id="bc"><option value="">—</option>${CLASS_KEYS.map((k) => `<option value="${k}" ${cur && cur.class_level === k ? 'selected' : ''}>${clsName(k)}</option>`).join('')}</select>
      <label>${t('feeLbl')}</label><input id="bf" type="number" inputmode="numeric" value="${val('fee')}">
      <label>${t('startDate')}</label><input id="bd" type="date" value="${val('start_date')}">
      <label>${t('capLbl')}</label><input id="bcap" type="number" inputmode="numeric" value="${val('capacity')}">
      <label>${t('descLbl')}</label><input id="bdesc" value="${val('description')}">
      <label>${t('meetLbl')}</label><input id="bmeet" value="${val('meet_url')}">
      <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="bopen" ${!cur || cur.is_open ? 'checked' : ''} style="width:18px;height:18px">${t('admOpen')}</label>
      <label>${t('staffLbl')}</label><div>${staffAll.map((p) => `<label style="display:flex;align-items:center;gap:8px;margin:4px 0;font-weight:600"><input type="checkbox" class="bst" value="${p.id}" ${sel.includes(p.id) ? 'checked' : ''} style="width:18px;height:18px">${esc(p.full_name)} <span class="muted">(${p.role === 'teacher' ? esc(p.subject || t('roleTeacher')) : t('tabAssist')})</span></label>`).join('') || `<div class="muted">—</div>`}</div>
      ${!isAdmin ? `<div class="muted" style="font-size:12px;margin-top:8px">${t('needsApproval')}</div>` : ''}
      <div class="err" id="berr"></div><div style="height:10px"></div>
      <div style="display:flex;gap:8px"><button class="btn" id="bsave" style="flex:1">${t('fSave')}</button><button class="btn" id="bcancel" style="flex:none;width:100px;background:#E3E8F3;color:var(--ink)">${t('fCancel')}</button></div></div>` : '';
    $app.innerHTML = head() + `<main>${bar}${batchEdit ? '' : `<button class="btn" id="badd" style="margin-bottom:12px">＋ ${t('newBatch')}</button>`}${form}${batchEdit ? '' : list}</main>${tabs('admin')}`;
    const badd = document.getElementById('badd'); if (badd) badd.onclick = () => { batchEdit = 'new'; adminScreen(); };
    const bcancel = document.getElementById('bcancel'); if (bcancel) bcancel.onclick = () => { batchEdit = null; adminScreen(); };
    const bsave = document.getElementById('bsave');
    if (bsave) bsave.onclick = async () => {
      const err = document.getElementById('berr'); err.textContent = '';
      const g = (id) => document.getElementById(id).value.trim();
      const sens = { name: g('bn'), subject: g('bs') || null, class_level: g('bc') || null, fee: g('bf') ? +g('bf') : null,
        start_date: g('bd') || null, capacity: g('bcap') ? +g('bcap') : null, staff_ids: [...document.querySelectorAll('.bst:checked')].map((x) => x.value) };
      const minor = { description: g('bdesc') || null, meet_url: g('bmeet') || null, is_open: document.getElementById('bopen').checked };
      if (!sens.name || !sens.subject || !sens.class_level) { err.textContent = t('batchNeed'); return; }
      bsave.disabled = true; let e1;
      if (!cur) e1 = (await sb.from('batches').insert({ ...sens, ...minor, status: isAdmin ? 'active' : 'pending' })).error;
      else if (isAdmin || cur.status !== 'active') e1 = (await sb.from('batches').update({ ...sens, ...minor }).eq('id', cur.id)).error;
      else {
        const diff = {}; Object.keys(sens).forEach((k) => { if (JSON.stringify(sens[k]) !== JSON.stringify(cur[k] == null ? (k === 'staff_ids' ? [] : null) : cur[k])) diff[k] = sens[k]; });
        e1 = (await sb.from('batches').update({ ...minor, pending: Object.keys(diff).length ? diff : cur.pending }).eq('id', cur.id)).error;
      }
      if (e1) { err.textContent = e1.message; bsave.disabled = false; return; }
      batchEdit = null; adminScreen();
    };
  }

  // ---- Routine tab ----
  function routineTab(c) {
    const { head, bar, isAdmin, people, byId, batches, slots, bm } = c;
    const teachers = people.filter((p) => p.role === 'teacher' && p.approved);
    const live = batches.filter((b) => b.status !== 'returned');
    if (!routineBatch && live[0]) routineBatch = live[0].id;
    const sName = (id) => { const b = bm[id]; return b ? (b.subject || b.name) + (b.class_level ? ' · ' + clsName(b.class_level) : '') : ''; };
    const sorted = (arr) => arr.slice().sort((a, b) => DAY_ORDER.indexOf(+a.day) - DAY_ORDER.indexOf(+b.day) || toMin(a.start_time) - toMin(b.start_time));
    const stPill = (s) => (!s.approved ? pill('p-warn', 'stPending') : s.pending ? pill('p-warn', 'changeReq') : pill('p-ok', 'stActive'));
    const toggle2 = `<div style="display:flex;gap:6px;margin-bottom:12px"><button class="pill ${routineView === 'batch' ? 'p-blue' : ''}" style="border:0;cursor:pointer;font-family:inherit;padding:8px 14px;background:${routineView === 'batch' ? '' : '#E3E8F3'}" onclick="__o('rv','batch')">${t('byBatch')}</button><button class="pill ${routineView === 'grid' ? 'p-blue' : ''}" style="border:0;cursor:pointer;font-family:inherit;padding:8px 14px;background:${routineView === 'grid' ? '' : '#E3E8F3'}" onclick="__o('rv','grid')">${t('weekGrid')}</button></div>`;
    let body = '';
    if (routineView === 'grid') {
      const act = slots.filter((s) => (!gridCls || (bm[s.batch_id] && bm[s.batch_id].class_level === gridCls)) && (!gridTeacher || s.teacher_id === gridTeacher));
      body = `<div style="display:flex;gap:6px;margin-bottom:12px"><select id="gc" onchange="__o('gc',this.value)"><option value="">${t('allClasses')}</option>${CLASS_KEYS.map((k) => `<option value="${k}" ${gridCls === k ? 'selected' : ''}>${clsName(k)}</option>`).join('')}</select>
        <select id="gt" onchange="__o('gt',this.value)"><option value="">${t('allTeachers')}</option>${teachers.map((p) => `<option value="${p.id}" ${gridTeacher === p.id ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('')}</select></div>`
        + DAY_ORDER.map((d) => { const ds = sorted(act.filter((s) => +s.day === d)); if (!ds.length) return '';
          return `<h3 style="margin:12px 0 6px">${dayName(d)}</h3>` + ds.map((s) => { const clash = slotClash(slots, s, s.id).length;
            return `<div class="card" style="${clash ? 'border-color:#F3B4B4;background:#FFF5F5' : ''}"><b>${fmtT(s.start_time)}</b> · ${esc(sName(s.batch_id))} ${stPill(s)}<div class="muted">${esc(byId[s.teacher_id] ? byId[s.teacher_id].full_name : '—')}${s.topic ? ' · ' + esc(s.topic) : ''}${clash ? ' · <span style="color:#B42318;font-weight:700">⚠ ' + t('clashW') + '</span>' : ''}</div></div>`; }).join(''); }).join('') || `<div class="muted">${t('noSlots')}</div>`;
    } else {
      const mine = sorted(slots.filter((s) => s.batch_id === routineBatch));
      const cur = slotEdit && slotEdit !== 'new' ? slots.find((s) => s.id === slotEdit) : null;
      const val = (k, d) => (cur && cur[k] != null ? esc(cur[k]) : d);
      const form = slotEdit ? `<div class="card"><h3 style="margin-top:0">${cur ? t('fEdit') : t('addSlot')}</h3>
        <label style="margin-top:0">${t('dayLbl')}</label><select id="sd">${DAY_ORDER.map((d) => `<option value="${d}" ${cur && +cur.day === d ? 'selected' : ''}>${dayName(d)}</option>`).join('')}</select>
        <label>${t('timeLbl')}</label><input id="st" type="time" value="${cur ? String(cur.start_time).slice(0, 5) : '20:00'}">
        <label>${t('durLbl')}</label><input id="sdu" type="number" inputmode="numeric" value="${val('duration_min', '60')}">
        <label>${t('topicLbl')}</label><input id="stp" value="${val('topic', '')}">
        <label>${t('teacherLbl')}</label><select id="stc"><option value="">—</option>${teachers.map((p) => `<option value="${p.id}" ${cur && cur.teacher_id === p.id ? 'selected' : ''}>${esc(p.full_name)} (${esc(p.subject || '')})</option>`).join('')}</select>
        <label>${t('meetLbl')}</label><input id="smt" value="${val('meet_url', '')}">
        ${!isAdmin ? `<div class="muted" style="font-size:12px;margin-top:8px">${t('needsApproval')}</div>` : ''}
        <div class="err" id="serr"></div><div style="height:10px"></div>
        <div style="display:flex;gap:8px"><button class="btn" id="ssave" style="flex:1">${t('fSave')}</button><button class="btn" id="scancel" style="flex:none;width:100px;background:#E3E8F3;color:var(--ink)">${t('fCancel')}</button></div></div>` : '';
      body = `<select id="rb" onchange="__o('rb',this.value)" style="margin-bottom:12px">${live.map((b) => `<option value="${b.id}" ${routineBatch === b.id ? 'selected' : ''}>${esc(sName(b.id) || b.name)}</option>`).join('')}</select>`
        + (slotEdit ? '' : `<button class="btn" id="sadd" style="margin-bottom:12px">＋ ${t('addSlot')}</button>`) + form
        + (slotEdit ? '' : (mine.length ? mine.map((s) => `<div class="card"><div class="row"><div class="sp"><b>${dayName(s.day)} ${fmtT(s.start_time)}</b> · ${num(s.duration_min)} ${t('minShort')} ${stPill(s)}<div class="muted">${esc(byId[s.teacher_id] ? byId[s.teacher_id].full_name : '—')}${s.topic ? ' · ' + esc(s.topic) : ''}</div></div>
          <div style="flex:none"><button class="pill p-blue" style="border:0;cursor:pointer;font-family:inherit;margin-right:4px" onclick="__o('sEdit','${s.id}')">${t('fEdit')}</button><button class="pill p-bad" style="border:0;cursor:pointer;font-family:inherit" onclick="__o('sDel','${s.id}')">${t('del')}</button></div></div></div>`).join('') : `<div class="muted">${t('noSlots')}</div>`));
    }
    $app.innerHTML = head() + `<main>${bar}${toggle2}${body}</main>${tabs('admin')}`;
    const sadd = document.getElementById('sadd'); if (sadd) sadd.onclick = () => { slotEdit = 'new'; adminScreen(); };
    const scancel = document.getElementById('scancel'); if (scancel) scancel.onclick = () => { slotEdit = null; adminScreen(); };
    const ssave = document.getElementById('ssave');
    if (ssave) ssave.onclick = async () => {
      const err = document.getElementById('serr'); err.textContent = '';
      const cur = slotEdit && slotEdit !== 'new' ? slots.find((s) => s.id === slotEdit) : null;
      const g = (id) => document.getElementById(id).value.trim();
      const sens = { day: +g('sd'), start_time: g('st'), duration_min: +g('sdu') || 60, teacher_id: g('stc') || null };
      const minor = { topic: g('stp') || null, meet_url: g('smt') || null };
      if (!sens.start_time) { err.textContent = t('timeNeed'); return; }
      const cl = slotClash(slots, { ...sens }, cur ? cur.id : null);
      if (cl.length && !confirm(t('clashConfirm') + '\n' + cl.map((o) => sName(o.batch_id) + ' ' + fmtT(o.start_time)).join(', '))) return;
      ssave.disabled = true; let e1;
      if (!cur) e1 = (await sb.from('batch_slots').insert({ batch_id: routineBatch, ...sens, ...minor, approved: isAdmin })).error;
      else if (isAdmin || !cur.approved) e1 = (await sb.from('batch_slots').update({ ...sens, ...minor }).eq('id', cur.id)).error;
      else {
        const diff = {}; Object.keys(sens).forEach((k) => { if (String(sens[k] == null ? '' : sens[k]).slice(0, 5) !== String(cur[k] == null ? '' : cur[k]).slice(0, 5)) diff[k] = sens[k]; });
        e1 = (await sb.from('batch_slots').update({ ...minor, pending: Object.keys(diff).length ? diff : cur.pending }).eq('id', cur.id)).error;
      }
      if (e1) { err.textContent = e1.message; ssave.disabled = false; return; }
      if (isAdmin) await regen(cur ? cur.id : null);
      slotEdit = null; adminScreen();
    };
  }

  // ---- Classes tab (upcoming 14 days; substitution / cancel) ----
  async function classesTab(c) {
    const { head, bar, people, byId, bm } = c;
    $app.innerHTML = head() + `<main>${bar}${t('loading')}</main>${tabs('admin')}`;
    const since = new Date(Date.now() - 3600e3).toISOString(), until = new Date(Date.now() + 14 * 864e5).toISOString();
    const { data: cls } = await sb.from('classes').select('*').gte('starts_at', since).lte('starts_at', until).order('starts_at');
    const ids = (cls || []).map((x) => x.id);
    const { data: cs } = ids.length ? await sb.from('class_staff').select('*').in('class_id', ids) : { data: [] };
    const sm = Object.fromEntries((cs || []).map((x) => [x.class_id, x]));
    const teachers = people.filter((p) => p.role === 'teacher' && p.approved);
    const busy = (cl, tid) => (cls || []).some((o) => o.id !== cl.id && o.status !== 'cancelled' && sm[o.id] && sm[o.id].teacher_id === tid
      && new Date(o.starts_at) < new Date(cl.ends_at || new Date(new Date(cl.starts_at).getTime() + 36e5)) && new Date(cl.starts_at) < new Date(o.ends_at || new Date(new Date(o.starts_at).getTime() + 36e5)));
    const list = (cls || []).map((cl) => { const s = sm[cl.id] || {}; const cancelled = cl.status === 'cancelled';
      return `<div class="card"><div class="row"><div class="sp"><b>${esc(cl.title)}</b> ${cancelled ? pill('p-bad', 'cancelledW') : ''}${s.need_sub ? ' ' + pill('p-warn', 'needSub') : ''}${!s.sub_confirmed && s.teacher_id ? ' ' + pill('p-warn', 'subUnconfirmed') : ''}
        <div class="muted">${fmt(cl.starts_at)}</div><div class="muted">${t('teacherLbl')}: ${esc(byId[s.teacher_id] ? byId[s.teacher_id].full_name : '—')}</div>${s.need_sub && s.leave_reason ? `<div class="muted">${t('leaveWhy')}: ${esc(s.leave_reason)}</div>` : ''}</div></div>
        ${cancelled ? `<div style="margin-top:8px"><button class="pill p-blue" style="border:0;cursor:pointer;font-family:inherit" onclick="__o('rx','${cl.id}')">${t('restore')}</button></div>` : `<div style="display:flex;gap:6px;margin-top:8px;align-items:center"><select id="sub-${cl.id}" style="height:38px;flex:1"><option value="">${t('pickSub')}</option>${teachers.map((p) => `<option value="${p.id}">${esc(p.full_name)}${busy(cl, p.id) ? ' — ' + t('busyW') : ''}</option>`).join('')}</select>
          <button class="pill p-ok" style="border:0;cursor:pointer;font-family:inherit" onclick="__o('sub','${cl.id}')">${t('assignSub')}</button><button class="pill p-bad" style="border:0;cursor:pointer;font-family:inherit" onclick="__o('cx','${cl.id}')">${t('cancelClass')}</button></div>`}</div>`; }).join('');
    $app.innerHTML = head() + `<main>${bar}${list || `<div class="muted">${t('noClassesYet')}</div>`}</main>${tabs('admin')}`;
  }

  async function officeTab(c) {
    if (adminTab === 'batches') return batchesTab(c);
    if (adminTab === 'routine') return routineTab(c);
    return classesTab(c);
  }

  // ---- Handler for office actions ----
  window.__o = async (act, id) => {
    let err = null;
    const reload = () => adminScreen();
    if (act === 'rv') { routineView = id; slotEdit = null; return reload(); }
    if (act === 'rb') { routineBatch = id; slotEdit = null; return reload(); }
    if (act === 'gc') { gridCls = id; return reload(); }
    if (act === 'gt') { gridTeacher = id; return reload(); }
    if (act === 'bEdit') { batchEdit = id; return reload(); }
    if (act === 'sEdit') { slotEdit = id; return reload(); }
    if (act === 'bAp') err = (await sb.from('batches').update({ status: 'active', admin_note: null }).eq('id', id)).error;
    else if (act === 'bRt') { const n = prompt(t('noteAsk')); if (n === null) return; err = (await sb.from('batches').update({ status: 'returned', admin_note: n || null }).eq('id', id)).error; }
    else if (act === 'bCa') { const { data: b } = await sb.from('batches').select('pending').eq('id', id).single(); err = (await sb.from('batches').update({ ...(b && b.pending), pending: null }).eq('id', id)).error; }
    else if (act === 'bCr') err = (await sb.from('batches').update({ pending: null }).eq('id', id)).error;
    else if (act === 'sAp') { err = (await sb.from('batch_slots').update({ approved: true }).eq('id', id)).error; if (!err) await regen(id); }
    else if (act === 'sRj') err = (await sb.from('batch_slots').delete().eq('id', id)).error;
    else if (act === 'sCa') {
      const { data: s } = await sb.from('batch_slots').select('pending').eq('id', id).single();
      if (s && s.pending && s.pending._delete) { await sb.from('classes').delete().eq('slot_id', id).gt('starts_at', new Date().toISOString()); err = (await sb.from('batch_slots').delete().eq('id', id)).error; }
      else { err = (await sb.from('batch_slots').update({ ...(s && s.pending), pending: null }).eq('id', id)).error; if (!err) await regen(id); }
    }
    else if (act === 'sCr') err = (await sb.from('batch_slots').update({ pending: null }).eq('id', id)).error;
    else if (act === 'sDel') {
      if (!confirm(t('delSlotConfirm'))) return;
      const { data: s } = await sb.from('batch_slots').select('approved').eq('id', id).single();
      if (me.role === 'admin') { await sb.from('classes').delete().eq('slot_id', id).gt('starts_at', new Date().toISOString()); err = (await sb.from('batch_slots').delete().eq('id', id)).error; }
      else if (s && s.approved) err = (await sb.from('batch_slots').update({ pending: { _delete: true } }).eq('id', id)).error;
      else err = (await sb.from('batch_slots').delete().eq('id', id)).error;
    }
    else if (act === 'sub') { const v = document.getElementById('sub-' + id).value; if (!v) return; err = (await sb.from('class_staff').update({ teacher_id: v, sub_confirmed: false }).eq('class_id', id)).error; }
    else if (act === 'cx') { if (!confirm(t('cancelConfirm'))) return; err = (await sb.from('classes').update({ status: 'cancelled' }).eq('id', id)).error; }
    else if (act === 'rx') err = (await sb.from('classes').update({ status: 'scheduled' }).eq('id', id)).error;
    if (err) { alert(err.message || t('err')); return; }
    reload();
  };

  // ================= Teacher: my classes =================
  async function mineScreen() {
    $app.innerHTML = top(t('mineT'), me.full_name, null, avatar(me, 44, true)) + `<main>${t('loading')}</main>${tabs('mine')}`;
    const { data: cs } = await sb.from('class_staff').select('*').eq('teacher_id', me.id);
    const ids = (cs || []).map((x) => x.class_id);
    const { data: cls } = ids.length ? await sb.from('classes').select('*').in('id', ids).gte('starts_at', new Date(Date.now() - 3600e3).toISOString()).order('starts_at') : { data: [] };
    const sm = Object.fromEntries((cs || []).map((x) => [x.class_id, x]));
    const list = (cls || []).map((cl) => { const s = sm[cl.id]; const cancelled = cl.status === 'cancelled';
      return `<div class="card"><b>${esc(cl.title)}</b> ${cancelled ? pill('p-bad', 'cancelledW') : ''}${s.need_sub ? ' ' + pill('p-warn', 'needSub') : ''}<div class="muted">${fmt(cl.starts_at)}</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${cl.meet_url && !cancelled ? `<a class="pill p-blue" style="text-decoration:none" href="${esc(cl.meet_url)}" target="_blank" rel="noopener">${t('join')}</a>` : ''}
        ${!s.sub_confirmed ? `<button class="pill p-ok" style="border:0;cursor:pointer;font-family:inherit" onclick="__t('take','${cl.id}')">${t('takeIt')}</button>` : (!s.need_sub && !cancelled ? `<button class="pill p-warn" style="border:0;cursor:pointer;font-family:inherit" onclick="__t('leave','${cl.id}')">${t('cantTake')}</button>` : '')}</div></div>`; }).join('');
    $app.innerHTML = top(t('mineT'), me.full_name, null, avatar(me, 44, true)) + `<main>${list || `<div class="card muted">${t('noMine')}</div>`}</main>${tabs('mine')}`;
    const avin = document.getElementById('avin');
    if (avin) avin.onchange = async () => { if (!avin.files[0]) return; const ok = await uploadAvatar(me.id, avin.files[0]); if (ok) { await boot(); mineScreen(); } else alert(t('err')); };
    window.__t = async (act, id) => {
      let e;
      if (act === 'leave') { const r = prompt(t('leaveAsk')); if (r === null) return; e = (await sb.from('class_staff').update({ need_sub: true, leave_reason: r || null }).eq('class_id', id)).error; }
      else if (act === 'take') e = (await sb.from('class_staff').update({ sub_confirmed: true, need_sub: false, leave_reason: null }).eq('class_id', id)).error;
      if (e) { alert(e.message || t('err')); return; }
      mineScreen();
    };
  }

  // ================= Student: faculty page =================
  let facClass = '';
  async function facultyScreen() {
    $app.innerHTML = top(t('tabFaculty'), t('facSub'), 'home') + `<main>${t('loading')}</main>${tabs('home')}`;
    const { data } = await sb.from('faculty').select('*').eq('active', true).order('full_name');
    const all = data || [];
    const chips = ['', ...CLASS_KEYS].map((k) => `<button onclick="__fc('${k}')" style="flex:none;border:0;border-radius:999px;padding:8px 14px;font:700 13px inherit;font-family:inherit;cursor:pointer;${facClass === k ? 'background:var(--blue);color:#fff' : 'background:#E3E8F3;color:var(--ink)'}">${k ? clsName(k) : t('allClasses')}</button>`).join('');
    const list = all.filter((f) => !facClass || (f.classes || []).includes(facClass));
    const subjects = [...new Set(list.map((f) => f.subject))].sort((a, b) => a.localeCompare(b, 'bn'));
    const card = (f) => `<div class="card" style="display:flex;gap:12px;align-items:center">${avatar(f, 56)}<div class="sp" style="min-width:0"><b>${esc(f.full_name)}</b><div class="muted">${esc(f.subject)}</div>${f.qualification ? `<div class="muted">${esc(f.qualification)}</div>` : ''}${f.experience ? `<div class="muted">${esc(f.experience)}</div>` : ''}</div></div>`;
    $app.innerHTML = top(t('tabFaculty'), t('facSub'), 'home') + `<main><div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px">${chips}</div>${subjects.length ? subjects.map((sj) => `<h3 style="margin:12px 0 6px">${esc(sj)}</h3>` + list.filter((f) => f.subject === sj).map(card).join('')).join('') : `<div class="muted">${t('noFac')}</div>`}</main>${tabs('home')}`;
    window.__fc = (k) => { facClass = k; facultyScreen(); };
  }


  let adminTab = 'pending', adminQ = '', facEdit = null;
  const CLASS_KEYS = ['5', '6', '7', '8', '9', '10', '11', '12', 'admission'];
  async function adminScreen() {
    const isAdmin = me.role === 'admin';
    const head = () => top(t('adminT'), me.full_name, null, avatar(me, 44));
    $app.innerHTML = head() + `<main>${t('loading')}</main>${tabs('admin')}`;
    const [pr, enAll, bt, fc, sl] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('enrollments').select('*'),
      sb.from('batches').select('*'),
      sb.from('faculty').select('*').order('full_name'),
      sb.from('batch_slots').select('*')]);
    if (pr.error) { $app.innerHTML = head() + `<main><div class="card">${esc(pr.error.message)}</div></main>${tabs('admin')}`; return; }
    const people = pr.data || []; const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    const bm = Object.fromEntries((bt.data || []).map((b) => [b.id, b]));
    const enrolls = enAll.data || []; const faculty = fc.data || []; const batches = bt.data || []; const slots = sl.data || [];
    const pendT = isAdmin ? people.filter((p) => p.role === 'teacher' && !p.approved) : [];
    const pendE = enrolls.filter((e) => e.status === 'pending' && byId[e.student_id]);
    const bq = isAdmin ? batches.filter((b) => b.status === 'pending' || (b.status === 'active' && b.pending)).length + slots.filter((s) => !s.approved || s.pending).length : 0;
    const cnt = pendT.length + pendE.length + bq;
    const tabsList = isAdmin ? ['pending', 'batches', 'routine', 'classes', 'student', 'teacher', 'parent', 'assistant', 'faculty'] : ['pending', 'batches', 'routine', 'classes', 'student', 'faculty'];
    const tabLabel = { pending: 'pendTab', student: 'studentsTab', teacher: 'teachersTab', parent: 'parentsTab', assistant: 'tabAssist', faculty: 'tabFaculty', batches: 'tabBatches', routine: 'tabRoutine', classes: 'tabClasses' };
    const clsTxt = (p) => (p.class_level ? (p.class_level === 'admission' ? t('admissionOpt') : t('classWord') + ' ' + num(p.class_level)) : '');
    const clsKey = (c) => (c === 'admission' ? t('admissionOpt') : num(c));
    const btn = (cls, act, id, label) => `<button class="pill ${cls}" style="border:0;cursor:pointer;font-family:inherit;margin:2px 0 2px 6px" onclick="__adm('${act}','${id}')">${t(label)}</button>`;
    const row = (p, actions, extra) => `<div class="card" style="display:flex;gap:12px;align-items:center">${avatar(p, 44)}<div class="sp" style="min-width:0"><b>${esc(p.full_name)}</b><div class="muted">${esc([p.student_code, p.role === 'teacher' ? p.subject : clsTxt(p), p.phone].filter(Boolean).join(' · '))}</div>${extra || ''}${p.role === 'parent' && p.parent_of && byId[p.parent_of] ? `<div class="muted">${t('childOf')}: ${esc(byId[p.parent_of].full_name)} (${esc(byId[p.parent_of].student_code || '')})</div>` : ''}</div><div style="flex:none;display:flex;flex-wrap:wrap;justify-content:flex-end;max-width:46%">${actions || ''}</div></div>`;
    const enrInfo = (p) => p.role !== 'student' ? '' : enrolls.filter((e) => e.student_id === p.id && e.status === 'approved').map((e) => { const b = bm[e.batch_id]; const by = byId[e.approved_by]; return `<div class="muted">✓ ${esc(b ? (b.subject || b.name) : '')}${by ? ` · ${t('approvedBy')}: ${esc(by.full_name)}` : ''}</div>`; }).join('');
    const tabBtn = (k) => `<button onclick="__admTab('${k}')" style="flex:none;border:0;border-radius:12px;padding:9px 12px;font:700 13px inherit;font-family:inherit;cursor:pointer;white-space:nowrap;${adminTab === k ? 'background:var(--blue);color:#fff' : 'background:transparent;color:var(--muted)'}">${t(tabLabel[k])}${k === 'pending' && cnt ? ` <span style="background:#E5484D;color:#fff;border-radius:999px;padding:1px 6px;font-size:11px">${num(cnt)}</span>` : ''}</button>`;
    const bar = `<div style="display:flex;gap:2px;background:var(--soft);border-radius:14px;padding:4px;margin-bottom:12px;overflow-x:auto">${tabsList.map(tabBtn).join('')}</div>`;
    const searchBox = `<div style="display:flex;gap:6px;margin-bottom:12px"><div style="position:relative;flex:1"><input id="aq" placeholder="${esc(t('searchPh'))}" value="${esc(adminQ)}" style="padding-right:38px"><button id="ax" style="position:absolute;right:6px;top:8px;border:0;background:#E3E8F3;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px;display:${adminQ ? 'block' : 'none'}">×</button></div><button id="amic" style="flex:none;width:48px;height:48px;border:1px solid #CBD2E1;border-radius:12px;background:#fff;font-size:20px;cursor:pointer">🎤</button></div>`;
    const wireSearch = (draw) => {
      const aq = document.getElementById('aq');
      aq.oninput = () => { adminQ = aq.value; draw(); };
      document.getElementById('ax').onclick = () => { adminQ = ''; aq.value = ''; draw(); aq.focus(); };
      document.getElementById('amic').onclick = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert(t('noVoice')); return; }
        const r = new SR(); r.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        r.onresult = (ev) => { aq.value = ev.results[0][0].transcript; aq.oninput(); };
        try { r.start(); } catch (e) {}
      };
      draw();
    };
    const match = (arr, fields) => { const q = adminQ.trim().toLowerCase(); return arr.filter((p) => !q || fields.some((f) => ((p[f]) || '').toLowerCase().includes(q))); };
    const showX = () => { const x = document.getElementById('ax'); if (x) x.style.display = adminQ ? 'block' : 'none'; };

    if (adminTab === 'pending') {
      const body = (isAdmin ? `<h3 style="margin:4px 0 8px">${t('teacherReq')}</h3>` + (pendT.length ? pendT.map((p) => row(p, btn('p-ok', 'apT', p.id, 'approve') + btn('p-bad', 'del', p.id, 'del'))).join('') : `<div class="muted" style="margin-bottom:10px">${t('nothingPending')}</div>`) : '')
        + `<h3 style="margin:14px 0 8px">${t('enrollReq')}</h3>` + (pendE.length ? pendE.map((e) => { const p = byId[e.student_id]; const b = bm[e.batch_id];
          return row(p, btn('p-ok', 'apE', e.id, 'approve') + btn('p-bad', 'rjE', e.id, 'reject'), `<div class="muted">→ <b style="color:var(--ink)">${esc(b ? (b.subject || b.name) : '')}</b></div>`); }).join('') : `<div class="muted">${t('nothingPending')}</div>`);
      $app.innerHTML = head() + `<main>${bar}${body}${isAdmin ? pendApprovals({ batches, slots, byId, bm }) : ''}</main>${tabs('admin')}`;
    } else if (['batches', 'routine', 'classes'].includes(adminTab)) {
      await officeTab({ head, bar, isAdmin, people, byId, batches, slots, bm, enrolls });
    } else if (adminTab === 'faculty') {
      const cur = facEdit && facEdit !== 'new' ? faculty.find((f) => f.id === facEdit) : null;
      const sel = cur ? cur.classes || [] : [];
      const form = facEdit ? `<div class="card"><h3 style="margin-top:0">${cur ? t('fEdit') : t('addFac')}</h3>
        <label style="margin-top:0">${t('facName')}</label><input id="fn" value="${esc(cur ? cur.full_name : '')}">
        <label>${t('facSubject')}</label><input id="fs" list="subjList" value="${esc(cur ? cur.subject : '')}"><datalist id="subjList">${['গণিত', 'উচ্চতর গণিত', 'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'ইংরেজি', 'বাংলা', 'আইসিটি', 'সাধারণ বিজ্ঞান', 'বাংলাদেশ ও বিশ্বপরিচয়'].map((s) => `<option value="${s}">`).join('')}</datalist>
        <label>${t('facClasses')}</label><div>${CLASS_KEYS.map((c) => `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px 12px 4px 0;font-weight:600"><input type="checkbox" class="fc" value="${c}" ${sel.includes(c) ? 'checked' : ''} style="width:18px;height:18px">${clsKey(c)}</label>`).join('')}</div>
        <label>${t('facQual')}</label><input id="fq" placeholder="${esc(t('facQualPh'))}" value="${esc(cur ? cur.qualification || '' : '')}">
        <label>${t('facExp')}</label><input id="fe" placeholder="${esc(t('facExpPh'))}" value="${esc(cur ? cur.experience || '' : '')}">
        <label>${t('facPhoto')}</label><input id="fpic" type="file" accept="image/*">
        <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="fa" ${!cur || cur.active ? 'checked' : ''} style="width:18px;height:18px">${t('facShow')}</label>
        <div class="err" id="ferr"></div><div style="height:10px"></div>
        <div style="display:flex;gap:8px"><button class="btn" id="fsave" style="flex:1">${t('fSave')}</button><button class="btn" id="fcancel" style="flex:none;width:100px;background:#E3E8F3;color:var(--ink)">${t('fCancel')}</button></div></div>` : '';
      const list = faculty.length ? faculty.map((f) => `<div class="card" style="display:flex;gap:12px;align-items:center">${avatar(f, 44)}<div class="sp" style="min-width:0"><b>${esc(f.full_name)}</b>${f.active ? '' : ` <span class="pill p-warn">${t('hiddenW')}</span>`}<div class="muted">${esc(f.subject)} · ${(f.classes || []).map(clsKey).join(', ')}</div><div class="muted">${esc([f.qualification, f.experience].filter(Boolean).join(' · '))}</div></div><div style="flex:none">${btn('p-blue', 'fe', f.id, 'fEdit')}${btn('p-bad', 'fd', f.id, 'del')}</div></div>`).join('') : `<div class="muted">${t('noFac')}</div>`;
      $app.innerHTML = head() + `<main>${bar}${facEdit ? '' : `<button class="btn" id="fadd" style="margin-bottom:12px">＋ ${t('addFac')}</button>`}${form}${facEdit ? '' : list}</main>${tabs('admin')}`;
      const fadd = document.getElementById('fadd'); if (fadd) fadd.onclick = () => { facEdit = 'new'; adminScreen(); };
      const fcancel = document.getElementById('fcancel'); if (fcancel) fcancel.onclick = () => { facEdit = null; adminScreen(); };
      const fsave = document.getElementById('fsave');
      if (fsave) fsave.onclick = async () => {
        const err = document.getElementById('ferr'); err.textContent = '';
        const rec = { full_name: document.getElementById('fn').value.trim(), subject: document.getElementById('fs').value.trim(),
          classes: [...document.querySelectorAll('.fc:checked')].map((x) => x.value), qualification: document.getElementById('fq').value.trim() || null,
          experience: document.getElementById('fe').value.trim() || null, active: document.getElementById('fa').checked };
        if (!rec.full_name || !rec.subject) { err.textContent = t('facNeed'); return; }
        fsave.disabled = true;
        let id = cur ? cur.id : null; let e1;
        if (cur) e1 = (await sb.from('faculty').update(rec).eq('id', id)).error;
        else { const r = await sb.from('faculty').insert(rec).select('id').single(); e1 = r.error; id = r.data && r.data.id; }
        if (e1) { err.textContent = e1.message; fsave.disabled = false; return; }
        const pic = document.getElementById('fpic').files[0];
        if (pic && id) {
          try {
            const blob = await shrink(pic, 480); const path = `faculty/${id}.jpg`;
            const up = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
            if (!up.error) await sb.from('faculty').update({ photo_url: sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now() }).eq('id', id);
          } catch (e) {}
        }
        facEdit = null; adminScreen();
      };
    } else {
      $app.innerHTML = head() + `<main>${bar}${searchBox}<div id="alist"></div></main>${tabs('admin')}`;
      wireSearch(() => {
        const list = match(people.filter((p) => p.role === adminTab), ['full_name', 'student_code', 'phone', 'subject']);
        document.getElementById('alist').innerHTML = list.length ? list.map((p) => {
          let acts = '';
          if (isAdmin) {
            if (p.role === 'teacher' && !p.approved) acts += btn('p-ok', 'apT', p.id, 'approve');
            if (p.role !== 'assistant' && p.role !== 'teacher') acts += btn('p-blue', 'mkA', p.id, 'mkA');
            acts += btn('p-bad', 'del', p.id, 'del');
          }
          return row(p, acts, enrInfo(p));
        }).join('') : `<div class="muted">${t('noUsers')}</div>`;
        showX();
      });
    }
    window.__admTab = (k) => { adminTab = k; adminQ = ''; facEdit = null; batchEdit = null; slotEdit = null; adminScreen(); };
    window.__adm = async (act, id) => {
      let err = null;
      if (act === 'apT') err = (await sb.from('profiles').update({ approved: true }).eq('id', id)).error;
      else if (act === 'apE') err = (await sb.from('enrollments').update({ status: 'approved' }).eq('id', id)).error;
      else if (act === 'rjE') err = (await sb.from('enrollments').update({ status: 'rejected' }).eq('id', id)).error;
      else if (act === 'mkA') { if (!confirm(t('mkAConfirm'))) return; err = (await sb.from('profiles').update({ role: 'assistant', approved: true }).eq('id', id)).error; }
      else if (act === 'del') { if (!confirm(t('delConfirm'))) return; err = (await sb.rpc('admin_delete_user', { uid: id })).error; }
      else if (act === 'fe') { facEdit = id; adminScreen(); return; }
      else if (act === 'fd') { if (!confirm(t('delFacConfirm'))) return; err = (await sb.from('faculty').delete().eq('id', id)).error; }
      if (err) { alert(err.message || t('err')); return; }
      adminScreen();
    };
  }

  function pendingScreen() {
    $app.innerHTML = `${top(t('pendT'), me.full_name)}<main><div class="card"><div style="text-align:center;padding:8px 0">${avatar(me, 72).replace('<div style="flex:none">', '<div style="display:inline-block">')}<h3 style="margin:12px 0 6px">${t('pendH')}</h3><div class="muted">${t('pendMsg')}</div></div></div>
      <button class="btn" id="rf">${t('recheck')}</button><div style="height:10px"></div><a href="#/logout" style="display:block;text-align:center;color:var(--blue);font-weight:600;text-decoration:none">${t('logout')}</a></main>`;
    document.getElementById('rf').onclick = async () => { await boot(); render(); };
  }

  let bClass = null;
  async function batchesScreen() {
    $app.innerHTML = top(t('batchesT'), '') + `<main>${t('loading')}</main>${tabs('batches')}`;
    const [b, en, sch] = await Promise.all([sb.from('batches').select('*').eq('status', 'active').order('created_at'), sb.from('enrollments').select('*').eq('student_id', me.id), sb.rpc('batch_schedule')]);
    const em = Object.fromEntries((en.data || []).map((e) => [e.batch_id, e]));
    const sched = {}; ((sch && sch.data) || []).forEach((r) => { (sched[r.batch_id] = sched[r.batch_id] || []).push(r); });
    const schedTxt = (id) => (sched[id] || []).slice().sort((x, y) => DAY_ORDER.indexOf(+x.day) - DAY_ORDER.indexOf(+y.day) || toMin(x.start_time) - toMin(y.start_time)).map((r) => `${dayName(r.day)} ${fmtT(r.start_time)}`).join(', ');
    const all = (b.data || []).filter((x) => x.is_open || em[x.id]);
    const forMe = all.filter((x) => !x.class_level || x.class_level === me.class_level || em[x.id]);
    const act = (x) => { const e = em[x.id];
      if (!e) return me.role === 'student' ? `<button class="btn" style="height:42px;font-size:15px" onclick="__join('${x.id}')">${t('reqJoin')}</button>` : '';
      if (e.status === 'pending') return `<span class="pill p-warn">${t('pendingApproval')}</span>`;
      if (e.status === 'approved') return `<span class="pill p-ok">${t('enrolled')}</span>`;
      return `<span class="pill p-bad">${t('rejected')}</span>`; };
    const card = (x) => `<div class="card"><div class="row"><div class="sp"><b style="font-size:16px">${esc(x.subject || x.name)}</b><div class="muted">${esc(x.name)}${x.class_level ? ' · ' + clsName(x.class_level) : ''}</div></div><button class="pill p-blue" style="border:0;cursor:pointer;font-family:inherit" onclick="__share('${x.id}')">${t('share')}</button></div>
      ${x.description ? `<div class="muted" style="margin:8px 0">${esc(x.description)}</div>` : ''}${schedTxt(x.id) ? `<div class="muted">${t('schedLbl')}: <b style="color:var(--ink)">${esc(schedTxt(x.id))}</b></div>` : ''}${x.fee ? `<div class="muted">${t('monthly')}: <b style="color:var(--ink)">৳ ${num(x.fee)}</b></div>` : ''}<div style="margin-top:10px">${act(x)}</div></div>`;
    const chips = CLASS_KEYS.map((k) => `<button onclick="__bc('${k}')" style="flex:none;border:0;border-radius:999px;padding:8px 14px;font:700 13px inherit;font-family:inherit;cursor:pointer;${bClass === k ? 'background:var(--blue);color:#fff' : (me.class_level === k ? 'background:#DCE8FF;color:var(--blue)' : 'background:#E3E8F3;color:var(--ink)')}">${clsName(k)}</button>`).join('');
    const other = bClass ? all.filter((x) => x.class_level === bClass) : [];
    $app.innerHTML = top(t('batchesT'), '') + `<main>
      <h3 style="margin:4px 0 8px">${t('forYou')}</h3>${forMe.length ? forMe.map(card).join('') : `<div class="muted">${t('noBatch')}</div>`}
      <h3 style="margin:16px 0 8px">${t('allClassBatches')}</h3><div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px">${chips}</div>
      ${bClass ? (other.length ? other.map(card).join('') : `<div class="muted">${t('noBatch')}</div>`) : ''}</main>${tabs('batches')}`;
    window.__bc = (k) => { bClass = bClass === k ? null : k; batchesScreen(); };
    window.__join = async (id) => { const { error } = await sb.from('enrollments').insert({ student_id: me.id, batch_id: id }); if (error && error.code !== '23505') { alert(t('err')); return; } batchesScreen(); };
    window.__share = async (id) => {
      const x = all.find((y) => y.id === id); if (!x) return;
      const text = `${x.subject || x.name}${x.class_level ? ' (' + clsName(x.class_level) + ')' : ''}${x.fee ? ' · ৳' + num(x.fee) : ''}${schedTxt(id) ? ' · ' + schedTxt(id) : ''}\n${t('brandLine')}`;
      try { if (navigator.share) { await navigator.share({ title: t('brandLine'), text, url: location.origin }); return; } await navigator.clipboard.writeText(text + '\n' + location.origin); alert(t('copied')); } catch (e) {}
    };
  }

  // ---------- Router ----------
  async function boot() {
    const { data } = await sb.auth.getSession();
    if (!data.session) { me = null; return; }
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
    window.__bootErr = error ? (error.message || String(error)) : (p ? '' : 'NO_PROFILE_ROW');
    me = p;
    try { const k = new Date().toISOString().slice(0, 10); if (p && localStorage.getItem('amb_gen') !== k) { sb.rpc('generate_classes', { weeks: 4 }).then((r) => { if (!r.error) localStorage.setItem('amb_gen', k); }); } } catch (e) {}
    try { if (p && (p.lang === 'bn' || p.lang === 'en') && !localStorage.getItem('amb_lang')) lang = p.lang; } catch (e) {}
  }
  async function render() {
    const h = location.hash.replace(/^#\/?/, '') || 'splash'; const [r, id] = h.split('/');
    document.documentElement.lang = lang;
    try {
      if (r === 'logout') { await sb.auth.signOut(); me = null; location.hash = '#/splash'; return; }
      if (r === 'splash') return splash();
      if (r === 'login') return login();
      if (r === 'signup') return signup();
      if (r === 'reset') return resetScreen();
      if (!me) { location.hash = '#/login'; return; }
      if (me.role === 'teacher' && !me.approved) return pendingScreen();
      if (r === 'admin') { if (me.role !== 'admin' && me.role !== 'assistant') { location.hash = '#/home'; return; } return await adminScreen(); }
      if (r === 'home' && (me.role === 'admin' || me.role === 'assistant')) { location.hash = '#/admin'; return; }
      if (r === 'home' && me.role === 'teacher') { location.hash = '#/mine'; return; }
      if (r === 'mine') return await mineScreen();
      if (r === 'faculty') return await facultyScreen();
      if (r === 'home') return await home();
      if (r === 'classes') return await classesScreen();
      if (r === 'hw') return await hwList();
      if (r === 'batches') return await batchesScreen();
      if (r === 'submit') return await submitScreen(id);
      if (r === 'result') return await result(id);
      location.hash = '#/home';
    } catch (e) { $app.innerHTML = `<main><div class="card">${t('err')}</div></main>`; console.error(e); }
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') location.hash = '#/reset'; });
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', (e) => { if (e.key === 'amb_lang' && (e.newValue === 'bn' || e.newValue === 'en')) { lang = e.newValue; render(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  boot().then(render);
})();
