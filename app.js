"use strict";

/* ============================================================
 * Хранилище
 * ============================================================ */

var LS_PREFIX = "ug:";

function lsGet(key){
  try{ var v = localStorage.getItem(LS_PREFIX + key); return v == null ? null : v; }
  catch(e){ return null; }
}
function lsSet(key, val){
  try{ localStorage.setItem(LS_PREFIX + key, val); return true; }
  catch(e){
    toast("Хранилище недоступно: " + (e.message || "ошибка"), "err");
    showStorageWarn("Не удалось сохранить данные. Разрешите localStorage для этого сайта.");
    return false;
  }
}
function lsRemove(key){ try{ localStorage.removeItem(LS_PREFIX + key); }catch(e){} }
function lsGetJson(key, fallback){
  try{
    var raw = lsGet(key);
    if(raw == null) return fallback;
    var v = JSON.parse(raw);
    return v == null ? fallback : v;
  }catch(e){ return fallback; }
}
function lsSetJson(key, val){ return lsSet(key, JSON.stringify(val)); }

/* ============================================================
 * Глобальное состояние
 * ============================================================ */

var accounts = [];
var categories = [];
var accountIndex = Object.create(null);
var actionLog = [];
var refreshTimer = null;
var currentFilter = "all";
var currentCategoryFilter = "all";
var currentSort = "status";
var currentView = lsGet("view") || "table";
var currentSearch = "";
var lastTapTime = 0;
var revealedPasswords = {};
var searchDebounce = null;
var isAppVisible = true;
var _expireTimer = null;
var _pendingToast = null;
var _dataRev = 0;
var _clipClearTimer = null;
var _storageWarned = false;
var _storageWarnedAt = 0;
var _prevVisibleIds = new Set();
var _appBuilt = false;
var historyFilterKind = "all";
var historyFilterAccId = "all";
var LAST_EXPORT = "";
var hoveredAccountId = null;

/* ============================================================
 * Иконки
 * ============================================================ */

var ICO = {
  history: "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8v5l3 3'/><path d='M3.05 11a9 9 0 1 1 .5 4M3 4v4h4'/></svg>",
  settings: "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'/></svg>",
  search: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>",
  copy: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg>",
  lock: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>",
  check: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>",
  play: "<svg viewBox='0 0 24 24' fill='currentColor'><path d='M5 3v18l15-9z'/></svg>",
  unlock: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 9.9-1'/></svg>",
  ban: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='m4.93 4.93 14.14 14.14'/></svg>",
  clock: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>",
  empty: "<svg width='72' height='72' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><rect x='2' y='6' width='20' height='12' rx='2'/><path d='M6 12h4M16 10h.01M16 14h.01'/></svg>",
  search_empty: "<svg width='60' height='60' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>",
  trash: "<svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/></svg>",
  edit: "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>",
  user: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>",
  phone: "<svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='5' y='2' width='14' height='20' rx='2'/><path d='M12 18h.01'/></svg>",
  down: "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/></svg>",
  info: "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M12 16v-4M12 8h.01'/></svg>",
  folder: "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/></svg>",
  help: "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>"
};

function icoWrap(inner, cls){ return "<span class='ico-inline" + (cls ? " " + cls : "") + "'>" + inner + "</span>"; }
function logoHTML(){
  return "<svg width='42' height='42' viewBox='0 0 48 48' fill='none'><defs><linearGradient id='ugGrad' x1='0' y1='0' x2='48' y2='48'><stop offset='0%' stop-color='#4a9fd4'/><stop offset='100%' stop-color='#2a5080'/></linearGradient><linearGradient id='ugGreen' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#7ec850'/><stop offset='100%' stop-color='#5e9c3a'/></linearGradient></defs><path d='M24 4 L42 14 L42 34 L24 44 L6 34 L6 14 Z' stroke='url(#ugGrad)' stroke-width='2.5' fill='none'/><path d='M24 12 L34 17.5 L34 30.5 L24 36 L14 30.5 L14 17.5 Z' fill='url(#ugGrad)' opacity='0.18'/><text x='24' y='29' text-anchor='middle' font-family='-apple-system,sans-serif' font-size='15' font-weight='900' fill='#4a9fd4' letter-spacing='-0.5'>UG</text><circle cx='40' cy='40' r='4' fill='url(#ugGreen)'/></svg>";
}

/* ============================================================
 * Утилиты
 * ============================================================ */

function avatarLetter(name){
  var s = String(name||"?").trim();
  if(!s) return "?";
  return s.charAt(0).toUpperCase() || "?";
}
function tapGuard(){
  if(Date.now() - lastTapTime < 200) return true;
  lastTapTime = Date.now();
  return false;
}
function numOrNull(v){
  if(v === null || v === undefined || v === "" || v === "null" || v === "NULL") return null;
  var n = new Date(v).getTime();
  return isNaN(n) ? null : n;
}
function safeJson(v, f){ try{return JSON.parse(v);}catch(e){return f;} }
function pad(n){ return n<10 ? "0"+n : ""+n; }

var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return ESC_MAP[c]; }); }

function fmtDT(iso){
  if(iso === null || iso === undefined || iso === "") return "—";
  var d = new Date(iso); if(isNaN(d.getTime())) return "—";
  return d.getDate()+"."+pad(d.getMonth()+1)+" "+pad(d.getHours())+":"+pad(d.getMinutes());
}
function fmtRemaining(ms){
  if(ms <= 0) return "0 мин";
  if(ms < 5 * 60 * 1000){
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ":" + (s < 10 ? "0" + s : "" + s);
  }
  var totalMin = Math.floor(ms/60000);
  var days = Math.floor(totalMin/1440); var hours = Math.floor((totalMin%1440)/60); var mins = totalMin%60;
  var parts = []; if(days > 0) parts.push(days+"д"); if(hours > 0) parts.push(hours+"ч"); if(mins > 0 || parts.length === 0) parts.push(mins+"м");
  return parts.join(" ");
}
function fmtSince(v){ return isNaN(Date.parse(v)) ? String(v) : fmtDT(v); }

function vib(kind){
  try{
    if(!navigator.vibrate) return;
    if(kind === "heavy") navigator.vibrate(35);
    else if(kind === "tick") navigator.vibrate(8);
    else navigator.vibrate(15);
  }catch(e){}
}

function copyToClipboard(text){
  if(text == null) text = "";
  try{
    if(navigator.clipboard && window.isSecureContext){
      var p = navigator.clipboard.writeText(text);
      if(p && typeof p.then === "function"){ p.catch(function(){}); }
      return true;
    }
  }catch(e){}
  try{
    var a = document.createElement("textarea");
    a.value = text;
    a.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(a);
    a.select();
    var r = false;
    try{ r = document.execCommand("copy"); }catch(e){}
    document.body.removeChild(a);
    if(!r) throw new Error("буфер обмена недоступен");
    return true;
  }catch(e){ return false; }
}

function readClipboard(){
  try{
    if(navigator.clipboard && window.isSecureContext && navigator.clipboard.readText){
      return navigator.clipboard.readText().catch(function(){ return null; });
    }
  }catch(e){}
  return Promise.resolve(null);
}

function downloadJson(filename, json){
  try{
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 2000);
    return true;
  }catch(e){ return false; }
}

var toastTimer = null;
function toast(msg, kind){
  var t = document.getElementById("toast");
  var cls = "toast"; var icon = "";
  if(kind === "ok"){ cls += " ok"; icon = icoWrap(ICO.check); } else if(kind === "err"){ cls += " err"; }
  t.innerHTML = "<div class=\"" + cls + "\">" + icon + esc(msg) + "</div>";
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.innerHTML = ""; }, 2600);
}

/* ============================================================
 * Схема (модель)
 * ============================================================ */

function normalizeCategory(c){
  if(!c) return null;
  return {
    id: Math.max(0, Math.floor(Number(c.id) || 0)),
    name: String(c.name == null ? "" : c.name).slice(0, 80),
    created_at: (c.created_at === null || c.created_at === undefined || c.created_at === "") ? new Date().toISOString() : String(c.created_at)
  };
}

function normalizeAccount(a){
  if(!a) return null;
  var bp=a.ban_permanent, bu=a.ban_until, cu=a.cooldown_until, bs=a.busy, cid=a.category_id;
  var cat = null;
  if(cid !== null && cid !== undefined && cid !== "" && Number(cid) > 0){
    cat = Math.floor(Number(cid));
  }
  return {
    id: Math.max(0, Math.floor(Number(a.id) || 0)),
    name: String(a.name == null ? "" : a.name),
    login: String(a.login == null ? "" : a.login),
    password: String(a.password == null ? "" : a.password),
    category_id: cat,
    ban_until: (bu === null || bu === undefined || bu === "" || bu === "null" || bu === "NULL") ? null : String(bu),
    ban_ts: numOrNull(bu),
    ban_permanent: (bp === 1 || bp === "1" || bp === true || bp === "true") ? 1 : 0,
    ban_reason: String(a.ban_reason == null ? "" : a.ban_reason),
    cooldown_until: (cu === null || cu === undefined || cu === "" || cu === "null" || cu === "NULL") ? null : String(cu),
    cool_ts: numOrNull(cu),
    cooldown_reason: String(a.cooldown_reason == null ? "" : a.cooldown_reason),
    busy: (bs === 1 || bs === "1" || bs === true || bs === "true") ? 1 : 0,
    busy_at: (a.busy_at === null || a.busy_at === undefined || a.busy_at === "" || a.busy_at === "null") ? null : String(a.busy_at),
    issued_to: String(a.issued_to == null ? "" : a.issued_to),
    created_at: (a.created_at === null || a.created_at === undefined || a.created_at === "" || a.created_at === "null") ? null : String(a.created_at)
  };
}

function rebuildAccountIndex(){
  accountIndex = Object.create(null);
  for(var i=0;i<accounts.length;i++){ accountIndex[String(accounts[i].id)] = accounts[i]; }
}
function getAccount(id){ return accountIndex[String(Number(id))] || null; }
function getCategory(id){
  if(id == null) return null;
  for(var i=0;i<categories.length;i++){ if(categories[i].id === Number(id)) return categories[i]; }
  return null;
}

function loginCatKey(login, category_id){
  var l = String(login || "").replace(/^\s+|\s+$/g, "").toLowerCase();
  if(!l) return "";
  var c = (category_id === null || category_id === undefined || category_id === "" || Number(category_id) <= 0) ? "null" : String(Math.floor(Number(category_id)));
  return l + "|" + c;
}

/* ============================================================
 * Persist
 * ============================================================ */

function loadAccounts(silent){
  var raw = lsGetJson("accounts", []);
  accounts = [];
  for(var i=0;i<raw.length;i++){ var n = normalizeAccount(raw[i]); if(n) accounts.push(n); }
  rebuildAccountIndex();
  autoExpireBlocks(silent === true);
}

function loadCategories(){
  var raw = lsGetJson("categories", []);
  categories = [];
  for(var i=0;i<raw.length;i++){ var n = normalizeCategory(raw[i]); if(n && n.name) categories.push(n); }
}

function loadActionLog(){
  actionLog = lsGetJson("actionLog", []);
  if(!Array.isArray(actionLog)) actionLog = [];
}
function loadLastExport(){ try{ var v = lsGet("last_export"); if(v) LAST_EXPORT = String(v); }catch(e){} }
function saveLastExport(){ LAST_EXPORT = new Date().toISOString(); lsSet("last_export", LAST_EXPORT); }

function bumpRev(){
  try{
    _dataRev = (_dataRev + 1) % 1000000;
    lsSet("data_rev", String(_dataRev));
  }catch(e){}
}
function persist(){
  var ok = lsSetJson("accounts", accounts);
  if(ok) bumpRev();
}
function persistCategories(){
  var ok = lsSetJson("categories", categories);
  if(ok) bumpRev();
}
function saveActionLog(){
  if(actionLog.length > 500) actionLog = actionLog.slice(0, 500);
  lsSetJson("actionLog", actionLog);
}
function addLog(text, kind, accId){
  try{
    var d = new Date();
    var k = (kind === "ok" || kind === "warn" || kind === "error") ? kind : "info";
    var aid = (accId === null || accId === undefined || accId === "") ? null : Number(accId);
    if(aid !== null && (isNaN(aid) || aid <= 0)) aid = null;
    actionLog.unshift({
      t: d.getDate()+"."+pad(d.getMonth()+1)+" "+pad(d.getHours())+":"+pad(d.getMinutes()),
      text: String(text == null ? "" : text),
      kind: k,
      accId: aid
    });
    saveActionLog();
  }catch(e){}
}

/* ============================================================
 * Статусы и таймеры
 * ============================================================ */

function getStatus(a){
  if(Number(a.ban_permanent) === 1) return "ban-perm";
  if(a.ban_ts && a.ban_ts > Date.now()) return "ban";
  if(Number(a.busy) === 1) return "busy";
  if(a.cool_ts && a.cool_ts > Date.now()) return "cool";
  return "free";
}
function statusOrder(s){ if(s === "free") return 0; if(s === "busy") return 1; if(s === "cool") return 2; if(s === "ban") return 3; return 4; }

