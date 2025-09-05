// === Your existing helpers ===
function sanitize(name) { return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120); }
function nowStamp() {
  const d = new Date(); const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
async function getLastFocusedNormalWinAndTab() {
  let win = null;
  try { win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }); } catch {}
  if (!win) return { winId: null, tab: null };
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return { winId: win.id, tab: tab || null };
}
async function savePng(filenameBase, dataUrl) {
  await chrome.downloads.download({ url: dataUrl, filename: `${sanitize(filenameBase)}.png` });
}

// === New: open minimal collector (no "Open About Version" button) ===
async function openCollector(base, shotOK) {
  const url = chrome.runtime.getURL("collector.html") +
    "?base=" + encodeURIComponent(base) +
    "&shot=" + (shotOK ? "1" : "0");
  await chrome.windows.create({ url, type: "popup", width: 460, height: 540, focused: true });
}

// === One-click flow: save PNG (your method) 竊� open collector ===
async function runOnce() {
  const { winId, tab } = await getLastFocusedNormalWinAndTab();
  if (!winId) return;

  const stamp = nowStamp();
  const title = tab?.title || "page";
  const base = `${title} ${stamp}`;

  let shotOK = false;
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(winId, { format: "png" });
    if (dataUrl && dataUrl.startsWith("data:image/png")) {
      await savePng(base, dataUrl);
      shotOK = true;
    }
  } catch (e) {
    // expected to fail on chrome://, Web Store, PDFs; TXT will still work
  }

  await openCollector(base, shotOK);
}

// Click the icon 竊� run the flow
chrome.action.onClicked.addListener(runOnce);