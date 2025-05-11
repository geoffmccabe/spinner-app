// src/main.js

// Attempt to import the UMD build of webp-wasm.
// Parcel should be able to resolve this from node_modules if 'webp-wasm' is listed in dependencies.
// The 'WebP' global might also be available if the UMD module sets it up.
// We'll try to use the global WebP object as that's what UMD scripts typically provide.
// If you had `import WebPEncoder from 'webp-wasm/dist/legacy/umd/index.js';` Parcel might handle it,
// but relying on the global `WebP` is safer for a direct UMD script inclusion.

document.addEventListener('DOMContentLoaded', () => {
    const MAX_OBJECTS = 6;
    let objects = [];
    let activeObjectIndex = 0;
    let animationFrameId = null;
    let globalLastFrameTimestamp = 0;

    const canvas = document.getElementById('spinnerCanvas');
    const ctx = canvas.getContext('2d');
    const canvasMessage = document.getElementById('canvasMessage');
    const objectSelectorContainer = document.getElementById('objectSelectorContainer');
    const imageUpload = document.getElementById('imageUpload');
    const removeImageButton = document.getElementById('removeImageButton');

    const degreesPerFrameInput = document.getElementById('degreesPerFrame');
    const finalVerticalSizeInput = document.getElementById('finalVerticalSize'); 
    const opacityInput = document.getElementById('opacity');
    const totalExportFramesInput = document.getElementById('totalExportFrames'); 
    const frameTimeInput = document.getElementById('frameTime'); 
    const webpCompressionInput = document.getElementById('webpCompression');
    const exportButton = document.getElementById('exportButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const exportMessage = document.getElementById('exportMessage');

    // Check if webp-wasm is loaded (it should be if webp-wasm.js is present and correct)
    // The library should expose a global `WebP` object.
    if (typeof WebP === 'undefined' || typeof WebP.Encoder === 'undefined') {
        console.error("WebP-WASM library (WebP.Encoder) not loaded correctly. Animated WebP export will not work. Ensure 'webp-wasm.js' is present and correct in the same directory as index.html if using local file, or that the library is correctly installed via npm and bundled by Parcel.");
        exportMessage.innerHTML = "<span class='text-red-500 font-bold'>CRITICAL ERROR: WebP encoding library not found or failed to load. Animated export is disabled.</span><br><small>If using local setup, ensure 'webp-wasm.js' is correctly placed. If using npm, ensure 'webp-wasm' is installed and Parcel is bundling correctly.</small>";
        if(exportButton) exportButton.disabled = true;
    }


    function initializeObjectsAndUI() {
        objects = [];
        for (let i = 0; i < MAX_OBJECTS; i++) {
            objects.push({
                id: i,
                name: `Object ${i + 1}`,
                image: null,
                fileName: null, 
                originalWidth: 0,
                originalHeight: 0,
                settings: {
                    degreesPerFrame: 10,
                    finalVerticalSize: null,
                    opacity: 100, 
                },
                livePreviewRotationAngle: 0,
            });
        }
        createObjectSelectorButtons();
        setActiveObject(0); 
    }

    function createObjectSelectorButtons() {
        objectSelectorContainer.innerHTML = ''; 
        objects.forEach(obj => {
            const container = document.createElement('div');
            container.classList.add('object-button-container');
            const button = document.createElement('button');
            button.textContent = obj.name + (obj.image ? ' ✓' : '');
            button.classList.add('object-button', 'p-2', 'border', 'border-slate-300', 'rounded-md', 'text-sm');
            if (obj.image) button.classList.add('font-semibold');
            button.addEventListener('click', () => setActiveObject(obj.id));
            const fileNameSpan = document.createElement('span');
            fileNameSpan.classList.add('object-file-name');
            fileNameSpan.textContent = obj.fileName || '(empty)';
            container.appendChild(button);
            container.appendChild(fileNameSpan);
            objectSelectorContainer.appendChild(container);
        });
        updateActiveButtonUI();
    }
    
    function updateActiveButtonUI() {
        const buttons = objectSelectorContainer.querySelectorAll('.object-button');
        const fileNameSpans = objectSelectorContainer.querySelectorAll('.object-file-name');
        buttons.forEach((btn, index) => {
            btn.classList.toggle('active', index === activeObjectIndex);
            const obj = objects[index];
            btn.textContent = obj.name + (obj.image ? ' ✓' : '');
            if (obj.image) btn.classList.add('font-semibold'); else btn.classList.remove('font-semibold');
            if (fileNameSpans[index]) {
                fileNameSpans[index].textContent = obj.fileName || '(empty)';
            }
        });
    }

    function setActiveObject(index) {
        activeObjectIndex = index;
        loadSettingsForActiveObject();
        updateActiveButtonUI();
        removeImageButton.disabled = !objects[activeObjectIndex].image;
        exportButton.disabled = !objects.some(obj => obj.image) || (typeof WebP === 'undefined' || typeof WebP.Encoder === 'undefined'); 
        drawLivePreview(); 
    }

    function loadSettingsForActiveObject() {
        const currentObject = objects[activeObjectIndex];
        degreesPerFrameInput.value = currentObject.settings.degreesPerFrame;
        finalVerticalSizeInput.value = currentObject.settings.finalVerticalSize || '';
        opacityInput.value = currentObject.settings.opacity;
    }

    function saveSettingForActiveObject(inputElement) {
        const obj = objects[activeObjectIndex];
        if (!obj) return;
        const settingKey = inputElement.id; 
        let value = inputElement.value;

        if (inputElement.type === 'number') {
            value = parseFloat(value);
            if (isNaN(value)) { 
                if (settingKey === 'finalVerticalSize') value = null;
                else if (settingKey === 'degreesPerFrame') value = 0; 
                else if (settingKey === 'opacity') value = 100;
            }
        }
        
        if (settingKey === 'degreesPerFrame') obj.settings.degreesPerFrame = value;
        else if (settingKey === 'finalVerticalSize') {
            obj.settings.finalVerticalSize = value === null || isNaN(parseFloat(value)) ? (obj.image ? obj.originalHeight : null) : parseFloat(value);
        } else if (settingKey === 'opacity') {
            obj.settings.opacity = Math.max(0, Math.min(100, parseFloat(value) || 100)); 
        }

        if (settingKey === 'degreesPerFrame' || settingKey === 'opacity') {
            startOrUpdateAnimationLoop(); 
        }
        if (settingKey === 'finalVerticalSize' || settingKey === 'opacity') {
            drawLivePreview(); 
        }
    }

    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const currentObject = objects[activeObjectIndex];
        if (!currentObject || !file) return;
        currentObject.fileName = file.name; 

        if (file.type === "image/png" || file.type === "image/gif" || file.type === "image/webp" || file.type === "image/jpeg") {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentObject.image = new Image();
                currentObject.image.onload = () => {
                    currentObject.originalWidth = currentObject.image.width;
                    currentObject.originalHeight = currentObject.image.height;
                    if (currentObject.settings.finalVerticalSize === null || currentObject.settings.finalVerticalSize === '') {
                        currentObject.settings.finalVerticalSize = currentObject.originalHeight;
                        if (activeObjectIndex === objects.findIndex(o => o === currentObject)) {
                             finalVerticalSizeInput.value = currentObject.settings.finalVerticalSize;
                        }
                    }
                    canvasMessage.textContent = `${currentObject.name} ('${currentObject.fileName}') loaded.`;
                    currentObject.livePreviewRotationAngle = 0; 
                    globalLastFrameTimestamp = performance.now(); 
                    startOrUpdateAnimationLoop(); 
                    createObjectSelectorButtons(); 
                    removeImageButton.disabled = false;
                    exportButton.disabled = (typeof WebP === 'undefined' || typeof WebP.Encoder === 'undefined'); 
                };
                currentObject.image.onerror = () => { currentObject.fileName = null; canvasMessage.textContent = `Error loading ${file.name}.`; createObjectSelectorButtons();};
                currentObject.image.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else { currentObject.fileName = null; canvasMessage.textContent = `Unsupported file type for ${file.name}.`; createObjectSelectorButtons(); }
         imageUpload.value = ''; 
    });

    removeImageButton.addEventListener('click', () => {
        const obj = objects[activeObjectIndex];
        if (obj && obj.image) {
            obj.image = null;
            obj.fileName = null;
            obj.originalWidth = 0;
            obj.originalHeight = 0;
            obj.livePreviewRotationAngle = 0;
            createObjectSelectorButtons(); 
            removeImageButton.disabled = true;
            exportButton.disabled = !objects.some(o => o.image) || (typeof WebP === 'undefined' || typeof WebP.Encoder === 'undefined'); 
            drawLivePreview();
            canvasMessage.textContent = `${obj.name} image removed.`;
        }
    });
    
    function drawLivePreview() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let hasAnyImage = false;
        for (let i = MAX_OBJECTS - 1; i >= 0; i--) { // Draw from last to first for correct layering (obj 0 is top)
            const obj = objects[i];
            if (!obj.image) continue;
            hasAnyImage = true;
            let previewHeight = obj.settings.finalVerticalSize || obj.originalHeight;
            if (previewHeight <= 0) previewHeight = obj.originalHeight;
            const aspectRatio = obj.originalWidth > 0 && obj.originalHeight > 0 ? obj.originalWidth / obj.originalHeight : 1;
            let previewWidth = previewHeight * aspectRatio;
            const maxDim = 1580; 
            if (previewWidth > maxDim || previewHeight > maxDim) {
                if (aspectRatio >= 1) { 
                    previewWidth = maxDim; previewHeight = maxDim / aspectRatio;
                } else { 
                    previewHeight = maxDim; previewWidth = maxDim * aspectRatio;
                }
            }
            ctx.save(); 
            ctx.globalAlpha = (obj.settings.opacity / 100);
            if (i === activeObjectIndex) { // Draw bounding box only for the active object
                const boxX = (canvas.width - previewWidth) / 2;
                const boxY = (canvas.height - previewHeight) / 2;
                const tempAlpha = ctx.globalAlpha; // Save current alpha for image
                ctx.globalAlpha = 1; // Bounding box should be fully opaque
                ctx.strokeStyle = '#CCCCCC'; 
                ctx.lineWidth = 2;          
                ctx.strokeRect(boxX, boxY, previewWidth, previewHeight);
                ctx.globalAlpha = tempAlpha; // Restore alpha for drawing the image
            }
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(obj.livePreviewRotationAngle * Math.PI / 180); 
            ctx.drawImage(obj.image, -previewWidth / 2, -previewHeight / 2, previewWidth, previewHeight);
            ctx.restore(); // Restores globalAlpha and other transformations
        }
        ctx.globalAlpha = 1.0; // Ensure globalAlpha is reset after drawing all objects

        if (!hasAnyImage && activeObjectIndex >=0) canvasMessage.textContent = `${objects[activeObjectIndex].name} is empty. Upload an image.`;
        else if (hasAnyImage && activeObjectIndex >=0) canvasMessage.textContent = `Previewing. Settings for ${objects[activeObjectIndex].name}.`;
        else canvasMessage.textContent = "Select an object and upload an image.";
    }
    
    function animationLoop(timestamp) {
        const desiredFrameTime = parseFloat(frameTimeInput.value) || 83.3; 
        const elapsed = timestamp - globalLastFrameTimestamp;

        if (elapsed >= desiredFrameTime) {
            globalLastFrameTimestamp = timestamp - (elapsed % desiredFrameTime); 
            let needsRedraw = false;
            objects.forEach(obj => {
                if (obj.image) {
                    const degreesPerStep = obj.settings.degreesPerFrame || 0; 
                    if (degreesPerStep !== 0) { 
                       obj.livePreviewRotationAngle = (obj.livePreviewRotationAngle + degreesPerStep);
                       // Normalize angle to be between 0 and 359.99...
                       while (obj.livePreviewRotationAngle >= 360) obj.livePreviewRotationAngle -= 360;
                       while (obj.livePreviewRotationAngle < 0) obj.livePreviewRotationAngle += 360;
                       needsRedraw = true;
                    } else if (obj.livePreviewRotationAngle !== 0 && degreesPerStep === 0){ // Object was rotating, now stopped
                        needsRedraw = true; 
                    }
                }
            });
            if(needsRedraw || objects.some(obj => obj.image && obj.settings.degreesPerFrame === 0)) { 
                drawLivePreview();
            }
        }
        if (objects.some(o => o.image)) { 
            animationFrameId = requestAnimationFrame(animationLoop);
        } else {
            animationFrameId = null; 
            drawLivePreview(); // Clear canvas if no images
        }
    }

    function startOrUpdateAnimationLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId); 
            animationFrameId = null;
        }
        if (objects.some(obj => obj.image)) { 
            globalLastFrameTimestamp = performance.now(); 
            animationFrameId = requestAnimationFrame(animationLoop);
        } else {
             drawLivePreview(); // Clear canvas if no images
        }
    }
    
    // Event listeners for per-object settings
    [degreesPerFrameInput, finalVerticalSizeInput, opacityInput].forEach(input => {
        input.addEventListener('input', () => saveSettingForActiveObject(input));
    });

    // Event listeners for global/composite settings
    [totalExportFramesInput, frameTimeInput, webpCompressionInput].forEach(input => {
         input.addEventListener('input', () => {
             if (input === frameTimeInput && objects.some(obj => obj.image)) {
                 startOrUpdateAnimationLoop(); // Frame time affects live preview speed
             }
             // totalExportFrames & webpCompression only affect export, no immediate redraw needed.
         });
    });
    
    exportButton.addEventListener('click', async () => {
        // Use the globally available WebP object from the UMD script
        if (typeof WebP === 'undefined' || typeof WebP.Encoder === 'undefined') { 
             exportMessage.innerHTML = "<span class='text-red-500 font-bold'>CRITICAL ERROR: WebP encoding library ('webp-wasm.js' if local, or npm install) not found or failed to load. Animated export is disabled.</span>";
             console.error("WebP or WebP.Encoder is undefined. Library might not have initialized correctly.");
             return;
        }
        const activeImages = objects.filter(obj => obj.image);
        if (activeImages.length === 0) { 
            exportMessage.textContent = "No images to export.";
            return;
        }

        exportMessage.textContent = "Preparing animated WebP export...";
        loadingIndicator.classList.remove('hidden');
        exportButton.disabled = true;
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

        try {
            const compositeTotalFrames = parseInt(totalExportFramesInput.value) || 36;
            const compositeFrameTimeMs = parseFloat(frameTimeInput.value) || 83.3;
            const compositeWebpQuality = parseInt(webpCompressionInput.value) || 75; 

            if (compositeTotalFrames < 1) { 
                exportMessage.textContent = "Total export frames must be at least 1.";
                loadingIndicator.classList.add('hidden');
                exportButton.disabled = false;
                return;
            }
            
            const offscreenCanvas = document.createElement('canvas');
            // The offscreen canvas for export should be the actual 1600x1600 working resolution
            offscreenCanvas.width = 1600; 
            offscreenCanvas.height = 1600;
            const offCtx = offscreenCanvas.getContext('2d');
            
            // Initialize WebP Encoder from the global WebP object
            const webPEncoder = new WebP.Encoder(offscreenCanvas.width, offscreenCanvas.height, {
                quality: compositeWebpQuality, 
                lossless: false // Set to true for lossless if preferred, false for better compression (lossy)
            });
            webPEncoder.setLoops(0); // 0 for infinite loop

            for (let i = 0; i < compositeTotalFrames; i++) {
                offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); 
                // Draw all active objects in REVERSE order for correct layering in export
                // (Object 0 is top layer, drawn last)
                for (let k = MAX_OBJECTS - 1; k >= 0; k--) { 
                    const obj = objects[k];
                    if (!obj.image) continue;

                    const currentRotationDegrees = i * (obj.settings.degreesPerFrame || 0);
                    let exportObjHeight = obj.settings.finalVerticalSize || obj.originalHeight;
                    if(exportObjHeight <=0) exportObjHeight = obj.originalHeight;
                    const aspectRatio = obj.originalWidth > 0 && obj.originalHeight > 0 ? obj.originalWidth / obj.originalHeight : 1;
                    let exportObjWidth = exportObjHeight * aspectRatio;
                    
                    // Scale object to fit within the 1600x1600 export canvas if needed, maintaining aspect ratio
                    const maxDimExport = 1580; // Similar to preview, with some padding
                    if (exportObjWidth > maxDimExport || exportObjHeight > maxDimExport) {
                        if (aspectRatio >= 1) { // Wider or square
                             exportObjWidth = maxDimExport; exportObjHeight = maxDimExport / aspectRatio; 
                        } else { // Taller
                             exportObjHeight = maxDimExport; exportObjWidth = maxDimExport * aspectRatio; 
                        }
                    }

                    offCtx.save();
                    offCtx.globalAlpha = (obj.settings.opacity / 100); 
                    offCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2); // Center in 1600x1600
                    offCtx.rotate(currentRotationDegrees * Math.PI / 180);
                    offCtx.drawImage(obj.image, -exportObjWidth / 2, -exportObjHeight / 2, exportObjWidth, exportObjHeight);
                    offCtx.restore(); 
                }
                offCtx.globalAlpha = 1.0; // Reset globalAlpha for the context before adding frame
                
                // Add frame to encoder
                webPEncoder.addFrame(offCtx, compositeFrameTimeMs);
                exportMessage.textContent = `Encoding frame ${i + 1} of ${compositeTotalFrames}...`;
                if (i % 5 === 0 && i > 0) { // Yield to browser to keep UI responsive
                    await new Promise(resolve => setTimeout(resolve, 0)); 
                }
            }
            
            exportMessage.textContent = "Finalizing WebP animation...";
            await new Promise(resolve => setTimeout(resolve, 50)); // Short delay for UI

            const webpData = webPEncoder.finish(); // Get Uint8Array
            webPEncoder.release(); // IMPORTANT: Release encoder resources

            const blob = new Blob([webpData], { type: 'image/webp' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spinner_animation_${Date.now()}.webp`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); 

            exportMessage.innerHTML = `Animated WebP exported successfully! (${compositeTotalFrames} frames)`;
            exportMessage.className = "text-sm text-center text-green-700 mt-2 font-semibold";

        } catch (error) { 
            console.error("Error during WebP export:", error);
            exportMessage.textContent = "Error during WebP export. Check console.";
            exportMessage.className = "text-sm text-center text-red-600 mt-2";
        } finally { 
            loadingIndicator.classList.add('hidden');
            // Re-enable button only if library is loaded and images exist
            exportButton.disabled = !objects.some(o => o.image) || (typeof WebP === 'undefined' || typeof WebP.Encoder === 'undefined');
        }
    });

    // Initialize the application
    initializeObjectsAndUI();
    // Initially disable export button until an image is loaded and library is confirmed
    exportButton.disabled = true; 
});
