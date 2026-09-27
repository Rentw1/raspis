'use strict';
/* Общие помощники: случайность с зерном, склонение числительных, экранирование, даты. */
var U = (function () {
  var U = {};

  U.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hash = function (str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };

  U.shuffle = function (arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  U.pick = function (arr, rnd) { return arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined; };
  U.sample = function (arr, n, rnd) { return U.shuffle(arr, rnd).slice(0, Math.max(0, n)); };
  U.uniq = function (arr) { var s = {}, out = []; arr.forEach(function (x) { if (!s[x]) { s[x] = 1; out.push(x); } }); return out; };
  U.cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  U.lower = function (s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /** 1 минута, 2 минуты, 5 минут */
  U.plural = function (n, one, few, many) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  };
  U.min = function (n) { return n + ' ' + U.plural(n, 'минута', 'минуты', 'минут'); };
  U.minShort = function (n) { return n + ' мин'; };

  /** «кошка, собака и корова» */
  U.list = function (arr, conj) {
    conj = conj || 'и';
    var a = arr.filter(Boolean);
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' ' + conj + ' ' + a[a.length - 1];
  };

  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  U.dateLong = function (d) { d = d || new Date(); return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear() + ' г.'; };
  U.dateShort = function (d) {
    d = d || new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  };
  /** Учебный год: сентябрь–август */
  U.schoolYear = function (d) {
    d = d || new Date();
    var y = d.getFullYear();
    return d.getMonth() >= 8 ? (y + '–' + (y + 1)) : ((y - 1) + '–' + y);
  };

  U.numWord = function (n, g) {
    var m = { 1: { 'м': 'один', 'ж': 'одна', 'ср': 'одно', 'мн': 'одни' }, 2: { 'м': 'два', 'ж': 'две', 'ср': 'два', 'мн': 'двое' } };
    if (m[n]) return m[n][g] || m[n]['м'];
    return ['', '', '', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'][n] || String(n);
  };

  U.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  U.b64FromBytes = function (bytes) {
    var chunk = 0x8000, parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(''));
  };
  U.bytesFromB64 = function (b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  return U;
})();
