// hostscript.jsx
// Runs in the Adobe Illustrator execution environment

function importAsset(filePath) {
    try {
        if (app.documents.length === 0) {
            return "Error: No active document.";
        }

        var doc = app.activeDocument;
        var fileToPlace = new File(filePath);
        
        if (!fileToPlace.exists) {
            return "Error: File does not exist at path: " + filePath;
        }

        var isSvg = filePath.toLowerCase().indexOf('.svg') !== -1;
        var item;
        
        // Suppress Illustrator warnings (e.g., "Clipping will be lost on roundtrip to Tiny")
        var originalInteractionLevel = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        
        try {
            if (isSvg) {
                item = doc.groupItems.createFromFile(fileToPlace);
                // Native Adobe Auto-Trace for isolated text/icon layers
                if (item && item.rasterItems && item.rasterItems.length > 0) {
                    for (var i = item.rasterItems.length - 1; i >= 0; i--) {
                        try {
                            var r = item.rasterItems[i];
                            if (r.name && r.name.indexOf('ai-trace-me') !== -1) {
                                var plugin = r.trace();
                                
                                //wysiwyg screenshot trace — preserve all colors, no white masking
                                try { plugin.tracing.tracingOptions.tracingMode = TracingModeType.TRACINGCOLOR; } catch(e) {}
                                try { plugin.tracing.tracingOptions.tracingMethod = TracingMethodType.TRACINGMETHODOVERLAPPING; } catch(e) {}
                                try { plugin.tracing.tracingOptions.ignoreWhite = false; } catch(e) {}
                                try { plugin.tracing.tracingOptions.pathFidelity = 100; } catch(e) {}
                                try { plugin.tracing.tracingOptions.noiseFidelity = 1; } catch(e) {}
                                try { plugin.tracing.tracingOptions.cornerFidelity = 100; } catch(e) {}
                                try { plugin.tracing.tracingOptions.maxColors = 256; } catch(e) {}
                                
                                app.redraw();
                                plugin.tracing.expandTracing();
                            }
                        } catch(e) {}
                    }
                }
            } else {
                item = doc.placedItems.add();
                item.file = fileToPlace;
                item.embed(); // Force embed raster images
            }
        } finally {
            // Always restore interaction level
            app.userInteractionLevel = originalInteractionLevel;
            // Clean up temporary file to prevent storage memory leak
            try { fileToPlace.remove(); } catch(e) {}
        }
        
        // Center the placed item in the active view
        var view = doc.activeView;
        var viewCenter = view.centerPoint;
        
        // Position is top-left coordinate, so we roughly adjust by half width/height
        item.position = [
            viewCenter[0] - (item.width / 2),
            viewCenter[1] + (item.height / 2) // In AI, Y goes up
        ];
        
        return "Success";
    } catch (e) {
        return "Error: " + e.toString();
    }
}