function autoExpireBlocks(silent){
  var changed = false; var now = Date.now();
  accounts.forEach(function(a){
    if(Number(a.ban_permanent) !== 1 && a.ban_ts && a.ban_ts <= now){
      a.ban_until = null; a.ban_ts = null; a.ban_reason = ""; a.ban_permanent = 0; changed = true;
      if(!silent){ addLog("Бан истёк: " + a.name, "info", a.id); }
    }
    if(a.cool_ts && a.cool_ts <= now){
      a.cooldown_until = null; a.cool_ts = null; a.cooldown_reason = ""; changed = true;
      if(!silent){ addLog("Кулдаун истёк: " + a.name, "info", a.id); }
    }
  });
  if(changed) persist();
}

function scheduleExpireCheck(){
  if(_expireTimer){ clearTimeout(_expireTimer); _expireTimer = null; }
  if(!isAppVisible) return;
  var now = Date.now(); var nearest = Infinity;
  for(var i=0;i<accounts.length;i++){
    var a = accounts[i];
    if(Number(a.ban_permanent) === 1) continue;
    if(a.ban_ts && a.ban_ts > now && a.ban_ts < nearest) nearest = a.ban_ts;
    if(a.cool_ts && a.cool_ts > now && a.cool_ts < nearest) nearest = a.cool_ts;
  }
  if(nearest === Infinity) return;
  var delay = nearest - now + 500;
  if(delay < 1000) delay = 1000;
  if(delay > 2147483647) delay = 2147483647;
  _expireTimer = setTimeout(function(){ _expireTimer = null; refreshNow(); }, delay);
}

function startRefreshLoop(){ if(refreshTimer || !isAppVisible) return; refreshTimer = setInterval(tick, 30000); }
function stopRefreshLoop(){ if(refreshTimer){ clearInterval(refreshTimer); refreshTimer = null; } }
function stopCountdown(){ if(window._cdTimer){ clearInterval(window._cdTimer); window._cdTimer = null; } }
function refreshNow(){ loadAccounts(); renderList(); scheduleExpireCheck(); }

/* ============================================================
 * App shell
 * ============================================================ */

function buildApp(){
  var host = document.getElementById("app");
  if(!host) return;
  host.innerHTML =
    "<div class=\"header\">" +
      "<div class=\"h-brand\">" + logoHTML() +
        "<div class=\"h-text\"><div class=\"h-name\">United Gamers</div><div class=\"h-sub\">SteamAcc · Admin</div></div>" +
      "</div>" +
      "<button class=\"btn btn-primary desk-only\" onclick=\"openEdit(null)\">+ Добавить</button>" +
      "<button class=\"icon-btn\" onclick=\"openHotkeysModal()\" title=\"Горячие клавиши (Shift+/)\">" + ICO.help + "</button>" +
      "<button class=\"icon-btn\" onclick=\"openHistory()\" title=\"История (h)\">" + ICO.history + "</button>" +
      "<button class=\"icon-btn\" onclick=\"openMenu()\" title=\"Настройки (s)\">" + ICO.settings + "</button>" +
    "</div>" +
    "<div class=\"sub\">Управление Steam-аккаунтами клуба</div>" +
    "<div class=\"stats\">" +
      "<div class=\"stat free\" data-stat=\"free\" onclick=\"setFilter('free')\"><div class=\"num\">0</div><div class=\"lbl\">Свободно</div></div>" +
      "<div class=\"stat cool\" data-stat=\"cool\" onclick=\"setFilter('cool')\"><div class=\"num\">0</div><div class=\"lbl\">Кулдаун</div></div>" +
      "<div class=\"stat ban\" data-stat=\"ban\" onclick=\"setFilter('ban')\"><div class=\"num\">0</div><div class=\"lbl\">Бан</div></div>" +
      "<div class=\"stat busy\" data-stat=\"busy\" onclick=\"setFilter('busy')\"><div class=\"num\">0</div><div class=\"lbl\">Занято</div></div>" +
    "</div>" +
    "<div id=\"categoryZone\"></div>" +
    "<div id=\"searchZone\"></div>" +
    "<div id=\"listZone\"></div>" +
    "<div class=\"hints-bar\" id=\"hintsBar\"></div>";
  _appBuilt = true;
  buildSearchZone();
  buildCategoryZone();
  renderHintsBar();
  applyFilterHighlight();
  /* [UG-WEB-02][iter2][R] Один вызов bindHoverTracking в buildApp.
     #listZone создаётся здесь и живёт до перезагрузки; renderList меняет только
     его innerHTML, сам контейнер не пересоздаётся — делегирование продолжает работать. */
  bindHoverTracking();
}

function buildSearchZone(){
  var host = document.getElementById("searchZone");
  if(!host) return;
  if(host.querySelector("#searchInput")) return;
  if(accounts.length === 0){ host.innerHTML = ""; return; }
  host.innerHTML = "<div class=\"search-wrap\">" +
    "<span class=\"search-icon\">" + ICO.search + "</span>" +
    "<input id=\"searchInput\" type=\"text\" placeholder=\"Поиск по имени или логину...\" autocomplete=\"off\" inputmode=\"search\">" +
    "</div>";
  var si = document.getElementById("searchInput");
  if(si){
    si.value = currentSearch;
    si.addEventListener("input", function(){ onSearch(this.value); });
    si.addEventListener("keydown", function(e){
      if(e.key === "Escape" && currentSearch){ e.stopPropagation(); clearSearch(); }
    });
  }
}
function destroySearchZone(){
  var host = document.getElementById("searchZone");
  if(host) host.innerHTML = "";
}

function buildCategoryZone(){
  var host = document.getElementById("categoryZone");
  if(!host) return;
  if(accounts.length === 0 && categories.length === 0){ host.innerHTML = ""; return; }
  var sortedCats = categories.slice().sort(function(a,b){
    return (a.name||"").localeCompare(b.name||"", undefined, {numeric:true, sensitivity:"base"});
  });
  var html = "<div class=\"cat-filters\">";
  html += "<button class=\"chip" + (currentCategoryFilter === "all" ? " active" : "") + "\" onclick=\"setCategoryFilter('all')\">Все</button>";
  sortedCats.forEach(function(c){
    html += "<button class=\"chip" + (currentCategoryFilter === String(c.id) ? " active" : "") + "\" onclick=\"setCategoryFilter('" + c.id + "')\">" + esc(c.name) + "</button>";
  });
  html += "<button class=\"chip" + (currentCategoryFilter === "none" ? " active" : "") + "\" onclick=\"setCategoryFilter('none')\">Без категории</button>";
  html += "</div>";
  host.innerHTML = html;
}

function renderHintsBar(){
  var host = document.getElementById("hintsBar");
  if(!host) return;
  var ui = lsGetJson("ui", {});
  var enabled = ui.hintsBar === undefined ? true : !!ui.hintsBar;
  if(!enabled){ host.innerHTML = ""; return; }
  host.innerHTML =
    "<div class=\"hints-hint\" onclick=\"openHotkeysModal()\" style=\"cursor:pointer\">" +
      "<span><span class=\"kbd\">n</span> новый</span>" +
      "<span style=\"opacity:.4\">·</span>" +
      "<span><span class=\"kbd\">/</span> поиск</span>" +
      "<span style=\"opacity:.4\">·</span>" +
      "<span><span class=\"kbd\">h</span> история</span>" +
      "<span style=\"opacity:.4\">·</span>" +
      "<span><span class=\"kbd\">?</span> справка</span>" +
    "</div>" +
    "<button class=\"hints-bar-close\" onclick=\"event.stopPropagation();closeHintsBar()\" title=\"Скрыть\">×</button>";
  host.setAttribute("onclick", "openHotkeysModal()");
}

function closeHintsBar(){
  var ui = lsGetJson("ui", {});
  ui.hintsBar = false;
  lsSetJson("ui", ui);
  var host = document.getElementById("hintsBar");
  if(host){ host.innerHTML = ""; host.removeAttribute("onclick"); }
}

function applyFilterHighlight(){
  var stats = document.querySelectorAll(".stat");
  for(var i=0;i<stats.length;i++){
    var el = stats[i]; var key = el.getAttribute("data-stat");
    if((currentFilter === "ban" && key === "ban") || currentFilter === key) el.classList.add("active");
    else el.classList.remove("active");
  }
}

function setCategoryFilter(v){
  currentCategoryFilter = String(v);
  var ui = lsGetJson("ui", {});
  ui.categoryFilter = currentCategoryFilter;
  lsSetJson("ui", ui);
  vib("tick");
  renderList();
}

/* ============================================================
 * computeVisible — единая точка фильтрации и сортировки
 * ============================================================ */

function computeVisible(){
  var statusMap = new Map();
  accounts.forEach(function(a){ statusMap.set(String(a.id), getStatus(a)); });

  var query = currentSearch.trim().toLowerCase();
  var visible = accounts.filter(function(a){
    var s = statusMap.get(String(a.id));
    if(currentFilter === "ban"){ if(s !== "ban" && s !== "ban-perm") return false; }
    else if(currentFilter !== "all" && s !== currentFilter){ return false; }
    if(currentCategoryFilter === "none"){ if(a.category_id !== null) return false; }
    else if(currentCategoryFilter !== "all"){ if(String(a.category_id) !== currentCategoryFilter) return false; }
    if(query){ var hay = ((a.name||"") + " " + (a.login||"")).toLowerCase(); if(hay.indexOf(query) === -1) return false; }
    return true;
  });

  visible.sort(function(a,b){
    if(currentSort === "name") return (a.name||"").localeCompare(b.name||"", undefined, {numeric:true, sensitivity:"base"});
    if(currentSort === "login") return (a.login||"").localeCompare(b.login||"", undefined, {numeric:true, sensitivity:"base"});
    if(currentSort === "newest" || currentSort === "oldest"){
      var ta = a.created_at ? Date.parse(a.created_at) : 0; if(isNaN(ta)) ta = a.id || 0;
      var tb = b.created_at ? Date.parse(b.created_at) : 0; if(isNaN(tb)) tb = b.id || 0;
      return currentSort === "newest" ? tb - ta : ta - tb;
    }
    if(currentSort === "busy_longest"){
      var sAa = statusMap.get(String(a.id)); var sBb = statusMap.get(String(b.id));
      var aBusy = (sAa === "busy") ? 0 : 1;
      var bBusy = (sBb === "busy") ? 0 : 1;
      if(aBusy !== bBusy) return aBusy - bBusy;
      if(aBusy === 0){
        var tBA = a.busy_at ? Date.parse(a.busy_at) : NaN; if(isNaN(tBA)) tBA = Infinity;
        var tBB = b.busy_at ? Date.parse(b.busy_at) : NaN; if(isNaN(tBB)) tBB = Infinity;
        if(tBA !== tBB) return tBA - tBB;
        return (a.name||"").localeCompare(b.name||"", undefined, {numeric:true, sensitivity:"base"});
      }
      var sA2 = statusOrder(sAa); var sB2 = statusOrder(sBb);
      if(sA2 !== sB2) return sA2 - sB2;
      return (a.name||"").localeCompare(b.name||"", undefined, {numeric:true, sensitivity:"base"});
    }
    var sa = statusOrder(statusMap.get(String(a.id))); var sb = statusOrder(statusMap.get(String(b.id)));
    if(sa !== sb) return sa - sb;
    return (a.name||"").localeCompare(b.name||"", undefined, {numeric:true, sensitivity:"base"});
  });

  return visible;
}

/* ============================================================
 * renderList
 * ============================================================ */

