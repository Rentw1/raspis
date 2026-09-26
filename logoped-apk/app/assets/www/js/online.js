'use strict';
/*
 * Связь с Android (сохранение, печать, открытие файлов) и интернет-поиск картинок:
 * ARASAAC — логопедические пиктограммы с поиском по-русски (цвет и ч/б),
 * Openverse и Викисклад — открытые иллюстрации и фото.
 */
var NET = (function () {
  var B = window.AndroidBridge || null;
  var pending = {}, seq = 0;

  window.__bridgeCb = function (id, res) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    p(res);
  };
  function call(fn) {
    return new Promise(function (resolve) {
      var id = 'cb' + (++seq) + '_' + Date.now();
      pending[id] = resolve;
      fn(id);
      setTimeout(function () { if (pending[id]) { delete pending[id]; resolve({ ok: false, error: 'Нет ответа (время ожидания истекло)' }); } }, 45000);
    });
  }

  function isAndroid() { return !!B; }
  function online() { try { return B ? B.isOnline() : navigator.onLine !== false; } catch (e) { return true; } }
  function toast(msg) { if (B) B.toast(msg); }

  /** GET-запрос: {ok, status, type, data} (data — текст или base64 при binary) */
  function get(url, binary) {
    if (B) return call(function (id) { B.httpGet(url, !!binary, id); });
    return fetch(url).then(function (r) {
      var type = r.headers.get('content-type') || '';
      if (!binary) return r.text().then(function (t) { return { ok: r.ok, status: r.status, type: type, data: t }; });
      return r.arrayBuffer().then(function (buf) { return { ok: r.ok, status: r.status, type: type, data: U.b64FromBytes(new Uint8Array(buf)) }; });
    }).catch(function (e) { return { ok: false, error: e.message }; });
  }
  function getJson(url) {
    return get(url, false).then(function (r) {
      if (!r.ok) throw new Error(r.error || ('Ошибка сервера ' + (r.status || '')));
      return JSON.parse(r.data);
    });
  }
  function getDataUrl(url) {
    return get(url, true).then(function (r) {
      if (!r.ok || !r.data) throw new Error(r.error || ('Не удалось скачать картинку (' + (r.status || '') + ')'));
      var type = (r.type || 'image/png').split(';')[0];
      if (type.indexOf('image/') !== 0) type = 'image/png';
      return 'data:' + type + ';base64,' + r.data;
    });
  }

  /* ---------- ARASAAC ---------- */
  var ARA = 'https://api.arasaac.org/api/pictograms/';
  function arasaacSearch(q) {
    var term = encodeURIComponent(String(q).trim().toLowerCase());
    return getJson(ARA + 'ru/bestsearch/' + term).catch(function () { return []; }).then(function (best) {
      if (best && best.length) return best;
      return getJson(ARA + 'ru/search/' + term).catch(function () { return []; });
    }).then(function (list) {
      return (list || []).slice(0, 24).map(function (p) {
        var kw = (p.keywords || []).map(function (k) { return k.keyword; }).filter(Boolean);
        return { id: p._id, title: kw.slice(0, 2).join(', ') || String(p._id), thumb: 'https://static.arasaac.org/pictograms/' + p._id + '/' + p._id + '_300.png' };
      });
    });
  }
  function arasaacImage(id, color) {
    var url = ARA + id + '?download=false&plural=false&color=' + (color ? 'true' : 'false') + '&resolution=500&url=false';
    return getDataUrl(url).catch(function () {
      if (!color) throw new Error('Нет ч/б версии');
      return getDataUrl('https://static.arasaac.org/pictograms/' + id + '/' + id + '_500.png');
    });
  }
  /** Лучшая пиктограмма ARASAAC для слова: {c, b, src, credit} */
  function arasaacFor(word) {
    return arasaacSearch(word).then(function (list) {
      if (!list.length) throw new Error('Не найдено: ' + word);
      var id = list[0].id;
      return Promise.all([arasaacImage(id, true), arasaacImage(id, false).catch(function () { return null; })]).then(function (res) {
        return { c: res[0], b: res[1], src: 'arasaac', id: id, credit: 'ARASAAC (arasaac.org), Sergio Palao, CC BY-NC-SA 4.0' };
      });
    });
  }

  /* ---------- Openverse ---------- */
  function openverseSearch(q, kind) {
    var url = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(q) + '&page_size=24&mature=false' +
      (kind === 'illustration' ? '&category=illustration' : '');
    return getJson(url).then(function (j) {
      return (j.results || []).map(function (r) {
        return { id: r.id, title: r.title || '', thumb: r.thumbnail || r.url, full: r.url, credit: (r.creator ? r.creator + ', ' : '') + (r.license ? 'CC ' + String(r.license).toUpperCase() + ' ' + (r.license_version || '') : '') + (r.source ? ' (' + r.source + ')' : '') };
      });
    });
  }

  /* ---------- Викисклад ---------- */
  function commonsSearch(q) {
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=24' +
      '&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q) + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500';
    return getJson(url).then(function (j) {
      var pages = j.query && j.query.pages ? Object.keys(j.query.pages).map(function (k) { return j.query.pages[k]; }) : [];
      return pages.filter(function (p) { return p.imageinfo && p.imageinfo[0]; }).map(function (p) {
        var ii = p.imageinfo[0], md = ii.extmetadata || {};
        var lic = md.LicenseShortName ? md.LicenseShortName.value : '';
        var artist = md.Artist ? String(md.Artist.value).replace(/<[^>]+>/g, '') : '';
        return { id: p.pageid, title: p.title.replace(/^File:/, ''), thumb: ii.thumburl || ii.url, full: ii.thumburl || ii.url, credit: (artist ? artist + ', ' : '') + lic + ' (Wikimedia Commons)' };
      });
    });
  }

  /* ---------- файлы ---------- */
  function saveFile(name, bytes, mime) {
    var b64 = U.b64FromBytes(bytes);
    if (B) return call(function (id) { B.saveFile(name, b64, mime, id); });
    try {
      var blob = new Blob([bytes], { type: mime });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return Promise.resolve({ ok: true, name: name, path: 'Загрузки браузера' });
    } catch (e) { return Promise.resolve({ ok: false, error: e.message }); }
  }
  function openFile(name, mime) { if (B) B.openFile(name, mime); }
  function shareFile(name, mime) { if (B) B.shareFile(name, mime); }
  function printHtml(html, job) {
    if (B) { B.printHtml(html, job); return; }
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 600);
  }
  function version() { try { return B ? B.version() : 'web'; } catch (e) { return ''; } }

  return {
    isAndroid: isAndroid, online: online, toast: toast, get: get, getJson: getJson, getDataUrl: getDataUrl,
    arasaacSearch: arasaacSearch, arasaacImage: arasaacImage, arasaacFor: arasaacFor,
    openverseSearch: openverseSearch, commonsSearch: commonsSearch,
    saveFile: saveFile, openFile: openFile, shareFile: shareFile, printHtml: printHtml, version: version
  };
})();
