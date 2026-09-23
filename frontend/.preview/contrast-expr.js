(() => {
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const parse = (s) => { const m = s.match(/[0-9.]+/g); return m ? m.slice(0, 3).map(Number).concat(m[3] === undefined ? 1 : Number(m[3])) : null; };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0.6) return c;
      n = n.parentElement;
    }
    return [250, 247, 242, 1];
  };
  const seen = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length && [...el.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.opacity === '0') continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.disabled || el.closest('[disabled]')) continue;
    const fg = parse(st.color); if (!fg) continue;
    const bgImg = st.backgroundImage !== 'none';
    let n = el, overPhoto = false;
    while (n && n !== document.body) { if (getComputedStyle(n).backgroundImage !== 'none' || n.querySelector(':scope > img')) { overPhoto = true; break; } n = n.parentElement; }
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(st.fontSize);
    const bold = parseInt(st.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio < need - 0.01) seen.push({ t: text.slice(0, 34), cls: (el.className.toString().split(' ')[0] || el.tagName.toLowerCase()), px: Math.round(size), fg: st.color, bg: 'rgb(' + bg.slice(0,3).join(',') + ')', r: Math.round(ratio * 100) / 100, need, overPhoto });
  }
  const uniq = []; const keys = new Set();
  for (const s of seen) { const k = s.cls + s.r; if (!keys.has(k)) { keys.add(k); uniq.push(s); } }
  return JSON.stringify(uniq.slice(0, 30), null, 1);
})()