function renderList(){
  if(!_appBuilt){ buildApp(); }
  var host = document.getElementById("listZone");
  if(!host) return;

  var searchHost = document.getElementById("searchZone");
  var hasInput = searchHost && searchHost.querySelector("#searchInput");
  if(accounts.length > 0 && !hasInput){ buildSearchZone(); }
  else if(accounts.length === 0 && hasInput){ destroySearchZone(); }

  buildCategoryZone();
  renderHintsBar();
  applyFilterHighlight();

  var stats = { free:0, cool:0, ban:0, banPerm:0, busy:0 };
  accounts.forEach(function(a){
    var s = getStatus(a);
    if(s === "ban-perm") stats.banPerm++; else if(s === "ban") stats.ban++; else if(s === "cool") stats.cool++; else if(s === "busy") stats.busy++; else stats.free++;
  });

  var visible = computeVisible();

  var newVisibleIds = new Set();
  visible.forEach(function(a){ newVisibleIds.add(String(a.id)); });

  var html = "";

  if(accounts.length > 0){
    html += "<div class=\"filters\">";
    html += chip("all", "Все", accounts.length);
    html += chip("free", "Свободные", stats.free);
    html += chip("cool", "Кулдаун", stats.cool);
    html += chip("ban", "Бан", stats.ban + stats.banPerm);
    html += chip("busy", "Занятые", stats.busy);
    html += "</div>";
    html += "<div class=\"toolbar\">";
    html += "<div class=\"sort-wrap\"><select class=\"sort-select\" onchange=\"setSort(this.value)\">";
    html += "<option value=\"status\"" + (currentSort === "status" ? " selected" : "") + ">По статусу</option>";
    html += "<option value=\"name\"" + (currentSort === "name" ? " selected" : "") + ">По названию</option>";
    html += "<option value=\"login\"" + (currentSort === "login" ? " selected" : "") + ">По логину</option>";
    html += "<option value=\"newest\"" + (currentSort === "newest" ? " selected" : "") + ">Сначала новые</option>";
    html += "<option value=\"oldest\"" + (currentSort === "oldest" ? " selected" : "") + ">Сначала старые</option>";
    html += "<option value=\"busy_longest\"" + (currentSort === "busy_longest" ? " selected" : "") + ">Сначала давно выданные</option>";
    html += "</select></div><div class=\"count-label\">" + visible.length + " из " + accounts.length + "</div><button class=\"btn btn-ghost desk-only\" onclick=\"toggleView()\">" + (tableMode() ? "Карточки" : "Таблица") + "</button></div>";
  }

  if(accounts.length === 0){
    html += "<div class=\"empty\"><span class=\"ico-empty\">" + ICO.empty + "</span>";
    html += "<div>Пока нет аккаунтов</div>";
    html += "<div class=\"hint\">Создайте первый аккаунт.</div>";
    html += "<button class=\"btn btn-success\" style=\"margin-top:18px\" onclick=\"openEdit(null)\">" + icoWrap(ICO.check) + " Добавить аккаунт</button>";
    html += "</div>";
  } else if(visible.length === 0){
    html += "<div class=\"empty\"><span class=\"ico-empty\">" + ICO.search_empty + "</span><div>Ничего не найдено</div></div>";
  } else {
    if(tableMode()) html += renderTable(visible); else { html += "<div class=\"cards\">"; visible.forEach(function(a){ html += renderCard(a); }); html += "</div>"; }
  }

  host.innerHTML = html;
  updateSearchClearBtn();

  var newCards = host.querySelectorAll(".card.new");
  for(var i=0;i<newCards.length;i++){ (function(n){ setTimeout(function(){ n.classList.remove("new"); }, 400); })(newCards[i]); }
  _prevVisibleIds = newVisibleIds;
  updateStatsAndChips();
}

function bindHoverTracking(){
  var host = document.getElementById("listZone");
  if(!host) return;
  host.addEventListener("mouseover", function(e){
    var el = e.target.closest("[data-id]");
    if(el && host.contains(el)){
      hoveredAccountId = Number(el.dataset.id);
      highlightHovered();
    }
  });
  host.addEventListener("mouseout", function(e){
    var el = e.target.closest("[data-id]");
    var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest("[data-id]") : null;
    if(el && el !== to){
      hoveredAccountId = null;
      highlightHovered();
    }
  });
  host.addEventListener("pointerdown", function(e){
    if(e.pointerType === "touch"){ hoveredAccountId = null; highlightHovered(); }
  });
}

function highlightHovered(){
  var list = document.querySelectorAll(".card, .tbl tr[data-id]");
  for(var i=0;i<list.length;i++){
    var el = list[i];
    if(hoveredAccountId !== null && Number(el.dataset.id) === hoveredAccountId) el.classList.add("hover-highlight");
    else el.classList.remove("hover-highlight");
  }
}

function updateSearchClearBtn(){
  var wrap = document.querySelector("#searchZone .search-wrap");
  if(!wrap) return;
  var old = wrap.querySelector(".search-clear");
  if(currentSearch){
    if(!old){
      var b = document.createElement("button");
      b.className = "search-clear";
      b.textContent = "✕";
      b.setAttribute("onclick","clearSearch()");
      wrap.appendChild(b);
    }
  } else if(old){ old.remove(); }
}

function tableMode(){ return window.innerWidth >= 900 && currentView === "table"; }
function toggleView(){ currentView = currentView === "table" ? "cards" : "table"; lsSet("view", currentView); renderList(); }

function renderTable(list){
  var statusMap = new Map();
  list.forEach(function(a){ statusMap.set(String(a.id), getStatus(a)); });
  function th(l, k){ return "<th onclick=\"setSort('" + k + "')\">" + l + (currentSort === k ? " ▾" : "") + "</th>"; }
  var h = "<table class=\"tbl\"><thead><tr>" + th("Аккаунт","name") + th("Логин","login") + th("Статус","status") + "<th style=\"cursor:default\">Детали</th><th style=\"cursor:default\"></th></tr></thead><tbody>";
  list.forEach(function(a){
    var s = statusMap.get(String(a.id)), det = "";
    if(s === "busy") det = (a.issued_to ? esc(a.issued_to) + " · " : "") + (a.busy_at ? "с " + esc(fmtSince(a.busy_at)) : "");
    else if(s === "cool") det = esc(a.cooldown_reason);
    else if(s === "ban" || s === "ban-perm") det = esc(a.ban_reason);
    h += "<tr data-status=\"" + s + "\" data-id=\"" + a.id + "\" onclick=\"openEdit(" + a.id + ")\"><td><div class=\"nm\">" + avatarHTML(a, "sm") + esc(a.name || "Без имени") + "</div></td><td class=\"mut\">" + esc(a.login || "—") + "</td><td>" + renderPill(a, s) + "</td><td class=\"mut\">" + det + "</td><td>" + actionFor(a, s) + " <button class=\"btn btn-primary\" onclick=\"event.stopPropagation();openBlock(" + a.id + ")\">" + icoWrap(ICO.lock) + " Блок</button></td></tr>";
  });
  return h + "</tbody></table>";
}

function chip(val, label, count){ var cls = "chip" + (currentFilter === val ? " active" : ""); return "<button class=\"" + cls + "\" data-chip=\"" + val + "\" onclick=\"setFilter('" + val + "')\">" + label + " · " + count + "</button>"; }

function renderPill(a, s){
  if(s === undefined) s = getStatus(a);
  if(s === "free") return "<span class=\"pill p-free\">" + icoWrap(ICO.play) + " Свободен</span>";
  if(s === "cool") return "<span class=\"pill p-cool\" data-id=\"" + a.id + "\">" + icoWrap(ICO.clock) + " Кулдаун · " + fmtRemaining(a.cool_ts - Date.now()) + "</span>";
  if(s === "ban") return "<span class=\"pill p-ban\" data-id=\"" + a.id + "\">" + icoWrap(ICO.ban) + " Бан · " + fmtRemaining(a.ban_ts - Date.now()) + "</span>";
  if(s === "ban-perm") return "<span class=\"pill p-ban-perm\">" + icoWrap(ICO.ban) + " Заблокирован</span>";
  if(s === "busy"){
    var long = false;
    if(a.busy_at){
      var t = Date.parse(a.busy_at);
      if(!isNaN(t) && (Date.now() - t) > 8 * 3600 * 1000) long = true;
    }
    var cls = long ? "pill p-busy p-busy-long" : "pill p-busy";
    var label = long ? " Занят (зависла)" : " Занят";
    return "<span class=\"" + cls + "\">" + icoWrap(long ? ICO.ban : ICO.play) + label + (a.issued_to ? " · " + esc(a.issued_to) : "") + (a.busy_at ? " · " + esc(fmtSince(a.busy_at)) : "") + "</span>";
  }
  return "";
}

function actionFor(a, s){
  if(s === "busy") return "<button class=\"btn btn-ghost\" onclick=\"event.stopPropagation();releaseAccount(" + a.id + ")\">" + icoWrap(ICO.unlock) + " Освободить</button>";
  if(s === "free") return "<button class=\"btn btn-success\" onclick=\"event.stopPropagation();tryIssue(" + a.id + ")\">" + icoWrap(ICO.play) + " Выдать</button>";
  return "<button class=\"btn " + (s === "cool" ? "btn-warn" : "btn-danger") + "\" onclick=\"event.stopPropagation();tryIssue(" + a.id + ")\">" + icoWrap(ICO.ban) + " Заблокировано</button>";
}

function avatarHTML(a, size){
  var s = getStatus(a);
  var sizeCls = (size === "sm" ? " sm" : (size === "lg" ? " lg" : ""));
  var cls = "acc-avatar" + sizeCls + " " + s;
  var badgeCls = "", badgeSym = "";
  if(s === "free"){ badgeCls = "free"; badgeSym = "▶"; }
  else if(s === "busy"){ badgeCls = "busy"; badgeSym = "❚❚"; }
  else if(s === "cool"){ badgeCls = "cool"; badgeSym = "◔"; }
  else { badgeCls = "ban"; badgeSym = "⊘"; }
  return "<div class='" + cls + "'>" + esc(avatarLetter(a.name)) +
         "<span class='avatar-badge " + badgeCls + "'>" + badgeSym + "</span>" +
         "</div>";
}

function renderCard(a){
  var s = getStatus(a);
  var pill = renderPill(a, s); var actionBtn = actionFor(a, s);
  var isNew = !_prevVisibleIds.has(String(a.id));
  var cls = "card" + (isNew ? " new" : "");
  var seenAttr = isNew ? "" : " data-seen=\"1\"";
  var cat = a.category_id ? getCategory(a.category_id) : null;
  var html = "<div class=\"" + cls + "\" data-status=\"" + s + "\" data-id=\"" + a.id + "\"" + seenAttr + " onclick=\"openEdit(" + a.id + ")\">";
  html += "<div class=\"row\"><div class=\"main\">";
  html += "<div class=\"acc-head\">" + avatarHTML(a);
  html += "<div style=\"flex:1;min-width:0\"><div class=\"acc-name\">" + esc(a.name||"Без имени") + "</div>";
  html += "<div class=\"acc-login\">" + icoWrap(ICO.user) + esc(a.login||"логин не указан") + "</div>";
  if(cat) html += "<div class=\"acc-cat\">" + esc(cat.name) + "</div>";
  html += "</div>";
  html += "<button class=\"icon-btn card-menu\" onclick=\"event.stopPropagation();openEdit(" + a.id + ")\">" + ICO.edit + "</button>";
  html += "</div>" + pill + "</div></div>";
  html += "<div class=\"actions\">" + actionBtn;
  html += "<button class=\"btn btn-primary\" onclick=\"event.stopPropagation();openBlock(" + a.id + ")\">" + icoWrap(ICO.lock) + " Блок</button>";
  html += "</div></div>";
  return html;
}

function updateTimers(){
  var pills = document.querySelectorAll(".pill.p-cool, .pill.p-ban");
  for(var i=0;i<pills.length;i++){
    var el = pills[i]; if(!el) continue;
    var id = el.getAttribute("data-id"); if(!id) continue;
    var a = getAccount(id); if(!a) continue;
    var s = getStatus(a);
    if(s === "cool" && a.cool_ts) el.innerHTML = icoWrap(ICO.clock) + " Кулдаун · " + fmtRemaining(a.cool_ts - Date.now());
    else if(s === "ban" && a.ban_ts) el.innerHTML = icoWrap(ICO.ban) + " Бан · " + fmtRemaining(a.ban_ts - Date.now());
  }
}

function tick(){
  autoExpireBlocks(false);
  updateTimers();
  scheduleExpireCheck();
}

function updateStatsAndChips(){
  var stats = { free:0, cool:0, ban:0, banPerm:0, busy:0 };
  accounts.forEach(function(a){
    var s = getStatus(a);
    if(s === "ban-perm") stats.banPerm++; else if(s === "ban") stats.ban++; else if(s === "cool") stats.cool++; else if(s === "busy") stats.busy++; else stats.free++;
  });
  var map = { free: stats.free, cool: stats.cool, ban: stats.ban + stats.banPerm, busy: stats.busy };
  Object.keys(map).forEach(function(key){
    var el = document.querySelector(".stat[data-stat=\"" + key + "\"] .num");
    if(el) el.textContent = String(map[key]);
  });
  var chipAll = document.querySelector(".chip[data-chip=\"all\"]");
  if(chipAll) chipAll.textContent = "Все · " + accounts.length;
  var chipFree = document.querySelector(".chip[data-chip=\"free\"]");
  if(chipFree) chipFree.textContent = "Свободные · " + stats.free;
  var chipCool = document.querySelector(".chip[data-chip=\"cool\"]");
  if(chipCool) chipCool.textContent = "Кулдаун · " + stats.cool;
  var chipBan = document.querySelector(".chip[data-chip=\"ban\"]");
  if(chipBan) chipBan.textContent = "Бан · " + (stats.ban + stats.banPerm);
  var chipBusy = document.querySelector(".chip[data-chip=\"busy\"]");
  if(chipBusy) chipBusy.textContent = "Занятые · " + stats.busy;
  var countLabel = document.querySelector(".toolbar .count-label");
  if(countLabel){
    var n = computeVisible().length;
    countLabel.textContent = n + " из " + accounts.length;
  }
}

