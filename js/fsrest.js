/* קליקרים — לקוח Firestore דרך REST (עובד גם כשהחיבור החי חסום, למשל בנטפרי) */
(function (A) {
  'use strict';
  const R = (A.FsRest = {});

  /* המרה מ-JS לפורמט Firestore */
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (v === R.NOW) return { timestampValue: new Date().toISOString() };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    const fields = {};
    Object.keys(v).forEach((k) => { fields[k] = enc(v[k]); });
    return { mapValue: { fields } };
  }

  /* המרה מ-Firestore ל-JS */
  function dec(v) {
    if (!v) return null;
    if ('nullValue' in v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('stringValue' in v) return v.stringValue;
    if ('timestampValue' in v) return { ms: Date.parse(v.timestampValue), toMillis() { return this.ms; } };
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
    if ('mapValue' in v) return decFields(v.mapValue.fields || {});
    return null;
  }
  function decFields(f) {
    const o = {};
    Object.keys(f || {}).forEach((k) => { o[k] = dec(f[k]); });
    return o;
  }
  R.enc = enc; R.dec = dec; R.decFields = decFields;
  R.NOW = { __now: true }; /* חותמת זמן של השרת */
  R.inc = (n) => ({ __inc: n }); /* הוספה למספר בשרת */

  let ROOT = '', DOCS = '';
  R.init = (projectId) => {
    DOCS = 'projects/' + projectId + '/databases/(default)/documents';
    ROOT = 'https://firestore.googleapis.com/v1/' + DOCS;
  };

  async function call(method, url, body) {
    const token = await firebase.auth().currentUser.getIdToken();
    const res = await fetch(url, {
      method,
      headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 404) return null;
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      const st = (data.error && data.error.status) || '';
      const e = new Error(st || 'HTTP ' + res.status);
      e.code = st === 'PERMISSION_DENIED' ? 'permission-denied' : st === 'ALREADY_EXISTS' ? 'already-exists'
        : st === 'FAILED_PRECONDITION' ? 'failed-precondition' : res.status >= 500 || res.status === 418 ? 'unavailable' : st;
      throw e;
    }
    return data;
  }

  R.get = async (path) => {
    const d = await call('GET', ROOT + '/' + path);
    return d ? decFields(d.fields) : null;
  };

  /** כתיבה: data עם R.NOW הופך לחותמת זמן של השרת.
      opts: { merge: true } מעדכן רק את השדות שנשלחו; { mustExist / mustNotExist } תנאי קיום */
  function writeOf(path, data, opts) {
    opts = opts || {};
    const fields = {}, transforms = [], mask = [];
    Object.keys(data).forEach((k) => {
      if (data[k] === R.NOW) transforms.push({ fieldPath: k, setToServerValue: 'REQUEST_TIME' });
      else if (data[k] && data[k].__inc) transforms.push({ fieldPath: k, increment: { integerValue: String(data[k].__inc) } });
      else { fields[k] = enc(data[k]); mask.push(k); }
    });
    const w = { update: { name: DOCS + '/' + path, fields } };
    if (opts.merge) w.updateMask = { fieldPaths: mask.map((m) => '`' + m + '`') };
    if (transforms.length) w.updateTransforms = transforms;
    if (opts.mustExist) w.currentDocument = { exists: true };
    if (opts.mustNotExist) w.currentDocument = { exists: false };
    return w;
  }
  R.writeOf = writeOf;
  R.delOf = (path) => ({ delete: DOCS + '/' + path });

  /** כמה כתיבות יחד, הכול או כלום */
  R.commit = (writes) => call('POST', ROOT + ':commit', { writes });
  R.set = (path, data, opts) => R.commit([writeOf(path, data, opts)]);
  R.del = (path) => R.commit([R.delOf(path)]);

  /** כל המסמכים באוסף (עד 300) */
  R.list = async (coll) => {
    const d = await call('GET', ROOT + '/' + coll + '?pageSize=300');
    return ((d && d.documents) || []).map((doc) => Object.assign({ id: doc.name.split('/').pop() }, decFields(doc.fields)));
  };

  /** שאילתה על תת-אוסף: parent = 'rooms/123456', coll = 'players', since = מילישניות */
  R.query = async (parent, coll, since) => {
    const q = { from: [{ collectionId: coll }] };
    if (since) {
      q.where = { fieldFilter: { field: { fieldPath: 'lastSeen' }, op: 'GREATER_THAN', value: { timestampValue: new Date(since).toISOString() } } };
    }
    const rows = await call('POST', ROOT + '/' + parent + ':runQuery', { structuredQuery: q });
    return (rows || []).filter((r) => r.document).map((r) => Object.assign(
      { id: r.document.name.split('/').pop() }, decFields(r.document.fields)));
  };
})(window.App);
