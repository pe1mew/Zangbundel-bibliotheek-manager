// SPDX-License-Identifier: Apache-2.0
// The bottom bar (webappGUI GD-04, GD-14, GD-17, GD-23, GD-39) and the panels it opens: *Android-app*
// (GD-15, GD-35) and *Over* (SR-52); implementationPlan M4.4. The library and key buttons are
// drawn now and work from M5 and M6; until then they say so. *Controle* works from M4.5.

import { el, extLink, icon } from './dom.js';
import { openDialog } from './dialog.js';
import { counts } from './check.js';
import { t, tParts } from './i18n.js';
import { VERSION } from './version.js';

// GD-15: where the panel's links go; https only (dom.js extLink).
export const LINKS = Object.freeze({
  apk: 'https://github.com/pe1mew/Zangbundel/releases/latest',
  appRepo: 'https://github.com/pe1mew/Zangbundel',
  managerRepo: 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager',
  manualNl: 'https://github.com/pe1mew/Zangbundel/wiki/Handleiding',
  manualEn: 'https://github.com/pe1mew/Zangbundel/wiki/Manual',
  managerManual: 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager/wiki',
});

/** SR-52: the privacy statement on zangbundel.nl, in the interface language; it covers both sites. */
export const privacyUrl = (lang) => `https://zangbundel.nl/${lang}/privacy.html`;

/** A bottom-bar button: icon above its label. */
function navButton(name, label, { onClick, disabled, title, dot, ariaLabel } = {}) {
  return el('button', { type: 'button', class: dot ? 'navbtn dirty' : 'navbtn', disabled: Boolean(disabled), title: title || label,
    'aria-label': ariaLabel || null, on: onClick ? { click: onClick } : undefined }, [dot ? el('span', { class: 'dot' }, []) : null, icon(name), el('span', {}, [label])]);
}

/**
 * GD-15, GD-35: the Android app's panel content, also on the narrow page (GD-32). The Google Play
 * badge is left out until the app is listed there; the F-Droid badge is greyed with *binnenkort*.
 */
export function androidContent(lang) {
  const ext = (href, text) => extLink(href, text, t(lang, 'newTab'));
  return [
    el('div', { class: 'badges' }, [
      el('span', { class: 'soonbadge' }, [
        el('span', { class: 'fdroid', role: 'img', 'aria-label': t(lang, 'fdroidBadge') }, []),
        el('span', { class: 'soonlabel' }, [t(lang, 'soon')]),
      ]),
    ]),
    el('p', {}, tParts(lang, 'apkLine', { link: ext(LINKS.apk, 'GitHub') })),
    el('div', { class: 'linkgrid' }, [
      el('div', {}, [
        el('h3', {}, [t(lang, 'manual')]),
        el('p', {}, [`${t(lang, 'manualApp')}: `, ext(LINKS.manualNl, 'Nederlands'), ' · ', ext(LINKS.manualEn, 'English')]),
        el('p', {}, [`${t(lang, 'manualManager')}: `, ext(LINKS.managerManual, t(lang, 'manualWord'))]),
      ]),
      el('div', {}, [
        el('h3', {}, [t(lang, 'sources')]),
        el('p', {}, [ext(LINKS.appRepo, t(lang, 'appWord'))]),
        el('p', {}, [ext(LINKS.managerRepo, t(lang, 'managerWord'))]),
      ]),
    ]),
  ];
}

export function androidDialog(lang) {
  return openDialog({ title: t(lang, 'androidTitle'), sub: t(lang, 'androidSub'), logo: true, closeLabel: t(lang, 'close') },
    androidContent(lang));
}

/** *Over*: name, version, credits and the privacy statement (SR-52). */
export function aboutDialog(lang) {
  return openDialog({ title: t(lang, 'appName'), sub: t(lang, 'version', { v: VERSION }), logo: true, closeLabel: t(lang, 'close') }, [
    el('p', {}, [t(lang, 'privacy')]),
    el('p', {}, [extLink(privacyUrl(lang), t(lang, 'privacyLink'), t(lang, 'newTab'))]),
    el('p', { class: 'muted small' }, [t(lang, 'aboutIcons')]),
  ]);
}

/**
 * GD-20: *Controle* with the numbers of errors and warnings and the icon of the worst; without a
 * library (findings null) it waits.
 */