function onSearch(v){
  currentSearch = v;
  if(searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(function(){
    searchDebounce = null;
    renderList();
  }, 120);
}
function clearSearch(){
  currentSearch = "";
  var si = document.getElementById("searchInput");
  if(si) si.value = "";
  renderList();
}
function setFilter(f){ currentFilter = currentFilter === f ? "all" : f; vib("tick"); renderList(); }
function setSort(v){ currentSort = v || "status"; vib("tick"); renderList(); }

function closeModal(){
  stopCountdown();
  document.getElementById("modals").innerHTML = "";
  window._cf = null;
  window._blockType = null;
  window._issueCopied = null;
  window._issueId = null;
  issueDraft = {};
}

/* ============================================================
 * Storage warning
 * ============================================================ */

function dismissStorageWarn(){
  var host = document.getElementById("storageWarn");
  if(host) host.innerHTML = "";
  _storageWarned = false;
}
function showStorageWarn(msg){
  var now = Date.now();
  if(_storageWarned && (now - _storageWarnedAt) < 30000) return;
  _storageWarned = true;
  _storageWarnedAt = now;
  var host = document.getElementById("storageWarn");
  if(!host) return;
  host.innerHTML = "<div class='storage-warn' role='alert'><div class='sw-title'>" + icoWrap(ICO.info) + " Хранилище недоступно</div><div class='sw-text'>" + esc(msg || "Данные не сохраняются между перезагрузками. Разрешите localStorage для этого сайта.") + "</div><button class='btn btn-ghost sw-btn' onclick=\"dismissStorageWarn()\">Понятно</button></div>";
}

/* ============================================================
 * Открытие/редактирование аккаунта
 * ============================================================ */

function openEdit(id){
  if(tapGuard()) return;
  vib("click");
  var a = id != null ? getAccount(id) : null;
  var isNew = !a; window._editId = a ? a.id : null;
  var nm = a ? (a.name||"") : ""; var lgn = a ? (a.login||"") : ""; var pwd = a ? (a.password||"") : "";
  var catId = a ? a.category_id : null;
  var sortedCats = categories.slice().sort(function(x,y){ return (x.name||"").localeCompare(y.name||"","ru"); });
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.edit) + (isNew ? "Новый аккаунт" : "Редактировать") + "</h2>";
  html += "<div class=\"field\"><label>Имя аккаунта *</label><input id=\"f_name\" type=\"text\" value=\"" + esc(nm) + "\" placeholder=\"club_01\" autocomplete=\"off\"></div>";
  html += "<div class=\"field\"><label>Логин Steam</label><input id=\"f_login\" type=\"text\" value=\"" + esc(lgn) + "\" placeholder=\"login_name\" autocomplete=\"off\"></div>";
  html += "<div class=\"field\"><label>Пароль</label><div class=\"pass-wrap\"><input id=\"f_pass\" type=\"password\" value=\"" + esc(pwd) + "\" placeholder=\"пароль\" autocomplete=\"off\"><button class=\"eye\" onclick=\"togglePass()\">👁</button></div></div>";
  html += "<div class=\"field\"><label>Категория</label><select id=\"f_category\" class=\"sort-select\">";
  html += "<option value=\"\"" + (catId == null ? " selected" : "") + ">— без категории —</option>";
  sortedCats.forEach(function(c){
    html += "<option value=\"" + c.id + "\"" + (String(catId) === String(c.id) ? " selected" : "") + ">" + esc(c.name) + "</option>";
  });
  html += "</select><button class=\"btn btn-ghost\" style=\"margin-top:8px\" onclick=\"openCategoryManager()\">" + icoWrap(ICO.folder) + " Управление категориями</button></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeModal()\">Отмена</button>";
  html += "<button class=\"btn btn-primary\" onclick=\"saveAccount(" + (isNew?"null":id) + ")\">" + icoWrap(ICO.check) + " Сохранить</button></div>";
  if(!isNew){ html += "<div class=\"modal-actions\" style=\"margin-top:10px\"><button class=\"btn btn-danger\" onclick=\"confirmDelete(" + id + ")\">" + icoWrap(ICO.trash) + " Удалить</button></div>"; }
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
}

function togglePass(){ var el = document.getElementById("f_pass"); if(!el) return; el.type = el.type === "password" ? "text" : "password"; vib("tick"); }

function saveAccount(id){
  var nameEl = document.getElementById("f_name");
  var loginEl = document.getElementById("f_login");
  var passEl = document.getElementById("f_pass");
  var catEl = document.getElementById("f_category");
  if(!nameEl || !loginEl || !passEl){ toast("Форма недоступна", "err"); return; }
  var nm = nameEl.value.trim();
  var lgn = loginEl.value.trim();
  var pwd = passEl.value;
  var catVal = catEl ? catEl.value : "";
  var catId = (catVal === "" ? null : Number(catVal));
  if(catId !== null && (isNaN(catId) || catId <= 0)) catId = null;
  if(!nm){ toast("Введите имя аккаунта", "err"); return; }
  var catKey = (catId === null ? "null" : String(catId));
  var dup = accounts.filter(function(x){
    return lgn
      && x.id !== id
      && x.login.toLowerCase() === lgn.toLowerCase()
      && String(x.category_id === null ? "null" : x.category_id) === catKey;
  })[0];
  if(dup){ toast("Логин уже занят в этой категории: " + dup.name, "err"); return; }
  var editingId = (id == null) ? null : Number(id);
  if(id == null){
    var newId = 0; accounts.forEach(function(x){ if(x.id >= newId) newId = x.id+1; });
    if(newId === 0) newId = 1;
    accounts.push(normalizeAccount({ id:newId, name:nm, login:lgn, password:pwd, category_id:catId, created_at:new Date().toISOString() }));
    addLog("Создан: " + nm, "ok");
  } else {
    for(var i=0;i<accounts.length;i++){
      if(accounts[i].id === id){
        accounts[i].name = nm;
        accounts[i].login = lgn;
        accounts[i].password = pwd;
        accounts[i].category_id = catId;
        break;
      }
    }
    addLog("Изменён: " + nm, "info", editingId);
  }
  persist();
  rebuildAccountIndex();
  closeModal(); renderList(); vib("click");
  toast(id == null ? "Аккаунт добавлен" : "Изменения сохранены", "ok");
}

function confirmDelete(id){
  var a = getAccount(id); if(!a) return;
  var html = "<div class=\"modal-bg\"><div class=\"alert-modal\" style=\"max-width:400px\">";
  html += "<div class=\"icon\">" + icoWrap(ICO.trash) + "</div><h2>Удалить аккаунт?</h2>";
  html += "<div class=\"info\"><div class=\"info-row\"><span class=\"lbl\">Аккаунт</span><span class=\"val\">" + esc(a.name||"") + "</span></div></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeModal()\">Отмена</button>";
  html += "<button class=\"btn btn-danger\" onclick=\"deleteAccount(" + id + ")\">Удалить</button></div></div></div>";
  document.getElementById("modals").innerHTML = html;
}

function deleteAccount(id){
  if(tapGuard()) return;
  var nm = ""; accounts.forEach(function(x){ if(x.id === id) nm = x.name; });
  var targetId = Number(id);
  accounts = accounts.filter(function(x){ return x.id !== id; });
  delete revealedPasswords[id];
  addLog("Удалён: " + nm, "danger", targetId);
  persist();
  rebuildAccountIndex();
  closeModal();
  renderList(); vib("heavy");
  toast("Аккаунт удалён", "ok");
}

/* ============================================================
 * Копирование
 * ============================================================ */

function copyText(value, btnId, label){
  if(!value){ toast("Значение пустое", "err"); return false; }
  var ok = copyToClipboard(value);
  if(!ok){ toast("Не удалось скопировать", "err"); return false; }
  vib("click");
  toast(label + " · очистка через 30с", "ok");
  var btn = btnId ? document.getElementById(btnId) : null;
  if(btn){
    if(!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
    btn.classList.add("done");
    btn.innerHTML = icoWrap(ICO.check) + " Скопировано";
    setTimeout(function(){
      btn.classList.remove("done");
      if(btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
    }, 1500);
  }
  if(_clipClearTimer){ clearTimeout(_clipClearTimer); _clipClearTimer = null; }
  _clipClearTimer = setTimeout(function(){
    _clipClearTimer = null;
    try{
      var p = readClipboard();
      if(p && typeof p.then === "function"){
        p.then(function(cur){
          if(cur === null) return;
          if(cur === value) copyToClipboard("");
        }).catch(function(){});
      }
    }catch(e){}
  }, 30000);
  return true;
}

function copyIssueField(id, kind, btnId){
  var a = getAccount(id); if(!a) return;
  var value = kind === "login" ? (a.login||"") : (a.password||"");
  var label = kind === "login" ? "Логин скопирован" : "Пароль скопирован";
  if(copyText(value, btnId, label)) window._issueCopied = id;
}
function toggleReveal(id){ revealedPasswords[id] = !revealedPasswords[id]; vib("tick"); maskUpdate(id); }
function maskUpdate(id){
  var a = getAccount(id), v = document.getElementById("issue-pass"), b = document.getElementById("issue-reveal");
  if(!a || !v) return;
  var r = !!revealedPasswords[id];
  v.textContent = r ? (a.password || "—") : (a.password ? "••••••••" : "—");
  v.className = r ? "issue-value" : "issue-value masked";
  if(b) b.textContent = r ? "🙈 Скрыть" : "👁 Показать";
}

/* ============================================================
 * Блокировки
 * ============================================================ */

function openBlock(id){
  if(tapGuard()) return;
  var a = getAccount(id); if(!a) return;
  var activeType = (Number(a.ban_permanent) === 1 || a.ban_ts) ? "ban" : "cool";
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.lock) + "Блокировка</h2>";
  html += "<div class=\"type-tabs\">";
  html += "<button class=\"type-tab" + (activeType === "ban" ? " active" : "") + "\" data-t=\"ban\" onclick=\"switchType('ban')\">" + icoWrap(ICO.ban) + " Бан</button>";
  html += "<button class=\"type-tab" + (activeType === "cool" ? " active" : "") + "\" data-t=\"cool\" onclick=\"switchType('cool')\">" + icoWrap(ICO.clock) + " Кулдаун</button>";
  html += "</div>";
  html += "<div id=\"quickBan\" style=\"display:" + (activeType === "ban" ? "block" : "none") + "\">";
  html += "<div class=\"field\"><label>Быстрый выбор</label><div class=\"quick-grid\">";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'ban',1440)\">1 день</button>";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'ban',4320)\">3 дня</button>";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'ban',10080)\">7 дней</button>";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'ban',43200)\">30 дней</button>";
  html += "<button class=\"quick-btn wide\" onclick=\"setPermanent(" + id + ")\">" + icoWrap(ICO.ban) + " Навсегда</button>";
  html += "</div></div></div>";
  html += "<div id=\"quickCool\" style=\"display:" + (activeType === "cool" ? "block" : "none") + "\">";
  html += "<div class=\"field\"><label>Быстрый выбор (CS2)</label><div class=\"quick-grid\">";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'cool',30)\">30 мин</button>";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'cool',120)\">2 часа</button>";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'cool',1440)\">24 часа</button>";
  html += "<button class=\"quick-btn\" onclick=\"setQuick(" + id + ",'cool',10080)\">7 дней</button>";
  html += "</div></div></div>";
  html += "<div class=\"field\"><label>Точное время окончания</label><input id=\"b_dt\" type=\"datetime-local\" value=\"" + defaultDateTimeLocal() + "\"></div>";
  html += "<div class=\"field\"><label>Причина</label><textarea id=\"b_reason\" placeholder=\"Например: VAC, CS2 cooldown\"></textarea></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeModal()\">Отмена</button>";
  html += "<button class=\"btn btn-warn\" onclick=\"saveBlockFromInput(" + id + ")\">" + icoWrap(ICO.check) + " Установить</button></div>";
  if(Number(a.ban_permanent) === 1 || a.ban_ts){ html += "<div class=\"modal-actions\" style=\"margin-top:10px\"><button class=\"btn btn-danger\" onclick=\"clearBlock(" + id + ",'ban')\">" + icoWrap(ICO.unlock) + " Снять бан</button></div>"; }
  if(a.cool_ts){ html += "<div class=\"modal-actions\" style=\"margin-top:10px\"><button class=\"btn btn-danger\" onclick=\"clearBlock(" + id + ",'cool')\">" + icoWrap(ICO.unlock) + " Снять кулдаун</button></div>"; }
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
  window._blockType = activeType;
}
function switchType(t){
  window._blockType = t;
  var tabs = document.querySelectorAll(".type-tab");
  for(var i=0;i<tabs.length;i++){ var tab = tabs[i]; if(tab.getAttribute("data-t") === t) tab.classList.add("active"); else tab.classList.remove("active"); }
  var qb = document.getElementById("quickBan"); var qc = document.getElementById("quickCool");
  if(qb) qb.style.display = t === "ban" ? "block" : "none";
  if(qc) qc.style.display = t === "cool" ? "block" : "none";
  vib("tick");
}
function defaultDateTimeLocal(){ var d = new Date(Date.now()+60*60000); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()); }
function setQuick(id, type, minutes){ var iso = new Date(Date.now()+minutes*60000).toISOString(); var el = document.getElementById("b_reason"); var reason = el ? el.value.trim() : ""; applyBlock(id, type, iso, false, reason); }
function setPermanent(id){ var el = document.getElementById("b_reason"); var reason = el ? el.value.trim() : ""; applyBlock(id, "ban", null, true, reason); }
function saveBlockFromInput(id){
  var t = window._blockType || "cool";
  var v = document.getElementById("b_dt").value;
  if(!v){ toast("Выберите дату и время", "err"); return; }
  var d = new Date(v);
  if(isNaN(d.getTime())){ toast("Некорректная дата", "err"); return; }
  if(d.getTime() <= Date.now()){ toast("Дата должна быть в будущем", "err"); return; }
  var reason = document.getElementById("b_reason").value.trim();
  applyBlock(id, t, d.toISOString(), false, reason);
}
function applyBlock(id, type, iso, permanent, reason){
  id = Number(id);
  if(!id){ toast("Ошибка: неверный ID", "err"); return; }
  var target = getAccount(id);
  if(!target){ toast("Аккаунт не найден", "err"); return; }
  if(type === "ban" && permanent){
    target.ban_until = null; target.ban_ts = null; target.ban_permanent = 1; target.ban_reason = reason;
    target.cooldown_until = null; target.cool_ts = null; target.cooldown_reason = "";
  } else if(type === "ban"){
    target.ban_until = iso; target.ban_ts = new Date(iso).getTime(); target.ban_permanent = 0; target.ban_reason = reason;
    target.cooldown_until = null; target.cool_ts = null; target.cooldown_reason = "";
  } else {
    target.cooldown_until = iso; target.cool_ts = new Date(iso).getTime(); target.cooldown_reason = reason;
  }
  if(type === "ban"){ target.busy = 0; target.busy_at = null; target.issued_to = ""; }
  persist();
  if(type === "ban" && permanent){ addLog("Бан навсегда: " + target.name, "warn", id); toast("Бан навсегда установлен", "ok"); }
  else if(type === "ban"){ addLog("Бан: " + target.name + " до " + fmtDT(iso), "warn", id); toast("Бан до " + fmtDT(iso), "ok"); }
  else { addLog("Кулдаун: " + target.name + " до " + fmtDT(iso), "warn", id); toast("Кулдаун до " + fmtDT(iso), "ok"); }
  closeModal(); renderList(); scheduleExpireCheck(); vib("click");
}
function clearBlock(id, type){
  id = Number(id);
  var target = getAccount(id);
  if(!target) return;
  if(type === "ban"){
    target.ban_until = null; target.ban_ts = null; target.ban_permanent = 0; target.ban_reason = "";
    target.busy = 0; target.busy_at = null; target.issued_to = "";
    addLog("Бан снят: " + target.name, "info", id); toast("Бан снят", "ok");
  } else {
    target.cooldown_until = null; target.cool_ts = null; target.cooldown_reason = "";
    addLog("Кулдаун снят: " + target.name, "info", id); toast("Кулдаун снят", "ok");
  }
  persist();
  closeModal(); renderList(); scheduleExpireCheck(); vib("click");
}

