const csInterface = new CSInterface();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const URL = require('url').URL;

let proxyPort = 0; // Will be assigned dynamically
const iframe = document.getElementById('browserView');
const statusDiv = document.getElementById('debugStatus');
const urlInput = document.getElementById('urlInput');

urlInput.value = "https://fonts.google.com/icons"; // Default to Google Icons

// Injected Script: This runs inside the iframe
const INJECTED_SCRIPT = `
<script>
    const style = document.createElement('style');
    style.innerHTML = \`
        *[data-ai-hover="true"] {
            outline: 3px dashed #ff00ff !important;
            outline-offset: -3px !important;
            cursor: grab !important;
            background-color: rgba(255, 0, 255, 0.1) !important;
        }
    \`;
    document.head.appendChild(style);

    document.body.addEventListener('mouseover', (e) => {
        if (e.target && e.target !== document.body) e.target.setAttribute('data-ai-hover', 'true');
    });
    document.body.addEventListener('mouseout', (e) => {
        if (e.target) e.target.removeAttribute('data-ai-hover');
    });

    const sendToHost = (el) => {
        const svg = el.closest('svg');
        const img = el.closest('img');
        if (svg) {
            window.parent.postMessage({ type: 'import-svg', data: svg.outerHTML }, '*');
        } else if (img && img.src) {
            window.parent.postMessage({ type: 'import-url', data: img.src }, '*');
        } else {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
                const match = bg.match(/url\\(['"]?(.*?)['"]?\\)/);
                if (match && match[1]) window.parent.postMessage({ type: 'import-url', data: match[1] }, '*');
            }
        }
    };

    document.body.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        sendToHost(e.target);
    }, true);
    
    document.body.addEventListener('dragstart', (e) => e.dataTransfer.effectAllowed = 'copy');
    document.body.addEventListener('dragend', (e) => sendToHost(e.target));
</script>
`;

// Create the Local Proxy Server
const proxyServer = http.createServer((req, res) => {
    const query = new URL(req.url, \`http://localhost:\${proxyPort}\`).searchParams;
    let targetUrl = query.get('url');
    
    if (!targetUrl) {
        res.writeHead(400);
        return res.end("No URL provided");
    }

    const client = targetUrl.startsWith('https') ? https : http;
    
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'identity'
        }
    };
    
    const request = client.get(targetUrl, options, (targetRes) => {
        // If it's a redirect, we should ideally follow it, but for now we'll just pass it through 
        // or let the iframe handle it (though the iframe will navigate away from the proxy).
        if (targetRes.statusCode >= 300 && targetRes.statusCode < 400 && targetRes.headers.location) {
            let redirectUrl = targetRes.headers.location;
            if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, targetUrl).href;
            res.writeHead(302, { 'Location': \`http://localhost:\${proxyPort}/?url=\${encodeURIComponent(redirectUrl)}\` });
            return res.end();
        }

        const headers = { ...targetRes.headers };
        delete headers['x-frame-options'];
        delete headers['content-security-policy'];
        delete headers['access-control-allow-origin'];
        
        // Remove content-encoding so we don't send compressed data if we modify it
        if (headers['content-type'] && headers['content-type'].includes('text/html')) {
            delete headers['content-encoding'];
            delete headers['content-length']; // Length will change
            
            res.writeHead(targetRes.statusCode, headers);
            let htmlData = '';
            targetRes.on('data', chunk => htmlData += chunk);
            targetRes.on('end', () => {
                const baseTag = \`<base href="\${targetUrl}">\`;
                if (htmlData.includes('<head>')) {
                    htmlData = htmlData.replace('<head>', \`<head>\n\${baseTag}\`);
                } else {
                    htmlData = baseTag + htmlData;
                }
                
                if (htmlData.includes('</body>')) {
                    htmlData = htmlData.replace('</body>', \`\${INJECTED_SCRIPT}\n</body>\`);
                } else {
                    htmlData += INJECTED_SCRIPT;
                }
                res.end(htmlData);
            });
        } else {
            res.writeHead(targetRes.statusCode, headers);
            targetRes.pipe(res);
        }
    }).on('error', (err) => {
        res.writeHead(500);
        res.end("Proxy Error: " + err.message);
    });
});

// Close old server if we reload the script (though mostly handled by dynamic port now)
window.addEventListener("beforeunload", () => proxyServer.close());

// Use port 0 to automatically find an available port
proxyServer.listen(0, () => {
    proxyPort = proxyServer.address().port;
    statusDiv.innerHTML = \`Proxy active on port \${proxyPort}. Ready to load pages.\`;
    statusDiv.style.background = "#0a0";
    loadUrl(urlInput.value);
});

function loadUrl(url) {
    if (!url.startsWith('http')) url = 'https://' + url;
    iframe.src = \`http://localhost:\${proxyPort}/?url=\${encodeURIComponent(url)}\`;
}

document.getElementById('goBtn').addEventListener('click', () => loadUrl(urlInput.value));
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('goBtn').click();
});

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'import-svg') {
        sendRawSvgToIllustrator(event.data.data);
    } else if (event.data && event.data.type === 'import-url') {
        downloadAndImport(event.data.data);
    }
});

function sendRawSvgToIllustrator(svgString) {
    if (!svgString.startsWith('<?xml')) svgString = '<?xml version="1.0" encoding="utf-8"?>\n' + svgString;
    const dest = path.join(os.tmpdir(), 'dragged_asset_' + Date.now() + '.svg');
    fs.writeFileSync(dest, svgString, 'utf8');
    csInterface.evalScript(\`importAsset("\${dest.replace(/\\\\/g, '\\\\\\\\')}")\`);
}

function downloadAndImport(url) {
    const dest = path.join(os.tmpdir(), 'downloaded_asset_' + Date.now() + path.extname(new URL(url).pathname || '.svg'));
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            let redirectUrl = response.headers.location;
            if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, url).href;
            return downloadAndImport(redirectUrl);
        }
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            csInterface.evalScript(\`importAsset("\${dest.replace(/\\\\/g, '\\\\\\\\')}")\`);
        });
    });
}
