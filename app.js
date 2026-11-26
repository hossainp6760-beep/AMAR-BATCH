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

  const tabs = (on) => `<nav>${[['home', '⌂', 'home'], ['classes', '▶', 'classes'], ['hw', '✎', 'hw'], ['batches', '☰', 'batches']].map(([r, i, k]) => `<a href="#/${r}" class="${on === r ? 'on' : ''}"><b>${i}</b>${t(k)}</a>`).join('')}<a href="#/logout"><b>⎋</b>${t('logout')}</a></nav>`;
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
      ${me.fee_due ? `<div class="card" style="background:#FDF0DC;border-color:#F3D9A8"><b style="color:#7A3A06">${t('feeDue')}</b></div>` : ''}
      <div class="card"><h3>${t('liveNow')}</h3>${(cl.data || []).length ? cl.data.map((c) => `<div class="row" style="margin:8px 0"><div class="sp"><b>${esc(c.title)}</b><div class="muted">${fmt(c.starts_at, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' })} · ${esc(c.teacher_name || '')}</div></div>${c.meet_url ? `<a class="pill p-blue" style="text-decoration:none" href="${esc(c.meet_url)}" target="_blank" rel="noopener">${t('join')}</a>` : ''}</div>`).join('') : `<div class="muted">${t('noClass')}</div>`}</div>
      <div class="card"><h3>${t('due')}</h3>${pend.length ? pend.map((h) => `<a href="#/submit/${h.id}" style="text-decoration:none;color:inherit;display:flex;justify-content:space-between;margin:8px 0"><div><b>${esc(h.title)}</b><div class="muted">${esc(h.subject || '')} · ${fmt(h.due_at)}</div></div><span class="pill p-warn">${t('pending')}</span></a>`).join('') : `<div class="muted">${t('noHw')}</div>`}</div></main>${tabs('home')}`;
    const avin = document.getElementById('avin');
    if (avin) avin.onchange = async () => { if (!avin.files[0]) return; const ok = await uploadAvatar(me.id, avin.files[0]); if (ok) { await boot(); home(); } else alert(t('err')); };
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
    const v = { nm: keep('nm'), ph: keep('ph'), em: keep('em'), sj: keep('sj'), sc: keep('sc') };
    const clsOpts = ['5','6','7','8','9','10','11','12','admission'].map((c) => `<option value="${c}">${c === 'admission' ? t('admissionOpt') : t('classWord') + ' ' + num(c)}</option>`).join('');
    $app.innerHTML = `${top(t('createAcc'), t('signupSub'))}<main><div class="card">
      <div style="display:flex;gap:4px;background:var(--soft);border-radius:14px;padding:4px;margin-bottom:6px">${chip('student', 'roleStudent')}${chip('teacher', 'roleTeacher')}${chip('parent', 'roleParent')}</div>
      <label>${t('fullName')}</label><input id="nm" autocomplete="name" value="${v.nm}">
      <label>${t('phone')}</label><input id="ph" type="tel" inputmode="numeric" placeholder="${esc(t('phonePh'))}" autocomplete="tel" value="${v.ph}">
      ${signRole === 'student' ? `<label>${t('classLbl')}</label><select id="cl"><option value="">${t('classPick')}</option>${clsOpts}</select>` : ''}
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
      const pic = document.getElementById('pic').files[0];
      if (!nm) { err.textContent = t('nameNeed'); return; }
      if (!/^01\d{9}$/.test(ph)) { err.textContent = t('phoneBad'); return; }
      if (signRole === 'teacher' && !sj) { err.textContent = t('subjectNeed'); return; }
      if (signRole === 'student' && !cl) { err.textContent = t('classNeed'); return; }
      if (pw.length < 6) { err.textContent = t('pwShort'); return; }
      const btn = document.getElementById('go'); btn.disabled = true;
      if (signRole === 'parent') {
        if (!sc) { err.textContent = t('childIdNeed'); btn.disabled = false; return; }
        const { data: ok } = await sb.rpc('student_exists', { code: sc });
        if (!ok) { err.textContent = t('childIdBad'); btn.disabled = false; return; }
      }
      const { data, error } = await sb.auth.signUp({ email: em || `${ph}@${cfg.EMAIL_DOMAIN}`, password: pw, options: { data: { full_name: nm, phone: ph, lang, role: signRole, subject: sj, class_level: cl } } });
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

  function pendingScreen() {
    $app.innerHTML = `${top(t('pendT'), me.full_name)}<main><div class="card"><div style="text-align:center;padding:8px 0">${avatar(me, 72).replace('<div style="flex:none">', '<div style="display:inline-block">')}<h3 style="margin:12px 0 6px">${t('pendH')}</h3><div class="muted">${t('pendMsg')}</div></div></div>
      <button class="btn" id="rf">${t('recheck')}</button><div style="height:10px"></div><a href="#/logout" style="display:block;text-align:center;color:var(--blue);font-weight:600;text-decoration:none">${t('logout')}</a></main>`;
    document.getElementById('rf').onclick = async () => { await boot(); render(); };
  }

  async function batchesScreen() {
    $app.innerHTML = top(t('batchesT'), '') + `<main>${t('loading')}</main>${tabs('batches')}`;
    const [b, en] = await Promise.all([sb.from('batches').select('*').order('created_at'), sb.from('enrollments').select('*').eq('student_id', me.id)]);
    const em = Object.fromEntries((en.data || []).map((e) => [e.batch_id, e]));
    const list = (b.data || []).filter((x) => x.is_open || em[x.id]);
    const act = (x) => { const e = em[x.id];
      if (!e) return `<button class="btn" style="height:42px;font-size:15px" onclick="__join('${x.id}')">${t('reqJoin')}</button>`;
      if (e.status === 'pending') return `<span class="pill p-warn">${t('pendingApproval')}</span>`;
      if (e.status === 'approved') return `<span class="pill p-ok">${t('enrolled')}</span>`;
      return `<span class="pill p-bad">${t('rejected')}</span>`; };
    $app.innerHTML = top(t('batchesT'), '') + `<main>${list.length ? list.map((x) => `<div class="card"><div class="row"><div class="sp"><b style="font-size:16px">${esc(x.subject || x.name)}</b><div class="muted">${esc(x.name)}${x.teacher_name ? ' · ' + esc(x.teacher_name) : ''}</div></div></div>
      ${x.description ? `<div class="muted" style="margin:8px 0">${esc(x.description)}</div>` : ''}${x.fee ? `<div class="muted">${t('monthly')}: <b style="color:var(--ink)">৳ ${num(x.fee)}</b></div>` : ''}<div style="margin-top:10px">${act(x)}</div></div>`).join('') : `<div class="muted">${t('noBatch')}</div>`}</main>${tabs('batches')}`;
    window.__join = async (id) => { const { error } = await sb.from('enrollments').insert({ student_id: me.id, batch_id: id }); if (error && error.code !== '23505') { alert(t('err')); return; } batchesScreen(); };
  }

  // ---------- Router ----------
  async function boot() {
    const { data } = await sb.auth.getSession();
    if (!data.session) { me = null; return; }
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
    window.__bootErr = error ? (error.message || String(error)) : (p ? '' : 'NO_PROFILE_ROW');
    me = p; try { if (p && (p.lang === 'bn' || p.lang === 'en') && !localStorage.getItem('amb_lang')) lang = p.lang; } catch (e) {}
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
