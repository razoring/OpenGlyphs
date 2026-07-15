const csInterface = new CSInterface();
const iframe = document.getElementById('browserView');

// Handle URL navigation
document.getElementById('goBtn').addEventListener('click', () => {
    const url = document.getElementById('urlInput').value;
    
    // basic protocol handling
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        iframe.src = 'https://' + url;
        document.getElementById('urlInput').value = 'https://' + url;
    } else {
        iframe.src = url;
    }
});

// Allow Enter key to trigger Go
document.getElementById('urlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('goBtn').click();
    }
});

iframe.addEventListener('load', () => {
    try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Inject CSS for the bounding box
        const style = iframeDoc.createElement('style');
        style.innerHTML = `
            *[data-ai-hover="true"] {
                outline: 3px dashed #ff00ff !important;
                outline-offset: -3px !important;
                cursor: grab !important;
                background-color: rgba(255, 0, 255, 0.1) !important;
            }
        `;
        iframeDoc.head.appendChild(style);

        // Hover bounding box logic
        iframeDoc.body.addEventListener('mouseover', (e) => {
            if (e.target && e.target !== iframeDoc.body) {
                e.target.setAttribute('data-ai-hover', 'true');
            }
        });
        iframeDoc.body.addEventListener('mouseout', (e) => {
            if (e.target) {
                e.target.removeAttribute('data-ai-hover');
            }
        });

        // Function to extract and send element data
        const processElement = (el) => {
            // Find closest SVG or IMG
            const svg = el.closest('svg');
            const img = el.closest('img');
            
            if (svg) {
                // It's an SVG, we can send the raw XML
                sendRawSvgToIllustrator(svg.outerHTML);
            } else if (img && img.src) {
                // It's an image, download it
                downloadAndImport(img.src);
            } else {
                // Fallback: try to find a background image or just ignore
                const bg = iframeDoc.defaultView.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none') {
                    const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
                    if (match && match[1]) {
                        downloadAndImport(match[1]);
                    }
                }
            }
        };

        // Click to import
        iframeDoc.body.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            processElement(e.target);
        }, true);

        // Drag to import (triggers on dragend, simulating a drop onto the artboard)
        iframeDoc.body.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'copy';
        });
        
        iframeDoc.body.addEventListener('dragend', (e) => {
            processElement(e.target);
        });

    } catch (err) {
        console.log("CORS prevented iframe access. Please ensure --disable-web-security is active.", err);
    }
});

function sendRawSvgToIllustrator(svgString) {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Add XML declaration if missing
    if (!svgString.startsWith('<?xml')) {
        svgString = '<?xml version="1.0" encoding="utf-8"?>\n' + svgString;
    }

    const tempDir = os.tmpdir();
    const filename = 'dragged_asset_' + Date.now() + '.svg';
    const dest = path.join(tempDir, filename);
    
    fs.writeFileSync(dest, svgString, 'utf8');
    console.log('SVG written to: ' + dest);
    
    const jsPath = dest.replace(/\\/g, '\\\\');
    csInterface.evalScript(`importAsset("${jsPath}")`, (result) => {
        console.log('ExtendScript returned: ' + result);
    });
}

/**
 * Download a file and tell Illustrator to import it.
 * Utilizes CEP's built-in Node.js environment.
 */
function downloadAndImport(url) {
    const fs = require('fs');
    const path = require('path');
    const https = require('https');
    const os = require('os');
    
    const tempDir = os.tmpdir();
    let filename = path.basename(new URL(url).pathname);
    if (!filename || filename.indexOf('.') === -1) filename = 'downloaded_asset.svg';
    
    const dest = path.join(tempDir, filename);
    
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                console.log('File downloaded to: ' + dest);
                const jsPath = dest.replace(/\\/g, '\\\\');
                csInterface.evalScript(`importAsset("${jsPath}")`, (result) => {
                    console.log('ExtendScript returned: ' + result);
                });
            });
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error('Download error: ' + err.message);
    });
}
