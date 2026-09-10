/**
 * The pre-paint preference stamp.
 *
 * Deliberately NOT a "use client" module: `app/layout.tsx` is a server
 * component, and importing this from a client module made Next replace the
 * export with its boundary stub — so the inline script the browser received
 * was literally `function(){ throw new Error("Attempted to call
 * PREPAINT_PREFS() from the server...") }`. That threw before anything else
 * in the same tag ran, which also killed the ws-intro-done stamp
 * concatenated after it, leaving every navigation replaying the rise
 * animations (found 2026-09-10 chasing a scroll glitch).
 *
 * Keep this file free of imports from client modules.
 */

export const PREFS_CACHE_KEY = "ws-prefs-v1";

/**
 * Runs synchronously before first paint, off the localStorage cache, so a
 * person who needs 150% type never sees a frame of 100%. Mirrors
 * applyPrefsToDocument() in preferences.ts — change both together.
 */
export const PREPAINT_PREFS = `try{var c=JSON.parse(localStorage.getItem("${PREFS_CACHE_KEY}")||"{}"),a=c.a11y||{},h=document.documentElement,m=function(q){return window.matchMedia&&window.matchMedia(q).matches};
var s=a.textScale;s=(s==null||s==="auto")?1:Math.max(.9,Math.min(1.75,s/100));h.style.setProperty("--ws-fs",String(s));
var ct=a.chatTextScale;h.style.setProperty("--ws-fs-chat",(ct==null||ct==="match")?"1":String(ct/100));
var t=function(v,q){return v==="on"||((v==null||v==="auto")&&m(q))};
if(t(a.contrast,"(prefers-contrast: more)"))h.dataset.wsContrast="more";
if(t(a.reduceMotion,"(prefers-reduced-motion: reduce)"))h.dataset.wsMotion="reduce";
if(a.colorVision&&a.colorVision!=="off")h.dataset.wsCv=a.colorVision;
if(a.nonColorCues||(a.colorVision&&a.colorVision!=="off"))h.dataset.wsCues="1";
if(a.boldText)h.dataset.wsBold="1";
if(a.reduceTransparency)h.dataset.wsFlat="1";
if(a.underlineLinks||(a.colorVision&&a.colorVision!=="off"))h.dataset.wsUnderline="1";
var dv=(c.data||{}).saver;var nc=navigator.connection||{};
if(dv==="on"||((dv==null||dv==="auto")&&(nc.saveData||/(^|-)2g$/.test(nc.effectiveType||""))))h.dataset.wsSaver="1";}catch(e){}`;
