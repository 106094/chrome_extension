// shot.js - interval capture with hidden download shelf and session log file
(function(){
  const $interval = document.getElementById("interval");
  const $duration = document.getElementById("duration");
  const $prefix   = document.getElementById("prefix");
  const $start    = document.getElementById("start");
  const $stop     = document.getElementById("stop");
  const $log      = document.getElementById("log");

  let mediaStream = null;
  let video = null;
  let timer = null;
  let endAt = 0;
  let shotCount = 0;
  let currentPrefix = "desktop";
  let runId = "";       // start-time prefix for the session (YYYYMMDD-HHMMSS)
  let logLines = [];    // accumulated log lines

  function nowISO(){ return new Date().toISOString(); }
  function ts() {
  const d = new Date();
  const p2 = n => String(n).padStart(2, "0");
  const p3 = n => String(n).padStart(3, "0"); // ms
  const yy = String(d.getFullYear()).slice(-2);
  return `${yy}${p2(d.getMonth()+1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}${p3(d.getMilliseconds())}`;
}

  function addLog(msg){
    const line = `[${nowISO()}] ${msg}`;
    console.log("[panel]", msg);
    logLines.push(line);
    if ($log) {
      $log.textContent += ($log.textContent ? "\n" : "") + line;
      $log.scrollTop = $log.scrollHeight;
    }
  }

  function downloadsSave(url, filename, conflictAction){
    return new Promise((resolve) => {
      chrome.downloads.download({ url, filename, saveAs:false, conflictAction: conflictAction || "uniquify" }, (id) => {
        const err = chrome.runtime.lastError?.message || null;
        resolve({ id, err });
      });
    });
  }

  async function saveTextFile(baseName, text, overwrite=false){
    const url = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    const filename = `DesktopScreenshots/${baseName}.log`;
    // Try overwrite to keep a single log file name
    const { id, err } = await downloadsSave(url, filename, overwrite ? "overwrite" : "uniquify");
    if (!id && err) {
      // fallback to Save As once
      return new Promise((resolve)=>{
        chrome.downloads.download({ url, filename, saveAs:true }, ()=> resolve());
      });
    }
  }

  function buildRunHeader(intervalMs, durationMs){
    return [
      `SESSION: ${runId}`,
      `PREFIX: ${currentPrefix}`,
      `INTERVAL_MS: ${intervalMs}`,
      `DURATION_MS: ${durationMs}`,
      `SAVE_DIR: Downloads/DesktopScreenshots`,
      ""
    ].join("\n");
  }

  async function saveSessionLog(final=false){
    const content = logLines.join("\n") + (final ? "\n-- END --\n" : "");
    await saveTextFile(`${runId}-${currentPrefix}`, content, /*overwrite*/ true);
  }

  function tsName(){ return `${currentPrefix}-${ts()}`; }

  async function saveBlob(blob, baseName){
    const url = URL.createObjectURL(blob);
    const filename = `DesktopScreenshots/${baseName}.png`; // under Downloads/
    const t0 = performance.now();
    let res = await downloadsSave(url, filename, "uniquify");
    if (res.err || !res.id) {
      // fall back to Save As
      await new Promise((resolve)=> chrome.downloads.download({ url, filename, saveAs:true }, ()=> resolve() ));
      addLog(`SAVED (Save As) -> ${filename}`);
    } else {
      const dt = Math.round(performance.now() - t0);
      addLog(`SAVED -> ${filename} (id ${res.id}, ${dt}ms)`);
    }
    try { URL.revokeObjectURL(url); } catch {}
  }

  async function grabOnce(){
    if (!video || !video.videoWidth) return;
    const t0 = performance.now();
    const w = video.videoWidth, h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const name = tsName();
    const t1 = performance.now();
    addLog(`SHOT ${++shotCount} -> ${name}.png (capture ${(t1 - t0).toFixed(0)}ms, ${w}x${h})`);
    await saveBlob(blob, name);
  }

  async function startWithStream(streamId, intervalSec, durationMin, prefix){
    await stopCapture(); // ensure clean
    currentPrefix = (prefix && prefix.trim()) ? prefix.trim() : "desktop";
    runId = ts(); // start-time prefix
    logLines = [];
    shotCount = 0;

    // Hide downloads shelf while capturing
    chrome.runtime.sendMessage({ type: "set-shelf", hide: true });

    const intervalMs = Math.max(250, (intervalSec|0) * 1000);
    const durationMs = Math.max(1, (durationMin|0)) * 1000;

    // Header in log
    addLog(buildRunHeader(intervalMs, durationMs));

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } }
      });
    } catch (e) {
      addLog("ERROR: getUserMedia failed: " + e);
      chrome.runtime.sendMessage({ type: "set-shelf", hide: false });
      return;
    }

    video = document.createElement("video");
    video.srcObject = mediaStream;
    await new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
    // Warm-up to avoid 0x0
    await new Promise(r => requestAnimationFrame(()=> setTimeout(r, 150)));

    addLog("START");

    endAt = Date.now() + durationMs;

    // First shot immediately
    try { await grabOnce(); } catch (e) { addLog("ERROR during first shot: " + e); }

    // Interval loop
    timer = setInterval(async () => {
      if (Date.now() >= endAt) {
        await stopCapture();
        addLog("FINISHED - duration reached");
        await saveSessionLog(true);
        chrome.runtime.sendMessage({ type: "set-shelf", hide: false });
        try { window.close(); } catch {}
        return;
      }
      try { await grabOnce(); } catch (e) { addLog("ERROR during shot: " + e); }
    }, intervalMs);
  }

  async function stopCapture(){
    try { clearInterval(timer); } catch {}
    timer = null;
    try { mediaStream?.getTracks().forEach(t => t.stop()); } catch {}
    mediaStream = null;
    video = null;
  }

  function startFlow(){
    const interval = Math.max(1, parseInt($interval.value, 10) || 0);
    const duration = Math.max(1, parseInt($duration.value, 10) || 0);
    const prefix = $prefix.value || "desktop";

    addLog("Opening desktop picker...");
    chrome.desktopCapture.chooseDesktopMedia(["screen","window"], (streamId) => {
      addLog("Picker returned: " + (streamId ? "OK" : "cancelled"));
      if (!streamId) return;
      startWithStream(streamId, interval, duration, prefix);
    });
  }

  $start.addEventListener("click", startFlow);
  $stop.addEventListener("click", async () => {
    await stopCapture();
    addLog("STOP pressed - capture halted");
    await saveSessionLog(true);
    chrome.runtime.sendMessage({ type: "set-shelf", hide: false });
  });
})();