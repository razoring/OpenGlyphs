const csInterface = new CSInterface();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const URL = require('url').URL;

var proxyPort = 0;
const iframe = document.getElementById('browserView');
const statusDiv = document.getElementById('debugStatus');
const urlInput = document.getElementById('urlInput');

urlInput.value = 'https://fonts.google.com/icons';

// ── Injected Script ─────────────────────────────────────────────────
// Runs inside the proxied iframe. Built as an array of single-quoted
// lines joined by newlines to avoid nested-template-literal escaping.
var INJECTED_SCRIPT = [
'<script>',

// ── state & toggle ──
'var _hl=true;',
'window.addEventListener("message",function(e){',
'  if(e.data&&e.data.type==="toggle-highlight"){',
'    _hl=e.data.value;',
'    if(!_hl)document.querySelectorAll("[data-ai-hover]").forEach(function(x){x.removeAttribute("data-ai-hover");});',
'  }',
'});',
'window.parent.postMessage({type:"request-highlight-state"},"*");',

// ── css ──
'var _css=document.createElement("style");',
'_css.textContent="' +
    '*[data-ai-hover]{outline:3px dashed #ff00ff!important;outline-offset:-3px!important;cursor:pointer!important;background-color:rgba(255,0,255,.08)!important}' +
    '#ai-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#fff;padding:8px 16px;border-radius:6px;font:13px sans-serif;z-index:999999;pointer-events:none;opacity:0;transition:opacity .3s}' +
    '#ai-toast.show{opacity:1}' +
'";',
'document.head.appendChild(_css);',

// ── toast ──
'var _t=document.createElement("div");_t.id="ai-toast";document.body.appendChild(_t);',
'function _toast(m,err){_t.textContent=m;_t.style.background=err?"#a00":"#0a0";_t.classList.add("show");setTimeout(function(){_t.classList.remove("show");},2000);}',

// ── kill native drag ──
'document.addEventListener("dragstart",function(e){e.preventDefault();e.stopPropagation();},true);',

// ── hover ──
'document.body.addEventListener("mouseover",function(e){if(!_hl)return;if(e.target&&e.target!==document.body)e.target.setAttribute("data-ai-hover","1");});',
'document.body.addEventListener("mouseout",function(e){if(!_hl)return;if(e.target)e.target.removeAttribute("data-ai-hover");});',

// ── inline all computed styles onto a cloned tree ──
'function _inlineStyles(src,dst){',
'  try{',
'    var cs=window.getComputedStyle(src);',
'    for(var k=0;k<cs.length;k++){var p=cs[k];dst.style.setProperty(p,cs.getPropertyValue(p));}',
'  }catch(e){}',
'  var sc=src.children,dc=dst.children;',
'  for(var j=0;j<sc.length&&j<dc.length;j++)_inlineStyles(sc[j],dc[j]);',
'}',

// ── capture any element as PNG via foreignObject ──
'function _capture(el){',
'  _toast("Capturing element...");',
'  var rect=el.getBoundingClientRect();',
'  if(rect.width<1||rect.height<1){_toast("Element has no visible size",true);return;}',
'  var clone=el.cloneNode(true);',
'  clone.removeAttribute("data-ai-hover");',
'  clone.querySelectorAll("[data-ai-hover]").forEach(function(x){x.removeAttribute("data-ai-hover");});',
'  _inlineStyles(el,clone);',
// reset position so it renders at origin inside the foreignObject
'  clone.style.position="static";',
'  clone.style.margin="0";',
'  clone.style.transform="none";',
'  var w=Math.ceil(rect.width);',
'  var h=Math.ceil(rect.height);',
'  var xmlns="http://www.w3.org/2000/svg";',
'  var xhtml="http://www.w3.org/1999/xhtml";',
'  var svgStr="<svg xmlns=\\""+xmlns+"\\" width=\\""+w+"\\" height=\\""+h+"\\"><foreignObject width=\\"100%\\" height=\\"100%\\"><body xmlns=\\""+xhtml+"\\" style=\\"margin:0;padding:0;\\">"+new XMLSerializer().serializeToString(clone)+"</body></foreignObject></svg>";',
'  var blob=new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"});',
'  var blobUrl=window.URL.createObjectURL(blob);',
'  var img=new Image();',
'  img.onload=function(){',
'    var dpr=2;',
'    var c=document.createElement("canvas");c.width=w*dpr;c.height=h*dpr;',
'    var ctx=c.getContext("2d");ctx.scale(dpr,dpr);',
'    try{ctx.drawImage(img,0,0);var data=c.toDataURL("image/png");window.parent.postMessage({type:"import-dataurl",data:data},"*");_toast("Captured element!");}',
'    catch(ex){',
// fallback: send the raw SVG foreignObject (illustrator can still place it)
'      window.parent.postMessage({type:"import-svg",data:svgStr},"*");_toast("Captured as SVG!");',
'    }',
'    window.URL.revokeObjectURL(blobUrl);',
'  };',
'  img.onerror=function(){',
'    window.parent.postMessage({type:"import-svg",data:svgStr},"*");_toast("Captured as SVG (fallback)!");',
'    window.URL.revokeObjectURL(blobUrl);',
'  };',
'  img.src=blobUrl;',
'}',

// ── main click handler — tries best extraction, falls back to capture ──
'function _send(el){',
// 1. direct SVG
'  var s=el.closest("svg");if(s){window.parent.postMessage({type:"import-svg",data:s.outerHTML},"*");return _toast("Sent SVG!");}',
// 2. direct IMG
'  var im=el.closest("img");if(im&&im.src){window.parent.postMessage({type:"import-url",data:im.src},"*");return _toast("Sent Image!");}',
// 3. Google Material font icons
'  var fontIco=el.closest(".material-symbols-outlined,.material-symbols-rounded,.material-symbols-sharp,.material-icons");',
'  if(fontIco){',
'    var n=fontIco.textContent.trim().toLowerCase().replace(/\\s+/g,"_");',
'    var fam="materialsymbolsoutlined";',
'    if(fontIco.classList.contains("material-symbols-rounded"))fam="materialsymbolsrounded";',
'    else if(fontIco.classList.contains("material-symbols-sharp"))fam="materialsymbolssharp";',
'    else if(fontIco.classList.contains("material-icons"))fam="materialicons";',
'    var u="https://fonts.gstatic.com/s/i/short-term/release/"+fam+"/"+n+"/default/48px.svg";',
'    window.parent.postMessage({type:"import-url",data:u},"*");return _toast("Google Icon!");',
'  }',
// 4. Object embed
'  var ob=el.closest("object");if(ob&&ob.data){window.parent.postMessage({type:"import-url",data:ob.data},"*");return _toast("Sent Object!");}',
// 5. CSS background-image
'  var bg=window.getComputedStyle(el).backgroundImage;',
'  if(bg&&bg!=="none"){',
'    var m=bg.match(/url\\(["\'\\s]*(.*?)["\'\\s]*\\)/);',
'    if(m&&m[1]){window.parent.postMessage({type:"import-url",data:m[1]},"*");return _toast("Sent BG Image!");}',
'  }',
// 6. link wrapping an asset
'  var a=el.closest("a");if(a&&a.href&&/\\.(svg|png|jpe?g|webp|gif)$/i.test(a.href)){window.parent.postMessage({type:"import-url",data:a.href},"*");return _toast("Sent Link Asset!");}',
// 7. child SVG or IMG inside clicked container
'  var cSvg=el.querySelector("svg");if(cSvg){window.parent.postMessage({type:"import-svg",data:cSvg.outerHTML},"*");return _toast("Sent Inner SVG!");}',
'  var cImg=el.querySelector("img");if(cImg&&cImg.src){window.parent.postMessage({type:"import-url",data:cImg.src},"*");return _toast("Sent Inner Image!");}',
// 8. FALLBACK: capture any element as rasterized PNG with full styles
'  _capture(el);',
'}',

// ── click listener ──
'document.body.addEventListener("click",function(e){',
'  if(!_hl)return;',
'  e.preventDefault();e.stopPropagation();',
'  _send(e.target);',
'},true);',

'<\/script>'
].join('\n');

