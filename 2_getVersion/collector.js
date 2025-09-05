function sanitize(name){return name.replace(/[\\/:*?"<>|]+/g,"_").slice(0,120)}
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`}
function tryDownload(req){return new Promise((resolve,reject)=>{chrome.downloads.download(req,(id)=>{const err=chrome.runtime.lastError;if(err||!id)return reject(err?.message||"no download id");resolve(id);});});}

async function saveTextFile(filenameBase,text){
  const url="data:text/plain;charset=utf-8,"+encodeURIComponent(text);
  try{
    return await tryDownload({url,filename:`${sanitize(filenameBase)}.txt`,conflictAction:"uniquify"});
  }catch(e){
    return await tryDownload({url,filename:`${sanitize(filenameBase)}.txt`,saveAs:true});
  }
}

function getLine(name,text){const m=text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`,"mi"));return m?m[1].trim():null}
function normalizeFields(raw){const f={},want=["Platform","Version","OS","User Agent","Firmware Version","Customization ID","Customization Id"];for(const k of want){const v=getLine(k,raw);if(v)f[k]=v}if(!f["Customization ID"]&&f["Customization Id"]){f["Customization ID"]=f["Customization Id"];delete f["Customization Id"]}return f}
function buildTxt(meta,raw,screenshotName){const f=normalizeFields(raw||"");const lines=[`Title: ${meta.title}`,`URL: ${meta.url}`,`When: ${new Date().toISOString()}`,`Screenshot: ${screenshotName||"N/A"}`,f["Platform"]?`Platform: ${f["Platform"]}`:null,f["Version"]?`Version: ${f["Version"]}`:null,f["OS"]?`OS: ${f["OS"]}`:null,f["User Agent"]?`User Agent: ${f["User Agent"]}`:null,f["Firmware Version"]?`Firmware Version: ${f["Firmware Version"]}`:null,f["Customization ID"]?`Customization ID: ${f["Customization ID"]}`:null,"","---- RAW CLIPBOARD ----",raw||""].filter(Boolean);return lines.join("\n")}

// trace-safe: if download already finished before we attach the listener, resolve immediately
function getDownloadState(id){
  return new Promise((resolve)=>chrome.downloads.search({id}, (items)=>{
    const err=chrome.runtime.lastError; if(err||!items||!items[0]) return resolve(null);
    resolve(items[0].state); // "in_progress" | "complete" | "interrupted"
  }));
}
function waitForDownloadComplete(id, timeoutMs=5000){
  return new Promise(async (resolve)=>{
    const done = (s)=>{ try{chrome.downloads.onChanged.removeListener(onChanged);}catch{} resolve(s); };
    // if already finished, resolve now
    const initial = await getDownloadState(id);
    if (initial === "complete" || initial === "interrupted") return done(initial);

    function onChanged(delta){
      if (delta.id === id && delta.state){
        const s = delta.state.current;
        if (s === "complete" || s === "interrupted") done(s);
      }
    }
    chrome.downloads.onChanged.addListener(onChanged);
    // fail-safe timeout so the window doesn't get stuck
    setTimeout(()=>done("timeout"), timeoutMs);
  });
}

const params=new URLSearchParams(location.search);
const base=params.get("base")||`capture ${stamp()}`;
const shot=params.get("shot")==="1";
const screenshotName=shot?`${sanitize(base)}.png`:"N/A";

const $done=document.getElementById("done"),
      $status=document.getElementById("status"),
      $out=document.getElementById("out"),
      $shot=document.getElementById("shot");
if ($shot) $shot.textContent = base;

$done.onclick=async()=>{
  $status.textContent="Reading clipboard...";
  try{
    const raw=await navigator.clipboard.readText();
    if(!raw){ $status.textContent="Clipboard empty. Copy, then click Done."; return; }
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    const title=(tab?.title)||"page"; const url=(tab?.url)||"";
    const txt=buildTxt({title,url}, raw, screenshotName);
    $out.textContent=txt;

    $status.textContent = "Saving...";
    const id = await saveTextFile(base, txt);           
    await waitForDownloadComplete(id);                 
    window.close();
  }catch(e){
    $status.textContent="Clipboard read blocked. Copy again then click Done.";
  }
};