/* ============================================================
 * Выдача
 * ============================================================ */

var issueDraft = {};

function tryIssue(id){
  if(tapGuard()) return;
  var a = getAccount(id); if(!a) return;
  vib("heavy"); var s = getStatus(a);
  if(s === "ban-perm"){ showBlockModal(a, "ban-perm", null); return; }
  if(s === "ban"){ showBlockModal(a, "ban", a.ban_ts); return; }
  if(s === "cool"){ showBlockModal(a, "cool", a.cool_ts); return; }
  if(s === "busy"){ showBusyBlock(a); return; }
  issueDraft[id] = ""; window._issueCopied = null; window._issueId = id;
  openIssue(id);
}
function isBlocked(a){ var st = getStatus(a); return st === "ban" || st === "ban-perm" || st === "cool"; }
function openIssue(id){
  id = Number(id);
  var a = getAccount(id); if(!a) return;
  if(isBlocked(a)){ tryIssue(id); return; }
  var s = getStatus(a);
  var revealed = !!revealedPasswords[id];
  var passDisplay = revealed ? (a.password || "—") : (a.password ? "••••••••" : "—");
  var passClass = revealed ? "issue-value" : "issue-value masked";
  var statusLbl = "";
  if(s === "free") statusLbl = "<span class=\"pill p-free\">" + icoWrap(ICO.play) + " Свободен</span>";
  else if(s === "cool"){ var rc = fmtRemaining(a.cool_ts - Date.now()); statusLbl = "<span class=\"pill p-cool\">" + icoWrap(ICO.clock) + " Кулдаун · " + rc + "</span>"; }
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeIssue(" + id + ")\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.play) + "Выдать аккаунт</h2>";
  html += "<div class=\"issue-hero\">";
  html += avatarHTML(a, "lg");
  html += "<div class=\"issue-info\"><div class=\"issue-name\">" + esc(a.name||"Без имени") + "</div>";
  html += "<div class=\"issue-status\">" + statusLbl + "</div></div></div>";
  html += "<div class=\"issue-section\"><div class=\"issue-label\">Логин Steam</div>";
  html += "<div class=\"issue-row\"><div class=\"issue-value\">" + esc(a.login || "— не указан —") + "</div>";
  html += "<button class=\"issue-copy\" id=\"issue-btn-login\" onclick=\"copyIssueField(" + id + ",'login','issue-btn-login')\">" + icoWrap(ICO.copy) + " Копировать</button>";
  html += "</div></div>";
  html += "<div class=\"issue-section\"><div class=\"issue-label\">Пароль</div>";
  html += "<div class=\"issue-row\"><div id=\"issue-pass\" class=\"" + passClass + "\">" + esc(passDisplay) + "</div>";
  html += "<button id=\"issue-reveal\" class=\"issue-reveal\" onclick=\"toggleReveal(" + id + ")\">" + (revealed ? "🙈 Скрыть" : "👁 Показать") + "</button>";
  html += "<button class=\"issue-copy\" id=\"issue-btn-pass\" onclick=\"copyIssueField(" + id + ",'pass','issue-btn-pass')\">" + icoWrap(ICO.copy) + " Копировать</button>";
  html += "</div></div>";
  html += "<div class=\"issue-hint\">" + icoWrap(ICO.info) + "<div>Скопируйте логин и пароль, затем вставьте в Steam. Буфер обмена очистится через 30 секунд.</div></div>";
  html += "<div class=\"field\" style=\"margin-top:12px\"><label>Кому выдан (ПК / игрок)</label><input id=\"issue_to\" maxlength=\"40\" value=\"" + esc(issueDraft[id] || "") + "\" oninput=\"issueDraft[" + id + "]=this.value\"></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeIssue(" + id + ")\">Закрыть</button>";
  html += "<button class=\"btn btn-success\" onclick=\"markBusy(" + id + ")\">" + icoWrap(ICO.check) + " Выдать</button></div>";
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
}
function closeIssue(id){
  var a = getAccount(id);
  if(window._issueCopied === id && a && Number(a.busy) !== 1){
    window._issueCopied = null;
    confirmAction({title:"Данные скопированы", text:"Аккаунт «" + a.name + "» не отмечен занятым. Отметить?", ok:"Отметить занятым", no:"Не отмечать", cb:function(){ markBusy(id); }});
    return;
  }
  delete issueDraft[id];
  closeModal();
}
function markBusy(id){
  if(tapGuard()) return;
  id = Number(id);
  var a = getAccount(id); if(!a) return;
  var st = getStatus(a);
  if(st === "busy"){ toast("Уже занят", "err"); return; }
  if(st === "ban" || st === "ban-perm" || st === "cool"){ toast("Заблокирован", "err"); return; }
  var to = String(issueDraft[id] || "").trim().slice(0, 40), at = new Date().toISOString();
  a.busy = 1; a.busy_at = at; a.issued_to = to;
  addLog("Выдан: " + a.name + (to ? " → " + to : ""), "ok", id);
  persist();
  window._issueCopied = null; delete issueDraft[id];
  closeModal(); renderList(); vib("click");
  toast("Аккаунт помечен занятым", "ok");
}
function releaseAccount(id){
  if(tapGuard()) return;
  id = Number(id);
  var a = getAccount(id); if(!a) return;
  a.busy = 0; a.busy_at = null; a.issued_to = "";
  addLog("Освобождён: " + a.name, "info", id);
  persist();
  closeModal(); renderList(); vib("click");
  toast("Аккаунт освобождён", "ok");
}
function showBusyBlock(a){
  var html = "<div class=\"modal-bg\"><div class=\"alert-modal busy\" style=\"max-width:400px\">";
  html += "<div class=\"icon\">" + icoWrap(ICO.phone) + "</div><h2>АККАУНТ ЗАНЯТ</h2>";
  html += "<div class=\"info\"><div class=\"info-row\"><span class=\"lbl\">Аккаунт</span><span class=\"val\">" + esc(a.name||"") + "</span></div>";
  if(a.issued_to) html += "<div class=\"info-row\"><span class=\"lbl\">Кому</span><span class=\"val\">" + esc(a.issued_to) + "</span></div>";
  if(a.busy_at) html += "<div class=\"info-row\"><span class=\"lbl\">Занят с</span><span class=\"val\">" + esc(fmtSince(a.busy_at)) + "</span></div>";
  html += "</div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeModal()\">Понятно</button>";
  html += "<button class=\"btn btn-danger\" onclick=\"closeModal();releaseAccount(" + a.id + ")\">" + icoWrap(ICO.unlock) + " Освободить</button></div></div></div>";
  document.getElementById("modals").innerHTML = html;
}
function showBlockModal(a, kind, untilMs){
  var isPerm = kind === "ban-perm"; var isBan = kind === "ban" || isPerm;
  var cls = isBan ? "" : "warn"; var icon = isBan ? ICO.ban : ICO.clock;
  var title = isPerm ? "ЗАБАНЕН НАВСЕГДА" : (isBan ? "АККАУНТ ПОД БАНОМ" : "КУЛДАУН CS2");
  var reason = isBan ? a.ban_reason : a.cooldown_reason;
  var untilISO = isBan ? a.ban_until : a.cooldown_until;
  var html = "<div class=\"modal-bg\"><div class=\"alert-modal " + cls + "\">";
  html += "<div class=\"icon\">" + icoWrap(icon) + "</div><h2>" + title + "</h2>";
  html += "<div class=\"info\"><div class=\"info-row\"><span class=\"lbl\">Аккаунт</span><span class=\"val\">" + esc(a.name||"") + "</span></div>";
  if(a.login) html += "<div class=\"info-row\"><span class=\"lbl\">Логин</span><span class=\"val\">" + esc(a.login) + "</span></div>";
  html += "</div>";
  if(!isPerm){
    html += "<div class=\"info\"><div class=\"info-row\"><span class=\"lbl\">До</span><span class=\"val hl\">" + fmtDT(untilISO) + "</span></div>";
    if(reason) html += "<div class=\"info-row\"><span class=\"lbl\">Причина</span><span class=\"val\">" + esc(reason) + "</span></div>";
    html += "</div>";
    html += "<div class=\"countdown " + (isBan ? "err" : "warn") + "\" id=\"cd_remaining\">Осталось: " + fmtRemaining(untilMs-Date.now()) + "</div>";
  } else {
    if(reason) html += "<div class=\"info\"><div class=\"info-row\"><span class=\"lbl\">Причина</span><span class=\"val err\">" + esc(reason) + "</span></div></div>";
    html += "<div class=\"info\" style=\"background:rgba(224,92,92,0.08);border:1px solid rgba(224,92,92,0.15)\"><div style=\"font-size:13px;color:var(--err);text-align:center;line-height:1.5\">Бан бессрочный.<br>Снять можно только вручную.</div></div>";
  }
  html += "<div class=\"issue-hint\" style=\"margin-bottom:10px\">" + icoWrap(ICO.ban) + "<div>Выдача заблокирована.</div></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"openBlock(" + a.id + ")\">Управление</button><button class=\"btn btn-primary\" onclick=\"closeModal()\">Понятно</button></div>";
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
  if(!isPerm && untilMs){
    stopCountdown();
    window._cdTimer = setInterval(function(){
      var e = document.getElementById("cd_remaining");
      if(!e){ clearInterval(window._cdTimer); window._cdTimer = null; return; }
      var left = untilMs - Date.now();
      if(left <= 0){ clearInterval(window._cdTimer); window._cdTimer = null; e.textContent = "Истекло"; refreshNow(); return; }
      e.textContent = "Осталось: " + fmtRemaining(left);
    }, 1000);
  }
}

/* ============================================================
 * Категории
 * ============================================================ */

function createCategory(name){
  name = String(name == null ? "" : name).trim().slice(0, 80);
  if(!name){ toast("Введите имя категории", "err"); return null; }
  var low = name.toLowerCase();
  var dup = categories.filter(function(c){ return String(c.name||"").toLowerCase() === low; })[0];
  if(dup){ toast("Категория с таким именем уже есть", "err"); return null; }
  var nid = 0; categories.forEach(function(c){ if(c.id >= nid) nid = c.id+1; });
  if(nid === 0) nid = 1;
  var c = { id: nid, name: name, created_at: new Date().toISOString() };
  categories.push(c);
  persistCategories();
  addLog("Категория создана: " + name, "info");
  return c;
}

function renameCategory(id, newName){
  id = Number(id);
  newName = String(newName == null ? "" : newName).trim().slice(0, 80);
  if(!newName){ toast("Введите имя категории", "err"); return false; }
  var cat = getCategory(id);
  if(!cat){ toast("Категория не найдена", "err"); return false; }
  var low = newName.toLowerCase();
  var dup = categories.filter(function(c){ return c.id !== id && String(c.name||"").toLowerCase() === low; })[0];
  if(dup){ toast("Категория с таким именем уже есть", "err"); return false; }
  var oldName = cat.name;
  cat.name = newName;
  persistCategories();
  addLog("Категория переименована: " + oldName + " → " + newName, "info");
  return true;
}

