// SPDX-License-Identifier: Apache-2.0
// The browser check's cycle (completion plan C5, C12), evaluated in the page by drive.mjs: it clicks through the
// manager's own buttons and dialogs, opens the public test library, edits it, makes a key (the crypto self-test runs
// first), downloads the key file and the signed library, reopens it signed, forgets the key, reloads it, and checks
// storage and the CSP. A test hook stands in for the file picker and catches downloads from their blob: URL, so
// nothing is written to disk. It returns a JSON report; drive.mjs then presses a real F1 in the title field.
(async () => {
  const R = { steps: [], violations: [], ok: true };
  const step = (name, ok, detail) => { R.steps.push({ name, ok: Boolean(ok), detail: detail === undefined ? '' : String(detail).slice(0, 200) }); if (!ok) R.ok = false; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(100); } return null; };
  document.addEventListener('securitypolicyviolation', (e) => R.violations.push(`${e.violatedDirective} ${e.blockedURI}`));
  // file picker: the next File; downloads: the Blob given to URL.createObjectURL, by name
  let nextFile = null;
  const origClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === 'file' && nextFile) { const dt = new DataTransfer(); dt.items.add(nextFile); this.files = dt.files; nextFile = null; this.dispatchEvent(new Event('change')); return; }
    return origClick.call(this);
  };
  const blobs = new Map();
  const origURL = URL.createObjectURL;
  URL.createObjectURL = function (b) { const u = origURL.call(URL, b); blobs.set(u, b); return u; };
  const downloads = [];
  const origA = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && blobs.has(this.href)) { downloads.push({ name: this.getAttribute('download'), blob: blobs.get(this.href), type: blobs.get(this.href).type }); return; }
    return origA.call(this);
  };
  const fetchFile = async (name) => new File([await (await fetch('/__test/' + name)).arrayBuffer()], name);
  const btn = (sel, pred) => [...document.querySelectorAll(sel)].find(pred);
  const nav = (key) => document.querySelector(`#bottom .navbtn[data-key="${key}"]`);
  // a bottom-bar button, once it is usable: right after an open the bar is busy and its buttons are disabled
  const press = async (key) => { const b = await until(() => { const x = nav(key); return x && !x.disabled ? x : null; }); if (!b) throw new Error('not usable: ' + key); b.click(); };
  const dialog = () => document.querySelector('dialog[open]');
  const primary = () => dialog() && dialog().querySelector('.buttons .btn-primary');
  try {
    R.ua = navigator.userAgent;
    R.webCryptoEd25519 = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign']).then(() => true, () => false);
    const splash = document.querySelector('.splash'); if (splash) splash.click();
    await until(() => document.querySelector('.tile'));
    // 1. open a library and edit it
    nextFile = await fetchFile('valid-unsigned.zbl');
    document.querySelectorAll('.tile')[0].click();
    const opened = await until(() => document.getElementById('lib-description'));
    step('open valid-unsigned.zbl', opened, document.title);
    const desc = document.getElementById('lib-description');
    desc.value = desc.value + ' (C5)'; desc.dispatchEvent(new Event('input', { bubbles: true })); desc.dispatchEvent(new Event('change', { bubbles: true })); desc.dispatchEvent(new Event('blur'));
    await sleep(800);
    step('edit the description', /\(C5\)$/.test(document.getElementById('lib-description').value));
    // 2. make a key (the crypto worker runs its self-test first, SR-15)
    await press('Sleutel maken');
    const nameField = await until(() => document.getElementById('key-name'));
    nameField.value = 'C5 test'; nameField.dispatchEvent(new Event('input', { bubbles: true }));
    primary().click();
    const ack = await until(() => document.getElementById('key-ack'), 20000);
    const fp = ack && dialog().querySelector('.fp') ? dialog().querySelector('.fp').textContent : null;
    step('make a key (self-test passed)', ack && fp, fp);
    if (!ack) throw new Error('no key dialog: ' + (dialog() ? dialog().textContent.slice(0, 160) : 'no dialog'));
    ack.click();
    primary().click();
    const keyFile = await until(() => downloads.find((d) => d.name.endsWith('.zbkey')));
    step('download the key file', keyFile, keyFile && `${keyFile.name} ${keyFile.type} ${keyFile.blob.size} B`);
    // 3. download the library, signed
    await sleep(500);
    await press('Downloaden');
    let signBox = await until(() => document.getElementById('dl-sign'));
    if (signBox && !signBox.checked) { signBox.click(); await sleep(1500); signBox = document.getElementById('dl-sign'); }
    step('tick Ondertekenen', signBox && signBox.checked);
    const dl = await until(() => { const p = primary(); return p && !p.disabled ? p : null; });
    dl.click();
    const lib = await until(() => downloads.find((d) => d.name.endsWith('.zbl')), 20000);
    step('download the signed library', lib, lib && `${lib.name} ${lib.type} ${lib.blob.size} B`);
    // the confirmation *Gedownload: …* is a modal dialog; close it as a user would
    const done = await until(() => dialog() && /Gedownload/.test(dialog().textContent) ? dialog() : null);
    step('the download is confirmed', done, done && done.textContent.slice(0, 80));
    if (done) { done.querySelector('.buttons .btn-primary').click(); await sleep(300); }
    // 4. open what was downloaded: read-only, signed by the new key
    await sleep(800);
    nextFile = new File([await lib.blob.arrayBuffer()], lib.name);
    await press('Openen');
    const ro = await until(() => document.querySelector('.robar'), 15000);
    const roText = ro ? ro.textContent : (dialog() ? 'dialog: ' + dialog().textContent.slice(0, 160) : 'nothing');
    // the key is still loaded, so the reopened library may open editable (EDT-24); either state must name the fingerprint
    const head = document.querySelector('#right').textContent;
    step('reopen: signed by the new key', (ro && fp && roText.includes(fp)) || (head.includes('C5 test')), ro ? roText : head.slice(0, 160));
    // 5. forget the key, reopen read-only, load the downloaded key file: unlocked
    await press('Sleutel vergeten'); await sleep(800);
    nextFile = new File([await lib.blob.arrayBuffer()], lib.name);
    await press('Openen');
    const ro2 = await until(() => document.querySelector('.robar'), 15000);
    step('reopen without the key: read-only', ro2 && fp && ro2.textContent.includes(fp), ro2 && ro2.textContent);
    nextFile = new File([await keyFile.blob.arrayBuffer()], keyFile.name);
    await press('Sleutel laden');
    const unlocked = await until(() => !document.querySelector('.robar') && document.getElementById('lib-description'), 15000);
    step('load the downloaded key file: unlocked', unlocked, (document.querySelector('.sr[role=status]') || {}).textContent);
    // 6. storage
    const idb = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : 'n/a';
    const store = { local: Object.keys(localStorage), session: sessionStorage.length, idb, caches: await caches.keys(), cookie: document.cookie };
    step('storage: only zbm.lang/zbm.bars', store.local.every((k) => k === 'zbm.lang' || k === 'zbm.bars') && !store.session && !(Array.isArray(idb) && idb.length) && !store.caches.length && !store.cookie, JSON.stringify(store));
  } catch (e) {
    step('exception', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e);
  }
  step('no CSP violations', R.violations.length === 0, R.violations.join('; '));
  step('no dialog left open', !dialog(), dialog() && dialog().textContent.slice(0, 80));
  // for the F1 step the driver presses the key itself
  const t = document.getElementById('lib-title'); if (t) t.focus();
  R.f1Ready = document.activeElement && document.activeElement.id;
  return JSON.stringify(R);
})()
