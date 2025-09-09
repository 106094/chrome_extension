// popup.js — reads a direct download URL from Google Sheets and downloads it

document.addEventListener('DOMContentLoaded', () => {
  const downloadButton = document.getElementById('downloadButton');
  const spreadsheetIdInput = document.getElementById('spreadsheetId');
  const rangeInput = document.getElementById('range');
  const statusDiv = document.getElementById('status');

  downloadButton.addEventListener('click', run);

  async function run() {
    const spreadsheetId = (spreadsheetIdInput.value || '').trim();
    const range = (rangeInput.value || '').trim();

    if (!spreadsheetId || !range) {
      return updateStatus('Please enter both Spreadsheet ID and a cell range.');
    }

    updateStatus('Authenticating...');
    try {
      let accessToken = await getAuthToken();

      updateStatus('Reading download URL from Google Sheets…');
      const downloadUrlRaw = await getDownloadUrlFromSheets(accessToken, spreadsheetId, range);
      if (!downloadUrlRaw) {
        return updateStatus('No URL found in the specified cell.');
      }

      const downloadUrl = normalizeDownloadUrl(downloadUrlRaw);

      updateStatus('Starting download…');
      await startDownload(downloadUrl);

      updateStatus('Download started. Closing in 5s…');
      setTimeout(() => window.close(), 5000);
    } catch (err) {
      console.error(err);
      updateStatus(`Error: ${err.message}`);
    }
  }

  function updateStatus(msg) {
    statusDiv.textContent = msg;
  }

  function getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!token) return reject(new Error('Failed to get auth token.'));
        resolve(token);
      });
    });
  }

  async function getDownloadUrlFromSheets(accessToken, spreadsheetId, range) {
    const encRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encRange}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sheets API error: ${res.status} - ${text}`);
    }
    const data = await res.json();
    return data.values?.[0]?.[0] || null;
  }

  function startDownload(downloadUrl) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: downloadUrl,
          saveAs: false // no "Save As" dialog; Chrome will keep the original filename
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!downloadId) {
            reject(new Error('Failed to initiate download.'));
          } else {
            resolve(downloadId);
          }
        }
      );
    });
  }

  // Convert common share links into direct-download links
  function normalizeDownloadUrl(urlStr) {
    try {
      const u = new URL(urlStr);

      // Google Drive shared link → convert to direct download
      const fileIdMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (u.hostname.includes('drive.google.com') && fileIdMatch?.[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
      const idParam = u.searchParams.get('id');
      if (u.hostname.includes('drive.google.com') && idParam) {
        return `https://drive.google.com/uc?export=download&id=${idParam}`;
      }
      if (u.hostname.includes('drive.google.com') && u.pathname.startsWith('/uc')) {
        u.searchParams.set('export', 'download');
        return u.toString();
      }

      // Dropbox → force direct download
      if (u.hostname.includes('dropbox.com')) {
        u.searchParams.set('dl', '1');
        return u.toString();
      }

      return urlStr;
    } catch {
      return urlStr;
    }
  }
});