function deleteCategory(id){
  id = Number(id);
  var cat = getCategory(id);
  if(!cat){ toast("Категория не найдена", "err"); return false; }
  confirmAction({
    title: "Удалить категорию?",
    text: "Категория «" + cat.name + "» будет удалена. Аккаунты останутся, но потеряют категорию. Продолжить?",
    ok: "Удалить",
    cb: function(){
      categories = categories.filter(function(c){ return c.id !== id; });
      accounts.forEach(function(a){ if(a.category_id === id) a.category_id = null; });
      persistCategories();
      persist();
      rebuildAccountIndex();
      if(String(currentCategoryFilter) === String(id)) currentCategoryFilter = "all";
      addLog("Категория удалена: " + cat.name, "warn");
      renderList();
      toast("Категория удалена", "ok");
    }
  });
  return true;
}

function openCategoryManager(){
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.folder) + "Категории</h2>";

  html += "<div class=\"field\"><label>Новая категория</label>";
  html += "<input id=\"cat_new_name\" type=\"text\" maxlength=\"80\" placeholder=\"Например: VIP\">";
  html += "<button class=\"btn btn-primary\" style=\"margin-top:8px;width:100%\" onclick=\"addCategoryFromForm()\">" + icoWrap(ICO.check) + " Добавить</button>";
  html += "</div>";

  var sorted = categories.slice().sort(function(a,b){ return (a.name||"").localeCompare(b.name||"","ru"); });
  if(sorted.length === 0){
    html += "<div class=\"empty\" style=\"padding:24px 20px\"><span class=\"ico-empty\">" + ICO.folder + "</span><div>Пока нет категорий. Создайте первую.</div></div>";
  } else {
    html += "<div class=\"field\"><label>Существующие</label>";
    sorted.forEach(function(c){
      var cnt = accounts.filter(function(a){ return a.category_id === c.id; }).length;
      html += "<div class=\"card\" data-cid=\"" + c.id + "\" style=\"margin-bottom:8px\">";
      html += "<div class=\"card-head\" style=\"margin-bottom:6px\">";
      html += "<input class=\"input inline\" id=\"cat_name_" + c.id + "\" type=\"text\" maxlength=\"80\" value=\"" + esc(c.name) + "\" style=\"font-weight:700\">";
      html += "</div>";
      html += "<div class=\"muted3\" style=\"margin-bottom:8px\">Аккаунтов: " + cnt + "</div>";
      html += "<div class=\"row tight\">";
      html += "<button class=\"btn btn-sm btn-ghost\" onclick=\"saveCategoryName(" + c.id + ")\">" + icoWrap(ICO.check) + " Сохранить</button>";
      html += "<button class=\"btn btn-sm btn-danger\" onclick=\"deleteCategory(" + c.id + ")\">" + icoWrap(ICO.trash) + " Удалить</button>";
      html += "</div>";
      html += "</div>";
    });
    html += "</div>";
  }

  html += "<div class=\"modal-actions\"><button class=\"btn btn-primary\" onclick=\"closeModal()\">Закрыть</button></div>";
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
}

function addCategoryFromForm(){
  var el = document.getElementById("cat_new_name");
  if(!el) return;
  var name = el.value;
  if(createCategory(name)){
    renderList();
    openCategoryManager();
    toast("Категория создана", "ok");
  }
}

function saveCategoryName(id){
  var el = document.getElementById("cat_name_" + id);
  if(!el) return;
  if(renameCategory(id, el.value)){
    renderList();
    openCategoryManager();
    toast("Категория переименована", "ok");
  }
}

/* ============================================================
 * История
 * ============================================================ */

function openHistory(){
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.history) + "История</h2>";

  if(actionLog.length === 0){
    html += "<div class=\"empty\" style=\"padding:40px 20px\"><span class=\"ico-empty\">" + ICO.empty + "</span><div>Пока ничего не происходило</div></div>";
    html += "<div class=\"modal-actions\"><button class=\"btn btn-primary\" onclick=\"closeModal()\">Закрыть</button></div></div></div>";
    document.getElementById("modals").innerHTML = html;
    return;
  }

  html += "<div class=\"field\"><label>Тип события</label>";
  html += "<select class=\"sort-select\" onchange=\"historyFilterKind=this.value;renderHistoryList()\">";
  html += "<option value=\"all\">Все</option>";
  html += "<option value=\"info\">Информация</option>";
  html += "<option value=\"ok\">Успех</option>";
  html += "<option value=\"warn\">Предупреждение</option>";
  html += "<option value=\"error\">Ошибки</option>";
  html += "</select></div>";

  html += "<div class=\"field\"><label>Аккаунт</label>";
  html += "<select class=\"sort-select\" onchange=\"historyFilterAccId=this.value;renderHistoryList()\">";
  html += "<option value=\"all\">Все</option>";
  var accIds = {};
  actionLog.forEach(function(h){ if(h && h.accId){ accIds[String(h.accId)] = true; } });
  var accList = [];
  Object.keys(accIds).forEach(function(id){
    var a = getAccount(id);
    if(a) accList.push({ id: id, name: a.name || ("#" + id) });
  });
  accList.sort(function(x, y){ return (x.name||"").localeCompare(y.name||"", undefined, { numeric:true, sensitivity:"base" }); });
  accList.forEach(function(x){
    html += "<option value=\"" + esc(x.id) + "\">" + esc(x.name) + "</option>";
  });
  html += "</select></div>";

  html += "<div id=\"historyListZone\"></div>";

  html += "<div class=\"modal-actions\">";
  html += "<button class=\"btn btn-ghost\" onclick=\"exportActionLog()\">" + icoWrap(ICO.down) + " Экспорт журнала</button>";
  html += "<button class=\"btn btn-danger\" onclick=\"clearLog()\">" + icoWrap(ICO.trash) + " Очистить</button>";
  html += "<button class=\"btn btn-primary\" onclick=\"closeModal()\">Закрыть</button></div>";
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;

  renderHistoryList();
}

function renderHistoryList(){
  var host = document.getElementById("historyListZone");
  if(!host) return;
  var filtered = actionLog.filter(function(h){
    if(!h) return false;
    var text = String(h.text||"");
    var cls = histKind(text, h.kind);
    var k = cls === "ok" ? "ok" : cls === "warn" ? "warn" : cls === "danger" ? "error" : "info";
    if(historyFilterKind !== "all" && k !== historyFilterKind) return false;
    if(historyFilterAccId !== "all"){
      var aid = (h.accId === null || h.accId === undefined || h.accId === "") ? null : String(h.accId);
      if(aid !== historyFilterAccId) return false;
    }
    return true;
  });
  if(filtered.length === 0){
    host.innerHTML = "<div class=\"empty\" style=\"padding:32px 20px\"><div>Нет событий по выбранному фильтру</div></div>";
    return;
  }
  var html = "<div class=\"history-list\">";
  filtered.forEach(function(h){
    var text = String(h.text||""); var cls = histKind(text, h.kind);
    html += "<div class=\"hist-item " + cls + "\"><div class=\"hist-dot\"></div><div><div class=\"htime\">" + esc(h.t) + "</div><div class=\"htext\">" + esc(text) + "</div></div></div>";
  });
  html += "</div>";
  host.innerHTML = html;
}

function histKind(t, kind){
  if(kind === "ok") return "ok";
  if(kind === "warn") return "warn";
  if(kind === "error") return "danger";
  if(kind === "info") return "";
  t = String(t || "");
  if(t.startsWith("Бан истёк") || t.startsWith("Кулдаун истёк") || t.startsWith("Бан снят") || t.startsWith("Кулдаун снят") || t.startsWith("Освобождён") || t.startsWith("Освобождено")) return "";
  if(t.startsWith("Бан") || t.startsWith("Удалён") || t.startsWith("Откат") || t.startsWith("Ошибка")) return "danger";
  if(t.startsWith("Кулдаун")) return "warn";
  if(t.startsWith("Выдан") || t.startsWith("Создан")) return "ok";
  return "";
}

function exportActionLog(){
  var data = {
    exported: new Date().toISOString(),
    brand: "United Gamers",
    kind: "action-log",
    entries: actionLog
  };
  var json = JSON.stringify(data, null, 2);
  var fn = "steamacc-log-" + new Date().toISOString().slice(0,10) + ".json";
  if(!downloadJson(fn, json)){
    var copied = copyText(json, "", "Журнал скопирован");
    if(copied) toast("Файл не сохранён. Журнал скопирован в буфер", "err");
    else toast("Не удалось экспортировать журнал", "err");
  } else {
    toast("Журнал экспортирован", "ok");
  }
}
function clearLog(){ actionLog = []; saveActionLog(); closeModal(); renderList(); toast("История очищена", "ok"); }

/* ============================================================
 * Меню (Настройки) + модалка горячих клавиш
 * ============================================================ */

function openMenu(){
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.settings) + "Настройки</h2>";
  html += "<div class=\"field\"><label>Категории</label>";
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"openCategoryManager()\">" + icoWrap(ICO.folder) + " Управление категориями</button>";
  html += "</div>";
  html += "<div class=\"field\"><label>Массовые действия</label>";
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"releaseAllBusy()\">" + icoWrap(ICO.unlock) + " Освободить все занятые</button>";
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"clearAllCooldowns()\">" + icoWrap(ICO.clock) + " Снять все кулдауны</button>";
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"clearAllBans()\">" + icoWrap(ICO.ban) + " Снять все баны</button>";
  html += "</div>";
  html += "<div class=\"field\"><label>Данные</label>";
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"exportData()\">" + icoWrap(ICO.down) + " Экспорт JSON</button>";
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"openImport()\">" + icoWrap(ICO.edit) + " Импорт JSON</button>";
  html += "<div class=\"issue-hint\" style=\"margin-top:8px\">" + icoWrap(ICO.info) + "<div>Данные хранятся локально в вашем браузере. Для переноса на другое устройство используйте экспорт/импорт.</div></div>";
  html += "</div>";
  var _sn = lsGetJson("undo_snap", null);
  if(_sn && _sn.label) html += "<div class=\"field\"><label>Откат</label><button class=\"btn btn-ghost menu-action\" onclick=\"rollbackSnap()\">" + icoWrap(ICO.history) + " Откатить: " + esc(_sn.label) + "</button></div>";
  html += "<div class=\"field\"><label>Интерфейс</label>";
  var _ui = lsGetJson("ui", {});
  var hintsEnabled = _ui.hintsBar === undefined ? true : !!_ui.hintsBar;
  html += "<button class=\"btn btn-ghost menu-action\" onclick=\"toggleHintsBar()\">" + icoWrap(ICO.help) + " Плашка подсказок: " + (hintsEnabled ? "включена" : "выключена") + "</button>";
  html += "</div>";
  html += "<div class=\"field\"><label>Информация</label><div class=\"app-info\">";
  html += "<div><span>Аккаунтов</span><b>" + accounts.length + "</b></div>";
  html += "<div><span>Категорий</span><b>" + categories.length + "</b></div>";
  html += "<div><span>Последний бэкап</span><b>" + esc(backupAgeStr()) + "</b></div>";
  html += "<div><span>Версия</span><b>PC-15.2</b></div>";
  html += "</div></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-primary\" onclick=\"closeModal()\">Закрыть</button></div></div></div>";
  document.getElementById("modals").innerHTML = html;
}

function toggleHintsBar(){
  var ui = lsGetJson("ui", {});
  var cur = ui.hintsBar === undefined ? true : !!ui.hintsBar;
  ui.hintsBar = !cur;
  lsSetJson("ui", ui);
  renderHintsBar();
  renderList();
}

function openHotkeysModal(){
  var rows = [
    { group: "Общие", items: [
      { keys: ["n"], desc: "Новый аккаунт" },
      { keys: ["/"], desc: "Фокус в поиск" },
      { keys: ["Esc"], desc: "Закрыть модалку / сбросить поиск" }
    ]},
    { group: "Навигация", items: [
      { keys: ["h"], desc: "История" },
      { keys: ["s"], desc: "Настройки" },
      { keys: ["g"], desc: "Управление категориями" },
      { keys: ["1"], desc: "Фильтр «Все»" },
      { keys: ["2"], desc: "Фильтр «Свободные»" },
      { keys: ["3"], desc: "Фильтр «Кулдаун»" },
      { keys: ["4"], desc: "Фильтр «Бан»" },
      { keys: ["5"], desc: "Фильтр «Занятые»" },
      { keys: ["←","→"], desc: "Фокус на предыдущий / следующий аккаунт" }
    ]},
    { group: "Действия с аккаунтом (курсор на аккаунте)", items: [
      { keys: ["e"], desc: "Редактировать" },
      { keys: ["i"], desc: "Выдать" },
      { keys: ["b"], desc: "Блокировка" },
      { keys: ["r"], desc: "Освободить" },
      { keys: ["d"], desc: "Удалить (с подтверждением)" }
    ]},
    { group: "Экспорт/импорт", items: [
      { keys: ["Shift","E"], desc: "Экспорт данных" },
      { keys: ["Shift","I"], desc: "Импорт данных" }
    ]},
    { group: "Помощь", items: [
      { keys: ["?"], desc: "Эта справка" }
    ]}
  ];
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.help) + "Горячие клавиши</h2>";
  html += "<div class=\"issue-hint\" style=\"margin-bottom:10px\">" + icoWrap(ICO.info) + "<div>Клавиши на аккаунт работают при наведённом курсоре. Раскладка латиница и кириллица поддерживаются.</div></div>";
  rows.forEach(function(g){
    html += "<div class=\"hk-group\">" + esc(g.group) + "</div>";
    g.items.forEach(function(it){
      var keysHtml = it.keys.map(function(k){ return "<span class=\"kbd\">" + esc(k) + "</span>"; }).join("<span style=\"opacity:.4;margin:0 2px\">+</span>");
      html += "<div class=\"hk-row\"><div class=\"hk-keys\">" + keysHtml + "</div><div class=\"hk-desc\">" + esc(it.desc) + "</div></div>";
    });
  });
  html += "<div class=\"modal-actions\"><button class=\"btn btn-primary\" onclick=\"closeModal()\">Понятно</button></div>";
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
}

