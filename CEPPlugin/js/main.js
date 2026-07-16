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

// ── Injected Script (array of single-quoted lines) ─────
var INJECTED_SCRIPT = [
'<script>',
'var _hl=true;',
'window.addEventListener("message",function(e){',
'  if(e.data&&e.data.type==="toggle-highlight"){',
'    _hl=e.data.value;',
'    if(!_hl)document.querySelectorAll("[data-ai-hover]").forEach(function(x){x.removeAttribute("data-ai-hover");});',
'  }',
'});',
'window.parent.postMessage({type:"request-highlight-state"},"*");',
'var _host=document.createElement("div");_host.id="og-host";_host.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;";',
'var _shadow=_host.attachShadow({mode:"closed"});',
'var _css=document.createElement("style");',
'_css.textContent="#ai-toast{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:#fff;padding:8px 16px;border-radius:6px;font:13px sans-serif;opacity:0;transition:opacity .3s}#ai-toast.show{opacity:1} #ai-box{position:absolute;outline:3px dashed #ff00ff;outline-offset:-3px;display:none;transition:all 0.05s linear;}";',
'var _t=document.createElement("div");_t.id="ai-toast";',
'var _box=document.createElement("div");_box.id="ai-box";',
'_shadow.appendChild(_css);_shadow.appendChild(_box);_shadow.appendChild(_t);',
'function _ensureDom(){',
'  if(!document.getElementById("og-host") && document.documentElement) document.documentElement.appendChild(_host);',
'}',
'setInterval(_ensureDom, 500);',
'_ensureDom();',
'function _toast(m,err){_t.textContent=m;_t.style.background=err?"#a00":"#0a0";_t.classList.add("show");setTimeout(function(){_t.classList.remove("show");},2000);}',
'',
'var _currT=null;',
'window.addEventListener("pointerover",function(e){if(!_hl||!e.target||e.target===document.body||e.target===document.documentElement)return;_currT=e.target;var r=e.target.getBoundingClientRect();_box.style.left=r.left+"px";_box.style.top=r.top+"px";_box.style.width=r.width+"px";_box.style.height=r.height+"px";_box.style.display="block";},true);',
'window.addEventListener("pointerout",function(e){if(!_hl)return;if(e.target===_currT){_box.style.display="none";_currT=null;}},true);',
'window.addEventListener("scroll",function(e){if(_currT){var r=_currT.getBoundingClientRect();_box.style.left=r.left+"px";_box.style.top=r.top+"px";}},true);',
'',
'function _captureVector(el){',
'  _toast("Capturing vector...");',
'  var rect=el.getBoundingClientRect();',
'  if(rect.width<1||rect.height<1){_toast("No visible size",true);return;}',
'  var svgStr="<svg xmlns=\\"http://www.w3.org/2000/svg\\" xmlns:xlink=\\"http://www.w3.org/1999/xlink\\" width=\\""+rect.width+"\\" height=\\""+rect.height+"\\" viewBox=\\"0 0 "+rect.width+" "+rect.height+"\\">";',
'  function draw(node,ox,oy){',
'    if(node.nodeType===3){',
'      var txt=node.textContent.trim();',
'      if(!txt)return;',
'      var cs=window.getComputedStyle(node.parentNode);',
'      var r=document.createRange();r.selectNodeContents(node);',
'      var tr=r.getBoundingClientRect();',
'      var pad=15, dpr=8, maxDim=4000;',
'      var cW = tr.width + pad*2, cH = tr.height + pad*2;',
'      if (cW * dpr > maxDim) dpr = maxDim / cW;',
'      if (cH * dpr > maxDim) dpr = Math.min(dpr, maxDim / cH);',
'      dpr = Math.max(1, dpr);',
'      var c=document.createElement("canvas");',
'      c.width=cW*dpr;',
'      c.height=cH*dpr;',
'      var ctx=c.getContext("2d");',
'      ctx.scale(dpr,dpr);',
'      ctx.textBaseline="middle";',
'      ctx.font=cs.fontWeight+" "+parseFloat(cs.fontSize)+"px "+cs.fontFamily;',
'      ctx.fillStyle=cs.color;',
'      ctx.fillText(txt, pad, pad + (tr.height/2));',
'      var dataUrl=c.toDataURL("image/png");',
'      c.width=0;c.height=0; // forcefully free memory',
'      var ix=(tr.left-ox)-pad, iy=(tr.top-oy)-pad, iw=tr.width+pad*2, ih=tr.height+pad*2;',
'      svgStr+="<image id=\\"ai-trace-me-"+Math.random().toString(36).substr(2,5)+"\\" x=\\""+ix+"\\" y=\\""+iy+"\\" width=\\""+iw+"\\" height=\\""+ih+"\\" xlink:href=\\""+dataUrl+"\\" />";',
'    }else if(node.nodeType===1){',
'      if(node.hasAttribute("data-ai-hover"))return;',
'      var cs=window.getComputedStyle(node);',
'      var nr=node.getBoundingClientRect();',
'      if(nr.width===0||nr.height===0||cs.display==="none"||cs.opacity==="0"||cs.visibility==="hidden")return;',
'      var x=nr.left-ox,y=nr.top-oy,w=nr.width,h=nr.height;',
'      var rx=parseFloat(cs.borderTopLeftRadius)||0;',
'      rx=Math.min(rx, w/2, h/2);',
'      var fill=(cs.backgroundColor&&cs.backgroundColor!=="rgba(0, 0, 0, 0)"&&cs.backgroundColor!=="transparent")?cs.backgroundColor:"none";',
'      var bw=parseFloat(cs.borderTopWidth)||0;',
'      var stroke=(cs.borderStyle!=="none"&&bw>0&&cs.borderColor)?cs.borderColor:"none";',
'      if(fill!=="none"||stroke!=="none"){',
'        var ix=x+bw/2,iy=y+bw/2,iw=w-bw,ih=h-bw,irx=Math.max(0,rx-bw/2);',
'        svgStr+="<rect x=\\""+ix+"\\" y=\\""+iy+"\\" width=\\""+iw+"\\" height=\\""+ih+"\\" fill=\\""+fill+"\\" stroke=\\""+stroke+"\\" stroke-width=\\""+bw+"\\" rx=\\""+irx+"\\" />";',
'      }',
'      var tag=node.tagName.toLowerCase();',
'      if(tag==="svg"){',
'        var c=node.cloneNode(true);',
'        c.setAttribute("x",x);c.setAttribute("y",y);c.setAttribute("width",w);c.setAttribute("height",h);',
'        svgStr+=c.outerHTML;',
'        return;',
'      }else if(tag==="img"&&node.src){',
'        try{',
'          var ic=document.createElement("canvas");',
'          ic.width=node.naturalWidth||node.width||w;ic.height=node.naturalHeight||node.height||h;',
'          ic.getContext("2d").drawImage(node,0,0,ic.width,ic.height);',
'          svgStr+="<image x=\\""+x+"\\" y=\\""+y+"\\" width=\\""+w+"\\" height=\\""+h+"\\" xlink:href=\\""+ic.toDataURL("image/png")+"\\" />";',
'        }catch(e){',
'          svgStr+="<image x=\\""+x+"\\" y=\\""+y+"\\" width=\\""+w+"\\" height=\\""+h+"\\" xlink:href=\\""+node.src+"\\" />";',
'        }',
'        return;',
'      }',
'      for(var i=0;i<node.childNodes.length;i++)draw(node.childNodes[i],ox,oy);',
'    }',
'  }',
'  draw(el,rect.left,rect.top);',
'  svgStr+="</svg>";',
'  window.parent.postMessage({type:"import-svg",data:svgStr},"*");',
'  _toast("Captured Vector SVG!");',
'}',

'function _send(el){',
'  if (!el || !el.closest) return;',
'  var s=el.closest("svg");if(s){window.parent.postMessage({type:"import-svg",data:s.outerHTML},"*");return _toast("Sent Native SVG!");}',
'  if(el.tagName&&el.tagName.toLowerCase()==="img"&&el.src){',
'    var c=document.createElement("canvas");c.width=el.naturalWidth||el.width;c.height=el.naturalHeight||el.height;',
'    var ctx=c.getContext("2d");',
'    try{ctx.drawImage(el,0,0);window.parent.postMessage({type:"import-dataurl",data:c.toDataURL("image/png")},"*");return _toast("Sent Image!");}',
'    catch(e){window.parent.postMessage({type:"import-url",data:el.src},"*");return _toast("Sent Image URL!");}',
'  }',
'  _captureVector(el);',
'}',

'window.addEventListener("click",function(e){',
'  if(_hl){ e.preventDefault();e.stopPropagation();_send(e.target); }',
'},true);',
'window.addEventListener("click",function(e){',
'  if(!_hl && !e.defaultPrevented){',
'    var a=e.target.closest("a");',
'    if(a && a.href && a.href.indexOf("javascript:")!==0){',
'      e.preventDefault();',
'      window.parent.postMessage({type:"navigate", url: a.href}, "*");',
'    }',
'  }',
'},false);',
'<\/script>'
].join('\n');

