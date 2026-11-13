/* =========================================================
   קליקרים — קריאת קובץ שאלות מאקסל, תבנית ריקה וייצוא תוצאות
   נאמנות למקור: שורה בעייתית לא מתוקנת — מסומנת ונשארת בחוץ.
   ========================================================= */
(function (A) {
  'use strict';

  const X = (A.Excel = {});
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  let loading = null;

  X.load = () => {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!loading) {
      loading = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = SHEETJS;
        s.onload = () => res(window.XLSX);
        s.onerror = () => { loading = null; rej(new Error('טעינת רכיב האקסל נכשלה. בדקו את החיבור לאינטרנט.')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  };

  const clean = (v) => {
    if (v == null) return '';
    if (v instanceof Date) return v.toLocaleDateString('he-IL');
    return String(v).replace(/\s+/g, ' ').trim();
  };

  /** מזהה את העמודות לפי הכותרות */
  function mapColumns(header) {
    const h = header.map(clean);
    let typeCol = h.findIndex((x) => x.includes('סוג'));
    let correctCol = h.findIndex((x, i) => i !== typeCol && (x.includes('נכונ') || /מס.?\s*התשובה/.test(x)));
    const limit = typeCol >= 0 ? typeCol : h.length;
    let answerCols = [];
    h.forEach((x, i) => { if (i < limit && i !== correctCol && /תשובה\s*\d+/.test(x)) answerCols.push(i); });
    let questionCol = h.findIndex((x, i) => i !== typeCol && i !== correctCol && answerCols.indexOf(i) < 0 && x.includes('שאלה'));

    /* גיבוי לפי מיקום: A שאלה, B נכונה, C..(לפני סוג) תשובות */
    if (questionCol < 0) questionCol = 0;
    if (correctCol < 0) correctCol = 1;
    if (!answerCols.length) for (let i = 2; i < limit; i++) answerCols.push(i);
    return { questionCol, correctCol, answerCols, typeCol };
  }

  /** בודק שורה אחת ומחזיר אותה בפורמט התצוגה המקדימה */
  function checkRow(cells, cols, rowNum) {
    const text = clean(cells[cols.questionCol]);
    const rawType = cols.typeCol >= 0 ? clean(cells[cols.typeCol]) : '';
    const type = rawType === 'שאלה' ? 'question' : rawType === 'סקר' ? 'survey' : null;
    const all = cols.answerCols.map((c) => clean(cells[c]));
    let last = all.length - 1;
    while (last >= 0 && all[last] === '') last--;
    const answers = all.slice(0, last + 1);
    const rawCorrect = clean(cells[cols.correctCol]);

    const r = { row: rowNum, type, text, answers, correct: null, valid: false, reason: '' };
    const n = Number(rawCorrect);
    if (type === 'question' && rawCorrect !== '' && Number.isInteger(n)) r.correct = n - 1;

    if (!text) r.reason = 'חסר טקסט שאלה';
    else if (!type) r.reason = rawType ? 'סוג לא מזוהה: "' + rawType + '" (צריך "שאלה" או "סקר")' : 'חסר סוג (שאלה או סקר)';
    else if (answers.indexOf('') >= 0) r.reason = 'תשובה ' + (answers.indexOf('') + 1) + ' ריקה באמצע';
    else if (answers.length < 2) r.reason = 'צריך לפחות שתי תשובות';
    else if (type === 'question') {
      if (rawCorrect === '') r.reason = 'חסר מספר התשובה הנכונה';
      else if (!Number.isInteger(n)) r.reason = 'מספר התשובה הנכונה אינו מספר שלם: "' + rawCorrect + '"';
      else if (n < 1 || n > answers.length) r.reason = 'מספר התשובה הנכונה (' + rawCorrect + ') צריך להיות בין 1 ל-' + answers.length;
    }
    r.valid = !r.reason;
    return r;
  }

  /** קורא קובץ ומחזיר { fileName, title, rows } */
  X.parse = async (file) => {
    const XLSX = await X.load();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('הקובץ ריק');
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
    if (!grid.length) throw new Error('הקובץ ריק');
    const cols = mapColumns(grid[0]);
    const used = [cols.questionCol, cols.correctCol, cols.typeCol].concat(cols.answerCols).filter((c) => c >= 0);
    const rows = [];
    for (let i = 1; i < grid.length; i++) {
      const cells = grid[i] || [];
      if (used.every((c) => clean(cells[c]) === '')) continue; /* שורה ריקה לחלוטין */
      rows.push(checkRow(cells, cols, i + 1));
    }
    if (!rows.length) throw new Error('לא נמצאו שורות בקובץ');
    return { fileName: file.name, title: file.name.replace(/\.[^.]+$/, ''), rows };
  };

  /** ממיר שורות תקינות לפורמט המשחק, בסדר הקובץ */
  X.toItems = (rows) => rows.filter((r) => r.valid).map((r) =>
    r.type === 'survey' ? { k: 's', t: r.text, a: r.answers } : { k: 'q', t: r.text, a: r.answers, c: r.correct });

  /** ממיר פריטים שמורים חזרה לשורות תצוגה (לצפייה) */
  X.fromItems = (items) => items.map((it, i) => ({
    row: i + 1, type: it.k === 's' ? 'survey' : 'question', text: it.t, answers: it.a,
    correct: it.k === 's' ? null : it.c, valid: true
  }));

  function download(XLSX, wb, name) {
    XLSX.writeFile(wb, name, { compression: true });
  }

  X.template = async () => {
    const XLSX = await X.load();
    const data = [
      ['השאלה', "מס' התשובה הנכונה", 'תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4', 'סוג- שאלה\\סקר'],
      ['מי בנה את התיבה?', 1, 'נח', 'משה', 'אברהם', 'יונה', 'שאלה'],
      ['כמה ימים נמשך חג החנוכה?', 3, 'שישה', 'שבעה', 'שמונה', '', 'שאלה'],
      ['איזה חג הכי אהוב עליכם?', '', 'חנוכה', 'פורים', 'פסח', 'סוכות', 'סקר']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    ws['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'שאלות');
    download(XLSX, wb, 'תבנית שאלות - Clikeff.xlsx');
  };

  /** ייצוא דירוג: players ממוינים */
  X.exportResults = async (players, total, code) => {
    const XLSX = await X.load();
    const data = [['מקום', 'שם', 'ניקוד', 'שאלות שנסגרו', 'מתוך', 'סיים']].concat(
      players.map((p, i) => [i + 1, p.name, p.score, p.answered, total, p.finished ? 'כן' : 'לא']));
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 7 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'דירוג');
    const d = new Date();
    download(XLSX, wb, 'תוצאות ' + code + ' ' + d.toLocaleDateString('he-IL').replace(/\./g, '-') + '.xlsx');
  };
})(window.App);