/* ============================================================
 * Бэкап-напоминание
 * ============================================================ */

function maybeRemindBackup(){
  var days = -1;
  try{
    if(LAST_EXPORT){
      var t = Date.parse(LAST_EXPORT);
      if(!isNaN(t)) days = Math.floor((Date.now() - t) / 86400000);
    }
  }catch(e){}
  if(days < 0){ _pendingToast = "Бэкап ещё не делался — экспортируйте данные."; }
  else if(days > 7){ _pendingToast = "Бэкап: " + days + " дн. назад. Рекомендуется экспорт."; }
  if(_pendingToast){ setTimeout(function(){ if(_pendingToast){ toast(_pendingToast, "err"); _pendingToast = null; } }, 1200); }
}
function backupAgeStr(){
  if(!LAST_EXPORT) return "ни разу";
  var t = Date.parse(LAST_EXPORT); if(isNaN(t)) return "ни разу";
  var days = Math.floor((Date.now() - t) / 86400000);
  if(days <= 0) return "сегодня";
  if(days === 1) return "1 день назад";
  return days + " дн. назад";
}

/* ============================================================
 * Импорт/экспорт
 * ============================================================ */

function loadImportFile(inp){
  var f = inp.files && inp.files[0]; if(!f) return;
  if(f.size > 5e6){ toast("Файл слишком большой", "err"); return; }
  var r = new FileReader();
  r.onload = function(){ var t = document.getElementById("importJson"); if(t) t.value = String(r.result || ""); };
  r.readAsText(f);
}
function openImport(){
  window._importMode = "merge";
  var html = "<div class=\"modal-bg\" onclick=\"if(event.target===this)closeModal()\"><div class=\"modal\" onclick=\"event.stopPropagation()\">";
  html += "<h2>" + icoWrap(ICO.edit) + "Импорт JSON</h2>";
  html += "<div class=\"field\"><label>Режим импорта</label>";
  html += "<div class=\"type-tabs\">";
  html += "<button class=\"type-tab active\" data-mode=\"merge\" onclick=\"switchImportMode('merge')\">Добавить к текущим (слияние)</button>";
  html += "<button class=\"type-tab\" data-mode=\"replace\" onclick=\"switchImportMode('replace')\">Заменить всё</button>";
  html += "</div></div>";
  html += "<div class=\"field\"><label>Файл экспорта (.json)</label><input type=\"file\" accept=\".json,application/json\" onchange=\"loadImportFile(this)\"></div>";
  html += "<div class=\"field\"><label>…или вставьте JSON</label><textarea id=\"importJson\" rows=\"10\"></textarea></div>";
  html += "<div class=\"issue-hint\">" + icoWrap(ICO.info) + "<div id=\"importHint\">Слияние: совпадающие по логину и категории аккаунты будут обновлены, остальные — добавлены.</div></div>";
  html += "<div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeModal()\">Отмена</button><button class=\"btn btn-primary\" onclick=\"importData()\">Импортировать</button></div>";
  html += "</div></div>";
  document.getElementById("modals").innerHTML = html;
}
function switchImportMode(m){
  if(m !== "replace") m = "merge";
  window._importMode = m;
  var host = document.getElementById("modals");
  var tabs = host ? host.querySelectorAll(".type-tab[data-mode]") : [];
  for(var i = 0; i < tabs.length; i++){
    var t = tabs[i];
    if(t.getAttribute("data-mode") === m) t.classList.add("active");
    else t.classList.remove("active");
  }
  var hint = document.getElementById("importHint");
  if(hint) hint.textContent = (m === "replace")
    ? "Замена: текущий список аккаунтов будет потерян и полностью замещён данными из файла."
    : "Слияние: совпадающие по логину и категории аккаунты будут обновлены, остальные — добавлены.";
  vib("tick");
}

function importData(){
  var el = document.getElementById("importJson");
  if(!el || !el.value.trim()){ toast("Вставьте JSON", "err"); return; }
  var data = safeJson(el.value.trim(), null);
  if(!data || !Array.isArray(data.accounts)){ toast("Неверный формат JSON", "err"); return; }
  if(data.categories != null && !Array.isArray(data.categories)){ toast("Поле categories должно быть массивом", "err"); return; }

  var imported = [];
  var skipped = 0;
  data.accounts.forEach(function(raw){
    if(!isValidImportItem(raw)){ skipped++; return; }
    var n = normalizeAccount(raw); if(n) imported.push(n); else skipped++;
  });
  if(!imported.length){
    if(data.accounts.length){ toast("Не найдено корректных аккаунтов (пропущено " + skipped + ")", "err"); }
    else { toast("В файле нет аккаунтов для импорта", "err"); }
    return;
  }

  var seen = {}, mx = 0;
  imported.forEach(function(x){ if(x.id > mx) mx = x.id; });
  var dupNames = [], loginSeen = {};
  imported.forEach(function(x){
    if(!x.id || seen[x.id]) x.id = ++mx;
    seen[x.id] = 1;
    x.ban_until = cleanDate(x.ban_until); x.ban_ts = numOrNull(x.ban_until);
    x.cooldown_until = cleanDate(x.cooldown_until); x.cool_ts = numOrNull(x.cooldown_until);
    x.created_at = cleanDate(x.created_at);
    x.name = x.name.slice(0, 80); x.login = x.login.slice(0, 80); x.password = x.password.slice(0, 200); x.issued_to = x.issued_to.slice(0, 40);
    if(x.login){
      var k = loginCatKey(x.login, x.category_id);
      if(loginSeen[k]){ dupNames.push(x.name || ("#" + x.id)); x.login = ""; }
      else loginSeen[k] = 1;
    }
  });

  var cleanLog = null;
  if(Array.isArray(data.actionLog)){
    cleanLog = [];
    data.actionLog.slice(0, 50).forEach(function(it){
      if(it && typeof it === "object" && typeof it.t === "string" && typeof it.text === "string"){
        var k = (it.kind === "ok" || it.kind === "warn" || it.kind === "error" || it.kind === "info") ? it.kind : undefined;
        var aid = (it.accId === null || it.accId === undefined || it.accId === "") ? null : Number(it.accId);
        if(aid !== null && (isNaN(aid) || aid <= 0)) aid = null;
        var entry = { t: it.t.slice(0, 30), text: it.text.slice(0, 200) };
        if(k !== undefined) entry.kind = k;
        if(aid !== null) entry.accId = aid;
        cleanLog.push(entry);
      }
    });
  }

  var cleanCats = null;
  if(Array.isArray(data.categories)){
    cleanCats = [];
    data.categories.forEach(function(rc){
      var c = normalizeCategory(rc);
      if(c && c.name) cleanCats.push(c);
    });
  }

  var mode = (window._importMode === "replace") ? "replace" : "merge";

  if(mode === "merge"){
    var preview = previewMerge(imported);
    var msgM = "Текущих: " + accounts.length + "; добавится: " + preview.added + "; обновится: " + preview.updated + ".";
    if(skipped > 0) msgM += "\nПропущено некорректных: " + skipped + ".";
    if(dupNames.length > 0) msgM += "\nДубли (логин+категория) внутри файла обнулены у: " + dupNames.join(", ") + ".";
    if(cleanCats) msgM += "\nКатегорий в файле: " + cleanCats.length + ".";
    confirmAction({title:"Добавить к текущим?", text:msgM, ok:"Добавить", cb:function(){ applyImport(imported, cleanLog, cleanCats, "merge"); }});
  } else {
    var msgR = "Текущий список (" + accounts.length + ") будет потерян. Новых записей: " + imported.length + ".";
    if(skipped > 0) msgR += "\nПропущено некорректных: " + skipped + ".";
    if(dupNames.length > 0) msgR += "\nДубли (логин+категория) обнулены у: " + dupNames.join(", ") + ".";
    if(cleanCats) msgR += "\nКатегорий в файле: " + cleanCats.length + ".";
    confirmAction({title:"Заменить данные?", text:msgR, ok:"Заменить", cb:function(){ applyImport(imported, cleanLog, cleanCats, "replace"); }});
  }
}
function previewMerge(imported){
  var merged = mergeImported(imported);
  return { added: merged.added, updated: merged.updated };
}
function isValidImportItem(x){
  if(x === null || typeof x !== "object" || Array.isArray(x)) return false;
  if(Number(x.id) > 0) return true;
  if(x.name && String(x.name).trim()) return true;
  if(x.login && String(x.login).trim()) return true;
  if(x.password && String(x.password).trim()) return true;
  return false;
}
function cleanDate(v){ if(!v) return null; var t = Date.parse(v); return isNaN(t) ? null : new Date(t).toISOString(); }

function cloneAccount(src){
  return normalizeAccount(Object.assign({}, src));
}

function mergeImported(imported){
  var byKey = Object.create(null);
  var indexById = Object.create(null);
  var maxId = 0;
  var result = [];
  for(var i = 0; i < accounts.length; i++){
    var a = accounts[i];
    result.push(a);
    indexById[String(a.id)] = i;
    if(a.id > maxId) maxId = a.id;
    var k = loginCatKey(a.login, a.category_id);
    if(k && byKey[k] === undefined) byKey[k] = a;
  }

  var added = 0, updated = 0;

  for(var n = 0; n < imported.length; n++){
    var x = imported[n];
    var lk = loginCatKey(x.login, x.category_id);

    if(lk && byKey[lk] !== undefined){
      var target = byKey[lk];
      var clone = cloneAccount(target);
      clone.name = x.name;
      clone.login = x.login;
      clone.password = x.password;
      clone.category_id = x.category_id != null ? x.category_id : target.category_id;
      clone.ban_until = x.ban_until;
      clone.ban_ts = x.ban_ts;
      clone.ban_permanent = x.ban_permanent;
      clone.ban_reason = x.ban_reason;
      clone.cooldown_until = x.cooldown_until;
      clone.cool_ts = x.cool_ts;
      clone.cooldown_reason = x.cooldown_reason;
      clone.busy = x.busy;
      clone.busy_at = x.busy_at;
      clone.issued_to = x.issued_to;
      clone.created_at = x.created_at || target.created_at;
      var pos = indexById[String(target.id)];
      if(pos !== undefined) result[pos] = clone;
      var newKey = loginCatKey(clone.login, clone.category_id);
      if(newKey) byKey[newKey] = clone;
      updated++;
    } else {
      maxId++;
      var copy = normalizeAccount({
        id: maxId,
        name: x.name,
        login: x.login,
        password: x.password,
        category_id: x.category_id,
        ban_until: x.ban_until,
        ban_permanent: x.ban_permanent,
        ban_reason: x.ban_reason,
        cooldown_until: x.cooldown_until,
        cooldown_reason: x.cooldown_reason,
        busy: x.busy,
        busy_at: x.busy_at,
        issued_to: x.issued_to,
        created_at: x.created_at
      });
      result.push(copy);
      var copyKey = loginCatKey(copy.login, copy.category_id);
      if(copyKey) byKey[copyKey] = copy;
      added++;
    }
  }
  return { result: result, added: added, updated: updated };
}

function mapCategories(inCats, mode){
  if(!Array.isArray(inCats) || inCats.length === 0){
    if(mode === "replace"){ categories = []; persistCategories(); }
    return {};
  }
  var idMap = {};
  if(mode === "replace"){
    categories = [];
    var used = new Set();
    var maxId = 0;
    inCats.forEach(function(c){
      var n = normalizeCategory(c);
      if(!n || !n.name) return;
      if(!n.id || used.has(n.id)){ maxId++; n.id = maxId; }
      used.add(n.id);
      if(n.id > maxId) maxId = n.id;
      categories.push(n);
      idMap[c.id] = n.id;
    });
    persistCategories();
    return idMap;
  }
  inCats.forEach(function(c){
    var n = normalizeCategory(c);
    if(!n || !n.name) return;
    var low = n.name.toLowerCase();
    var existing = categories.filter(function(x){ return String(x.name||"").toLowerCase() === low; })[0];
    if(existing){
      idMap[c.id] = existing.id;
    } else {
      var nid = 0; categories.forEach(function(x){ if(x.id >= nid) nid = x.id+1; });
      if(nid === 0) nid = 1;
      var created = { id: nid, name: n.name, created_at: new Date().toISOString() };
      categories.push(created);
      idMap[c.id] = created.id;
    }
  });
  persistCategories();
  return idMap;
}