// ── Local Proxy Server ──────────────────────────────────────────────
var proxyServer = http.createServer(function(req, res) {
    var query = new URL(req.url, 'http://localhost:' + proxyPort).searchParams;
    var targetUrl = query.get('url');
    if (!targetUrl) { res.writeHead(400); return res.end('No URL'); }

    var client = targetUrl.startsWith('https') ? https : http;
    var options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'identity'
        }
    };

    client.get(targetUrl, options, function(targetRes) {
        if (targetRes.statusCode >= 300 && targetRes.statusCode < 400 && targetRes.headers.location) {
            var redir = targetRes.headers.location;
            if (!redir.startsWith('http')) redir = new URL(redir, targetUrl).href;
            res.writeHead(302, { 'Location': 'http://localhost:' + proxyPort + '/?url=' + encodeURIComponent(redir) });
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
            var html = '';
            targetRes.on('data', function(c) { html += c; });
            targetRes.on('end', function() {
                var base = '<base href="' + targetUrl + '">';
                html = html.replace(/<meta[^>]+http-equiv=['"]?Content-Security-Policy['"]?[^>]*>/gi, '');
                html = html.indexOf('<head>') !== -1 ? html.replace('<head>', '<head>\n' + base) : base + html;
                html = html.indexOf('</body>') !== -1 ? html.replace('</body>', INJECTED_SCRIPT + '\n</body>') : html + INJECTED_SCRIPT;
                res.end(html);
            });
        } else {
            res.writeHead(targetRes.statusCode, headers);
            targetRes.pipe(res);
        }
    }).on('error', function(err) { res.writeHead(500); res.end('Proxy Error: ' + err.message); });
});