// ── Local Proxy Server ──────────────────────────────────────────────
var proxyServer = http.createServer(function(req, res) {
    var query = new URL(req.url, 'http://localhost:' + proxyPort).searchParams;
    var targetUrl = query.get('url');

    if (!targetUrl) {
        res.writeHead(400);
        return res.end('No URL provided');
    }

    var client = targetUrl.startsWith('https') ? https : http;

    var options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'identity'
        }
    };

    client.get(targetUrl, options, function(targetRes) {
        if (targetRes.statusCode >= 300 && targetRes.statusCode < 400 && targetRes.headers.location) {
            var redirectUrl = targetRes.headers.location;
            if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, targetUrl).href;
            res.writeHead(302, { 'Location': 'http://localhost:' + proxyPort + '/?url=' + encodeURIComponent(redirectUrl) });
            return res.end();
        }

        var headers = Object.assign({}, targetRes.headers);
        delete headers['x-frame-options'];
        delete headers['content-security-policy'];
        delete headers['access-control-allow-origin'];

        if (headers['content-type'] && headers['content-type'].indexOf('text/html') !== -1) {
            delete headers['content-encoding'];
            delete headers['content-length'];

            res.writeHead(targetRes.statusCode, headers);
            var htmlData = '';
            targetRes.on('data', function(chunk) { htmlData += chunk; });
            targetRes.on('end', function() {
                var baseTag = '<base href="' + targetUrl + '">';
                if (htmlData.indexOf('<head>') !== -1) {
                    htmlData = htmlData.replace('<head>', '<head>\n' + baseTag);
                } else {
                    htmlData = baseTag + htmlData;
                }

                if (htmlData.indexOf('</body>') !== -1) {
                    htmlData = htmlData.replace('</body>', INJECTED_SCRIPT + '\n</body>');
                } else {
                    htmlData += INJECTED_SCRIPT;
                }
                res.end(htmlData);
            });
        } else {
            res.writeHead(targetRes.statusCode, headers);
            targetRes.pipe(res);
        }
    }).on('error', function(err) {
        res.writeHead(500);
        res.end('Proxy Error: ' + err.message);
    });
});

