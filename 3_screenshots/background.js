// background.js - opens a roomy panel and toggles the download shelf on request
console.log("[bg] alive");

chrome.action.onClicked.addListener(async () => {
  await chrome.windows.create({
    url: chrome.runtime.getURL("shot.html"),
    type: "popup",
    width: 960,
    height: 760,
    focused: true
  });
});

// Toggle the downloads shelf (hide while capturing)
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req && req.type === "set-shelf") {
    try {
      if (chrome.downloads && chrome.downloads.setShelfEnabled) {
        chrome.downloads.setShelfEnabled(req.hide === true ? false : true);
        console.log("[bg] setShelfEnabled:", req.hide === true ? "HIDE" : "SHOW");
      } else {
        console.warn("[bg] setShelfEnabled not available on this build");
      }
    } catch (e) {
      console.warn("[bg] setShelfEnabled threw:", e);
    }
    sendResponse && sendResponse({ ok: true });
    return true;
  }
});