function applyImport(imported, logIn, inCats, mode){
  if(mode !== "merge") mode = "replace";
  takeSnapshot("Импорт");

  var catMap = mapCategories(inCats, mode);

  var finalList, added = 0, updated = 0;
  if(mode === "merge"){
    var merged = mergeImported(imported);
    finalList = merged.result;
    added = merged.added;
    updated = merged.updated;
  } else {
    finalList = imported;
  }

  for(var i=0;i<finalList.length;i++){
    var acc = finalList[i];
    if(acc.category_id != null && catMap[acc.category_id] != null){
      acc.category_id = catMap[acc.category_id];
    } else if(acc.category_id != null && inCats && inCats.length > 0 && catMap[acc.category_id] == null){
      acc.category_id = null;
    }
  }

  accounts = finalList;
  rebuildAccountIndex();
  revealedPasswords = {};
  issueDraft = {};
  window._issueCopied = null;
  window._issueId = null;
  _prevVisibleIds = new Set();
  if(logIn){ actionLog = logIn; saveActionLog(); }
  persist();
  closeModal(); renderList(); scheduleExpireCheck();
  if(mode === "merge"){ toast("Добавлено: " + added + ", обновлено: " + updated, "ok"); addLog("Импорт (слияние): добавлено " + added + ", обновлено " + updated, "info"); }
  else { toast("Импортировано: " + finalList.length, "ok"); addLog("Импорт (замена): " + finalList.length + " записей", "info"); }
}

function exportData(){
  confirmAction({title:"Экспорт с паролями", text:"Файл содержит пароли в открытом виде.", ok:"Экспортировать", cb:doExport});
}
function doExport(){
  var data = {
    exported: new Date().toISOString(),
    version: "PC-15.2",
    brand: "United Gamers",
    accounts: accounts,
    categories: categories,
    actionLog: actionLog.slice(0, 20)
  };
  var json = JSON.stringify(data, null, 2);
  var fn = "steamacc-backup-" + new Date().toISOString().slice(0,10) + ".json";
  var ok = downloadJson(fn, json);
  if(ok){
    saveLastExport();
    toast("Файл скачан", "ok");
  } else {
    var copied = copyText(json, "", "Экспорт скопирован");
    if(copied) toast("Не удалось скачать файл. Экспорт скопирован в буфер", "err");
    else toast("Не удалось экспортировать данные", "err");
  }
}

function confirmAction(o){
  window._cf = o.cb;
  var h = "<div class=\"modal-bg\"><div class=\"alert-modal warn\" style=\"max-width:400px\"><div class=\"icon\">" + icoWrap(ICO.info) + "</div><h2>" + esc(o.title) + "</h2><div class=\"info\" style=\"white-space:pre-wrap;font-size:13px;line-height:1.5\">" + esc(o.text) + "</div><div class=\"modal-actions\"><button class=\"btn btn-ghost\" onclick=\"closeModal()\">" + esc(o.no || "Отмена") + "</button><button class=\"btn btn-danger\" onclick=\"var f=window._cf;closeModal();if(f)f()\">" + esc(o.ok || "Да") + "</button></div></div></div>";
  document.getElementById("modals").innerHTML = h;
}

/* ============================================================
 * Snapshot / rollback
 * ============================================================ */

function takeSnapshot(label){
  try{
    var json = JSON.stringify({t: fmtDT(new Date().toISOString()), label: label, accounts: accounts, categories: categories});
    if(json.length > 1500000){ toast("Снимок слишком большой, пропущен", "err"); return; }
    lsSet("undo_snap", json);
  }catch(e){}
}
function rollbackSnap(){
  var sn = lsGetJson("undo_snap", null);
  if(!sn || !Array.isArray(sn.accounts)) return;
  confirmAction({title:"Откатить данные?", text:"Вернуть состояние на " + sn.t + " (до: " + sn.label + ").", ok:"Откатить", cb:function(){
    var list = sn.accounts.map(normalizeAccount).filter(Boolean);
    accounts = list;
    if(Array.isArray(sn.categories)){
      categories = sn.categories.map(normalizeCategory).filter(function(c){ return c && c.name; });
      persistCategories();
    }
    rebuildAccountIndex(); persist(); addLog("Откат: " + sn.label, "warn");
    closeModal(); renderList(); scheduleExpireCheck(); toast("Данные восстановлены", "ok");
  }});
}

/* ============================================================
 * Массовые действия
 * ============================================================ */

function runMassAction(label, predicate, mutateLocal){
  var n = accounts.filter(predicate).length;
  if(!n){ toast(label + ": нет подходящих", "err"); return; }
  confirmAction({title:label + "?", text:"Будет затронуто: " + n + ".", ok:"Выполнить", cb:function(){ takeSnapshot(label); doMassAction(label, predicate, mutateLocal); }});
}
function doMassAction(label, predicate, mutateLocal){
  var targets = accounts.filter(predicate);
  if(!targets.length){ toast(label + ": нет подходящих", "err"); return; }
  targets.forEach(mutateLocal);
  persist(); addLog(label + ": " + targets.length, "info");
  closeModal(); renderList(); scheduleExpireCheck();
  toast(label + ": " + targets.length, "ok");
}
function releaseAllBusy(){ runMassAction("Освобождено", function(a){ return Number(a.busy) === 1; }, function(a){ a.busy=0; a.busy_at=null; a.issued_to=""; }); }
function clearAllCooldowns(){ runMassAction("Снято кулдаунов", function(a){ return !!a.cool_ts; }, function(a){ a.cooldown_until=null; a.cool_ts=null; a.cooldown_reason=""; }); }
function clearAllBans(){ runMassAction("Снято банов", function(a){ return Number(a.ban_permanent)===1 || !!a.ban_ts; }, function(a){ a.ban_until=null; a.ban_ts=null; a.ban_permanent=0; a.ban_reason=""; }); }

/* ============================================================
 * Горячие клавиши
 * ============================================================ */

function visibleAccountIds(){
  var v = computeVisible();
  return v.map(function(a){ return a.id; });
}

function moveFocus(delta){
  var ids = visibleAccountIds();
  if(!ids.length) return;
  var curIdx = hoveredAccountId == null ? -1 : ids.indexOf(hoveredAccountId);
  var next = curIdx;
  if(next < 0) next = delta > 0 ? 0 : ids.length - 1;
  else next = (next + delta + ids.length) % ids.length;
  hoveredAccountId = ids[next];
  highlightHovered();
  var el = document.querySelector("[data-id=\"" + hoveredAccountId + "\"]");
  if(el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
}

document.addEventListener("keydown", function(e){
  var t = (e.target && e.target.id) || "";
  var tg = (e.target && e.target.tagName) || "";
  var inField = /^(INPUT|TEXTAREA|SELECT)$/.test(tg);
  var hasCtrl = e.ctrlKey || e.metaKey || e.altKey;
  var m = document.getElementById("modals");
  var mOpen = m && m.innerHTML.trim().length > 0;

  if(e.key === "Escape"){
    if(t === "searchInput" && currentSearch){ e.preventDefault(); clearSearch(); return; }
    if(mOpen){
      e.preventDefault();
      if(window._issueId && m.innerHTML.indexOf("issue_to") > -1) closeIssue(window._issueId);
      else closeModal();
      return;
    }
  }

  if(e.key === "Enter" && /^f_(name|login|pass)$/.test(t || "")){ e.preventDefault(); saveAccount(window._editId); return; }

  if(inField) return;

  if(!mOpen && (e.key === "?" || (e.shiftKey && e.key === "/"))){
    e.preventDefault();
    openHotkeysModal();
    return;
  }

  if(!mOpen){
    if(e.key === "n" || e.key === "N" || e.key === "т" || e.key === "Т"){ e.preventDefault(); openEdit(null); return; }
    if(e.key === "/" || e.key === "."){ var si = document.getElementById("searchInput"); if(si){ e.preventDefault(); si.focus(); } return; }
  }

  if(mOpen || hasCtrl) return;

  if(e.key === "h" || e.key === "H" || e.key === "р" || e.key === "Р"){ e.preventDefault(); openHistory(); return; }
  if(e.key === "s" || e.key === "S" || e.key === "ы" || e.key === "Ы"){ e.preventDefault(); openMenu(); return; }
  if(e.key === "g" || e.key === "G" || e.key === "п" || e.key === "П"){ e.preventDefault(); openCategoryManager(); return; }

  if(e.shiftKey && (e.key === "E" || e.key === "У")){ e.preventDefault(); exportData(); return; }
  if(e.shiftKey && (e.key === "I" || e.key === "Ш")){ e.preventDefault(); openImport(); return; }

  if(e.key === "1"){ e.preventDefault(); currentFilter = "all"; vib("tick"); renderList(); return; }
  if(e.key === "2"){ e.preventDefault(); setFilter("free"); return; }
  if(e.key === "3"){ e.preventDefault(); setFilter("cool"); return; }
  if(e.key === "4"){ e.preventDefault(); setFilter("ban"); return; }
  if(e.key === "5"){ e.preventDefault(); setFilter("busy"); return; }

  if(e.key === "ArrowLeft"){ e.preventDefault(); moveFocus(-1); return; }
  if(e.key === "ArrowRight"){ e.preventDefault(); moveFocus(1); return; }

  var act = null;
  if(e.key === "e" || e.key === "E" || e.key === "у" || e.key === "У") act = "edit";
  else if(e.key === "i" || e.key === "I" || e.key === "ш" || e.key === "Ш") act = "issue";
  else if(e.key === "b" || e.key === "B" || e.key === "и" || e.key === "И") act = "block";
  else if(e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") act = "release";
  else if(e.key === "d" || e.key === "D" || e.key === "в" || e.key === "В") act = "delete";

  if(act){
    if(hoveredAccountId === null) return;
    e.preventDefault();
    if(act === "edit") openEdit(hoveredAccountId);
    else if(act === "issue") tryIssue(hoveredAccountId);
    else if(act === "block") openBlock(hoveredAccountId);
    else if(act === "release") releaseAccount(hoveredAccountId);
    else if(act === "delete") confirmDelete(hoveredAccountId);
  }
});

/* ============================================================
 * Визибилити и storage events
 * ============================================================ */

window.addEventListener("visibilitychange", function(){
  isAppVisible = document.visibilityState !== "hidden";
  if(!isAppVisible){
    revealedPasswords = {};
    stopRefreshLoop();
    stopCountdown();
    if(_expireTimer){ clearTimeout(_expireTimer); _expireTimer = null; }
  } else {
    autoExpireBlocks(true);
    refreshNow();
    startRefreshLoop();
  }
});

window.addEventListener("storage", function(e){
  if(!e || !e.key) return;
  if(e.key === "ug:data_rev"){
    var newRev = Number(e.newValue || 0) || 0;
    if(newRev === _dataRev) return;
    toast("Данные обновлены из другой вкладки");
    loadCategories();
    loadAccounts(true);
    _dataRev = newRev;
    renderList();
    return;
  }
  if(e.key === "ug:categories"){
    loadCategories();
    if(currentCategoryFilter !== "all" && currentCategoryFilter !== "none"){
      var still = categories.some(function(c){ return String(c.id) === currentCategoryFilter; });
      if(!still){ currentCategoryFilter = "all"; }
    }
    renderList();
    return;
  }
  if(e.key === "ug:view"){
    var v = e.newValue;
    if(v === "table" || v === "cards"){ currentView = v; renderList(); }
    return;
  }
  if(e.key === "ug:last_export"){ if(e.newValue) LAST_EXPORT = String(e.newValue); return; }
  if(e.key === "ug:actionLog"){
    var log = safeJson(e.newValue || "[]", []);
    if(Array.isArray(log)) actionLog = log;
    return;
  }
});

var _wasT = tableMode();
window.addEventListener("resize", function(){ var t = tableMode(); if(t !== _wasT){ _wasT = t; renderList(); } });
window.addEventListener("beforeunload", function(){
  if(refreshTimer) clearInterval(refreshTimer);
  if(_expireTimer) clearTimeout(_expireTimer);
  if(_clipClearTimer) clearTimeout(_clipClearTimer);
  stopCountdown();
});

/* ============================================================
 * Инициализация
 * ============================================================ */

function init(){
  var ui = lsGetJson("ui", {});
  if(ui && ui.categoryFilter) currentCategoryFilter = String(ui.categoryFilter);

  loadCategories();

  if(currentCategoryFilter !== "all" && currentCategoryFilter !== "none"){
    var still = categories.some(function(c){ return String(c.id) === currentCategoryFilter; });
    if(!still) currentCategoryFilter = "all";
  }

  loadActionLog();
  loadLastExport();
  loadAccounts();
  _dataRev = Number(lsGet("data_rev") || 0) || 0;
  buildApp();
  renderList();
  startRefreshLoop();
  scheduleExpireCheck();
  maybeRemindBackup();
}

init();