function checkButton(lang, findings, onCheck) {
  if (findings === null) {
    return navButton('check', t(lang, 'check'), { disabled: true, title: `${t(lang, 'check')}: ${t(lang, 'tileNeedLib')}` });
  }
  const { e, w } = counts(findings);
  const label = `${t(lang, 'check')} (${t(lang, 'checkCounts', { e, w })})`;
  return el('button', { type: 'button', class: 'navbtn', title: label, 'aria-label': label, on: { click: onCheck } }, [
    el('span', { class: 'ckcount', 'aria-hidden': 'true' }, [e ? el('b', { class: 'e' }, [String(e)]) : null, w ? el('b', { class: 'w' }, [String(w)]) : null]),
    icon(e ? 'error' : w ? 'warning' : 'check'), el('span', {}, [t(lang, 'check')]),
  ]);
}

/**
 * The bottom bar's groups (GD-04): the library, *Controle*, the key (GD-14, GD-39) and the general
 * buttons. key is { name, fingerprint, needsExport } or null. A button whose handler is not given waits.
 */
export function bottomBar({ lang, onLanguage, onAndroid, onAbout, onCheck, onOpen, onNew, onEdit, canEdit = false, onClose, onDownload, onLoadKey, onMakeKey,
  onDownloadKey, onForgetKey, hasLibrary = false, busy = false, findings = null, key = null }) {
  const soon = t(lang, 'tileSoon');
  const wait = (name, label) => navButton(name, label, { disabled: true, title: `${label}: ${soon}` });
  const sep = () => el('span', { class: 'nav-sep', 'aria-hidden': 'true' }, []);
  const keyLabel = key ? `${key.name} · ${key.fingerprint}` : t(lang, 'noKey');
  return [
    el('div', { class: 'navgroup', role: 'group' }, [
      navButton('open', t(lang, 'open'), { onClick: onOpen, disabled: busy }),
      navButton('add', t(lang, 'new'), { onClick: onNew, disabled: busy }),
      onEdit ? navButton('edit', t(lang, 'edit'), { onClick: onEdit, disabled: !canEdit || busy,
        title: canEdit ? t(lang, 'edit') : `${t(lang, 'edit')}: ${t(lang, 'chooseSong')}` }) : wait('edit', t(lang, 'edit')),
      navButton('download', t(lang, 'download'), { onClick: onDownload, disabled: !hasLibrary || busy,
        title: hasLibrary ? t(lang, 'download') : `${t(lang, 'download')}: ${t(lang, 'tileNeedLib')}` }),
      navButton('close', t(lang, 'close'), { onClick: onClose, disabled: !hasLibrary || busy,
        title: hasLibrary ? t(lang, 'close') : `${t(lang, 'close')}: ${t(lang, 'tileNeedLib')}` }),
    ]),
    sep(),
    checkButton(lang, findings, onCheck),
    sep(),
    el('div', { class: 'navgroup keys', role: 'group', 'aria-label': `${t(lang, 'keyGroup')}: ${keyLabel}` }, [
      onMakeKey ? navButton('key', t(lang, 'keyMake'), { onClick: onMakeKey }) : wait('key', t(lang, 'keyMake')),
      onLoadKey
        ? navButton('upload', t(lang, 'keyLoad'), { onClick: onLoadKey, disabled: busy })
        : wait('upload', t(lang, 'keyLoad')),
      // GD-14: only a new key's file can be downloaded, once (SR-16); the dot says it is not saved yet
      onDownloadKey
        ? navButton('download', t(lang, 'keyDownload'), { onClick: onDownloadKey, disabled: !(key && key.needsExport),
          dot: Boolean(key && key.needsExport),
          title: key && key.needsExport ? t(lang, 'keyDownload') : `${t(lang, 'keyDownload')}: ${t(lang, key ? 'keyFileHave' : 'keyNone')}` })
        : wait('download', t(lang, 'keyDownload')),
      onForgetKey
        ? navButton('close', t(lang, 'keyForget'), { onClick: onForgetKey, disabled: !key,
          title: key ? t(lang, 'keyForget') : `${t(lang, 'keyForget')}: ${t(lang, 'keyNone')}` })
        : wait('close', t(lang, 'keyForget')),
      el('span', { class: 'navgroup-label', 'aria-hidden': 'true' }, [keyLabel]),
    ]),
    sep(),
    navButton('android', t(lang, 'android'), { onClick: onAndroid }),
    navButton('lang', t(lang, 'languageCode'), { onClick: onLanguage, title: t(lang, 'languageSwitch', { name: t(lang, 'languageName') }),
      ariaLabel: t(lang, 'languageSwitch', { name: t(lang, 'languageName') }) }),
    navButton('about', t(lang, 'about'), { onClick: onAbout }),
  ];
}
