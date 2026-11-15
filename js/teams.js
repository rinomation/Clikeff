/* Clikeff — משחק קבוצות: שמות לבחירה, חלוקה מאוזנת וניקוד קבוצתי (ממוצע לחבר) */
(function (A) {
  'use strict';
  const T = (A.Teams = {});

  /* רשימות שמות מוכנות. ברירת המחדל: אבני החושן */
  T.SETS = [
    { id: 'gems', label: 'אבני החושן', names: ['אודם', 'ספיר', 'ברקת', 'יהלום'] },
    { id: 'tribes', label: 'שבטי ישראל', names: ['יהודה', 'לוי', 'יששכר', 'זבולון'] },
    { id: 'shapes', label: 'צורות', names: ['המשולשים', 'המעוינים', 'העיגולים', 'הריבועים'] },
    { id: 'colors', label: 'צבעים', names: ['האדומים', 'הכחולים', 'הירוקים', 'הצהובים'] },
    { id: 'light', label: 'אור', names: ['הניצוצות', 'הלהבות', 'הכוכבים', 'הברקים'] },
    { id: 'custom', label: 'שמות משלי', names: [] }
  ];
  T.DEFAULT = 'gems';
  T.MAX_NAME = 16;
  const COLORS = {
    gems: ['#ff4d5e', '#3d7bff', '#14c49a', '#2ec5e6'],
    shapes: ['#ff4d5e', '#3d7bff', '#ffb020', '#14c49a'],
    other: ['#ff4d5e', '#3d7bff', '#14c49a', '#ffb020']
  };
  const set = (id) => T.SETS.find((s) => s.id === id) || T.SETS[0];
  const defaults = () => set(T.DEFAULT).names;

  /** השמות שייכנסו לחדר, לפי ההגדרות של המנחה */
  T.names = (cfg) => {
    const s = set(cfg && cfg.teamSet);
    if (s.id !== 'custom') return s.names.slice();
    const own = (cfg && cfg.teamNames) || [];
    return [0, 1, 2, 3].map((i) => T.clean(own[i]) || defaults()[i]);
  };
  T.clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, T.MAX_NAME);

  /* ---------- ציורים קטנים לכל קבוצה (בלי קבצים) ---------- */
  const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + svg + '</svg>');
  const gem = (c) => svgUrl(
    '<path d="M15 9h34l13 16-30 33L2 25z" fill="' + c + '"/>' +
    '<path d="M15 9h34l-7 16H22z" fill="#fff" fill-opacity=".32"/>' +
    '<path d="M2 25h60M22 25l10 33 10-33M15 9l7 16M49 9l-7 16" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M15 9h34l13 16-30 33L2 25z" fill="none" stroke="#06142b" stroke-opacity=".35" stroke-width="2" stroke-linejoin="round"/>');
  const SHAPES = ['<path d="M32 13 L51 47 H13z"/>', '<path d="M32 11 L53 32 L32 53 L11 32z"/>', '<circle cx="32" cy="32" r="18"/>', '<rect x="15" y="15" width="34" height="34" rx="5"/>'];
  const shape = (c, i) => svgUrl('<rect width="64" height="64" rx="16" fill="' + c + '"/><g fill="#fff">' + SHAPES[i % 4] + '</g>');
  const letter = (c, ch) => svgUrl('<circle cx="32" cy="32" r="30" fill="' + c + '"/>' +
    '<text x="32" y="44" text-anchor="middle" font-family="Rubik, Arial, sans-serif" font-weight="800" font-size="32" fill="#fff">' +
    String(ch).replace(/[<&>"]/g, '') + '</text>');
  const cache = {};

  /** קבוצה מספר i בחדר: { name, color, pic } */
  T.get = (i, room) => {
    i = Number(i) || 0;
    const kind = (room && room.teamSet) || T.DEFAULT;
    const names = (room && room.teamNames) || defaults();
    const name = T.clean(names[i]) || defaults()[i] || 'קבוצה ' + (i + 1);
    const color = (COLORS[kind] || COLORS.other)[i % 4];
    const key = kind + '|' + i + '|' + name;
    if (!cache[key]) {
      if (kind === 'gems') cache[key] = gem(color);
      else if (kind === 'shapes') cache[key] = shape(color, i);
      else cache[key] = letter(color, (kind !== 'custom' && name.length > 3 && name[0] === 'ה' ? name[1] : name[0]) || '?');
    }
    return { i, name, color, pic: cache[key] };
  };

  /** משבץ משתתפים חדשים לקבוצה הקטנה ביותר. מחזיר מפה חדשה, או null אם אין שינוי */
  T.assign = (room, players) => {
    const n = room.teamCount || 0;
    if (!n) return null;
    const map = Object.assign({}, room.teams || {});
    const sizes = new Array(n).fill(0);
    const ids = new Set(players.map((p) => p.id));
    Object.keys(map).forEach((id) => { if (ids.has(id) && map[id] < n) sizes[map[id]]++; });
    let changed = false;
    players.forEach((p) => {
      if (map[p.id] != null && map[p.id] < n) return;
      let best = 0;
      for (let t = 1; t < n; t++) if (sizes[t] < sizes[best]) best = t;
      map[p.id] = best; sizes[best]++; changed = true;
    });
    return changed ? map : null;
  };

  /** ניקוד קבוצות: list = [{id, score}] → [{i, name, pic, color, avg, count}] ממוין */
  T.scores = (room, list) => {
    const n = room.teamCount || 0;
    const out = [];
    for (let t = 0; t < n; t++) out.push(Object.assign({ sum: 0, count: 0 }, T.get(t, room)));
    list.forEach((p) => {
      const t = (room.teams || {})[p.id];
      if (t == null || !out[t]) return;
      out[t].sum += p.score || 0; out[t].count++;
    });
    out.forEach((x) => { x.avg = x.count ? Math.round(x.sum / x.count) : 0; });
    return out.sort((a, b) => b.avg - a.avg);
  };

  /** פס קבוצות לתצוגה במקרן */
  T.bars = (teams) => {
    const max = Math.max(1, ...teams.map((t) => t.avg));
    return '<div class="team-bars">' + teams.map((t, k) =>
      '<div class="team-bar' + (k === 0 && t.avg > 0 ? ' lead' : '') + '" style="--c:' + t.color + '">' +
      '<img src="' + t.pic + '" alt="">' +
      '<span class="tb-name">' + A.esc(t.name) + ' <small>(' + t.count + ')</small></span>' +
      '<span class="tb-track"><i style="width:' + Math.round(t.avg / max * 100) + '%"></i></span>' +
      '<b class="tb-pts">' + A.fmt(t.avg) + '</b></div>').join('') + '</div>';
  };
})(window.App);