window.addEventListener('beforeunload', function() { proxyServer.close(); });

proxyServer.listen(0, function() {
    proxyPort = proxyServer.address().port;
    statusDiv.innerHTML = 'Port ' + proxyPort + ' — click or drag elements to import';
    statusDiv.style.background = '#0a0';
    loadUrl(urlInput.value);
});

function loadUrl(url) {
    if (url.indexOf('http') !== 0) url = 'https://' + url;
    iframe.src = 'http://localhost:' + proxyPort + '/?url=' + encodeURIComponent(url);
}

// ── UI ──────────────────────────────────────────────────────────────
document.getElementById('goBtn').addEventListener('click', function() { loadUrl(urlInput.value); });
urlInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') document.getElementById('goBtn').click(); });

var isHighlightActive = true;
var toggleBtn = document.getElementById('toggleHighlightBtn');
toggleBtn.classList.add('active');
toggleBtn.addEventListener('click', function() {
    isHighlightActive = !isHighlightActive;
    toggleBtn.classList.toggle('active', isHighlightActive);
    toggleBtn.style.background = isHighlightActive ? '#0070d6' : '#666';
    iframe.contentWindow.postMessage({ type: 'toggle-highlight', value: isHighlightActive }, '*');
});

// ── Message handler ─────────────────────────────────────────────────
window.addEventListener('message', function(event) {
    var d = event.data;
    if (!d || !d.type) return;
    if (d.type === 'request-highlight-state') iframe.contentWindow.postMessage({ type: 'toggle-highlight', value: isHighlightActive }, '*');
    else if (d.type === 'import-svg') sendRawSvgToIllustrator(d.data);
    else if (d.type === 'import-url') downloadAndImport(d.data);
    else if (d.type === 'import-dataurl') sendDataUrlToIllustrator(d.data);
    else if (d.type === 'navigate') { urlInput.value = d.url; loadUrl(d.url); }
});

function handleAiResponse(res) {
    if (res && res.indexOf('Error') === 0) alert('Import Failed:\n' + res);
}

function sendRawSvgToIllustrator(svgString) {
    if (svgString.indexOf('<?xml') !== 0) svgString = '<?xml version="1.0" encoding="utf-8"?>\n' + svgString;
    var dest = path.join(os.tmpdir(), 'og_' + Date.now() + '.svg');
    fs.writeFileSync(dest, svgString, 'utf8');
    csInterface.evalScript('importAsset("' + dest.replace(/\\/g, '\\\\') + '")', handleAiResponse);
}

function sendDataUrlToIllustrator(dataUrl) {
    var base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    var dest = path.join(os.tmpdir(), 'og_cap_' + Date.now() + '.png');
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
    csInterface.evalScript('importAsset("' + dest.replace(/\\/g, '\\\\') + '")', handleAiResponse);
}

function downloadAndImport(url) {
    var client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, function(response) {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            var redir = response.headers.location;
            if (!redir.startsWith("http")) redir = new URL(redir, url).href;
            return downloadAndImport(redir);
        }
        var ct = (response.headers["content-type"] || "").toLowerCase();
        var ext = ""; try { ext = path.extname(new URL(url).pathname).toLowerCase(); } catch(e) {}
        var isSvg = ct.indexOf("svg") !== -1 || ext === ".svg";
        var destExt = isSvg ? ".svg" : ".tmp";
        var dest = path.join(os.tmpdir(), "og_dl_" + Date.now() + destExt);
        var file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on("finish", function() {
            file.close();
            if (!isSvg) {
                var img = new Image();
                img.onload = function() {
                    var c = document.createElement("canvas");
                    c.width = img.width || 1; c.height = img.height || 1;
                    c.getContext("2d").drawImage(img, 0, 0);
                    sendDataUrlToIllustrator(c.toDataURL("image/png"));
                };
                img.onerror = function() {
                    csInterface.evalScript('importAsset("' + dest.replace(/\\/g, '\\\\\\\\') + '")', handleAiResponse);
                };
                img.src = "file:///" + dest.replace(/\\/g, "/");
            } else {
                csInterface.evalScript('importAsset("' + dest.replace(/\\/g, '\\\\\\\\') + '")', handleAiResponse);
            }
        });
    }).on("error", function(err) { alert("Download failed: " + err.message); });
}
