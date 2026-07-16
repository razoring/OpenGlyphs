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
        if (isSvg) {
            item = doc.groupItems.createFromFile(fileToPlace);
        } else {
            item = doc.placedItems.add();
            item.file = fileToPlace;
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
