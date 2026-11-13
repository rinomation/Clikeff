/* Clikeff — משחק קבוצות: חלוקה מאוזנת וניקוד קבוצתי (ממוצע לחבר) */
(function (A) {
  'use strict';
  const T = (A.Teams = {});

  T.LIST = [
    { name: 'האריות', img: 'lion', color: 'var(--a6)' },
    { name: 'הדולפינים', img: 'dolphin', color: 'var(--a2)' },
    { name: 'הדבורים', img: 'honeybee', color: 'var(--a3)' },
    { name: 'הינשופים', img: 'owl', color: 'var(--a4)' }
  ];
  T.get = (i) => T.LIST[i] || T.LIST[0];

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

  /** ניקוד קבוצות: list = [{id, score}] → [{i, name, img, color, avg, count}] ממוין */
  T.scores = (room, list) => {
    const n = room.teamCount || 0;
    const out = [];
    for (let t = 0; t < n; t++) out.push(Object.assign({ i: t, sum: 0, count: 0 }, T.get(t)));
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
      '<img src="' + A.img(t.img) + '" alt="">' +
      '<span class="tb-name">' + A.esc(t.name) + ' <small>(' + t.count + ')</small></span>' +
      '<span class="tb-track"><i style="width:' + Math.round(t.avg / max * 100) + '%"></i></span>' +
      '<b class="tb-pts">' + A.fmt(t.avg) + '</b></div>').join('') + '</div>';
  };
})(window.App);