window.addEventListener('beforeunload', function() { proxyServer.close(); });

proxyServer.listen(0, function() {
    proxyPort = proxyServer.address().port;
    statusDiv.innerHTML = 'Proxy on port ' + proxyPort + ' — click any element to import.';
    statusDiv.style.background = '#0a0';
    loadUrl(urlInput.value);
});

function loadUrl(url) {
    if (url.indexOf('http') !== 0) url = 'https://' + url;
    iframe.src = 'http://localhost:' + proxyPort + '/?url=' + encodeURIComponent(url);
}

// ── UI Navigation ───────────────────────────────────────────────────
document.getElementById('goBtn').addEventListener('click', function() { loadUrl(urlInput.value); });
urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('goBtn').click();
});

// ── Toggle highlight button ─────────────────────────────────────────
var isHighlightActive = true;
var toggleBtn = document.getElementById('toggleHighlightBtn');
toggleBtn.classList.add('active');

toggleBtn.addEventListener('click', function() {
    isHighlightActive = !isHighlightActive;
    if (isHighlightActive) {
        toggleBtn.classList.add('active');
        toggleBtn.style.background = '#0070d6';
    } else {
        toggleBtn.classList.remove('active');
        toggleBtn.style.background = '#666';
    }
    iframe.contentWindow.postMessage({ type: 'toggle-highlight', value: isHighlightActive }, '*');
});

// ── Message handler ─────────────────────────────────────────────────
window.addEventListener('message', function(event) {
    var d = event.data;
    if (!d || !d.type) return;

    if (d.type === 'request-highlight-state') {
        iframe.contentWindow.postMessage({ type: 'toggle-highlight', value: isHighlightActive }, '*');
    } else if (d.type === 'import-svg') {
        sendRawSvgToIllustrator(d.data);
    } else if (d.type === 'import-url') {
        downloadAndImport(d.data);
    } else if (d.type === 'import-dataurl') {
        sendDataUrlToIllustrator(d.data);
    }
});

// ── Import helpers ──────────────────────────────────────────────────

function handleAiResponse(res) {
    if (res && res.indexOf('Error') === 0) {
        alert('Illustrator Import Failed:\n' + res);
    }
}

function sendRawSvgToIllustrator(svgString) {
    if (svgString.indexOf('<?xml') !== 0) svgString = '<?xml version="1.0" encoding="utf-8"?>\n' + svgString;
    var dest = path.join(os.tmpdir(), 'og_asset_' + Date.now() + '.svg');
    fs.writeFileSync(dest, svgString, 'utf8');
    var escaped = dest.replace(/\\/g, '\\\\');
    csInterface.evalScript('importAsset("' + escaped + '")', handleAiResponse);
}

function sendDataUrlToIllustrator(dataUrl) {
    // strip the data:image/png;base64, prefix
    var base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    var buf = Buffer.from(base64, 'base64');
    var dest = path.join(os.tmpdir(), 'og_capture_' + Date.now() + '.png');
    fs.writeFileSync(dest, buf);
    var escaped = dest.replace(/\\/g, '\\\\');
    csInterface.evalScript('importAsset("' + escaped + '")', handleAiResponse);
}

function downloadAndImport(url) {
    var ext = '.svg';
    try { ext = path.extname(new URL(url).pathname) || '.svg'; } catch(e) {}
    var dest = path.join(os.tmpdir(), 'og_dl_' + Date.now() + ext);
    var file = fs.createWriteStream(dest);
    var client = url.startsWith('https') ? https : http;

    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function(response) {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            var redirectUrl = response.headers.location;
            if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, url).href;
            file.close();
            return downloadAndImport(redirectUrl);
        }
        response.pipe(file);
        file.on('finish', function() {
            file.close();
            var escaped = dest.replace(/\\/g, '\\\\');
            csInterface.evalScript('importAsset("' + escaped + '")', handleAiResponse);
        });
    }).on('error', function(err) {
        alert('Download failed: ' + err.message);
    });
}
