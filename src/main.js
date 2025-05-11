// src/main.js

// Attempt to import the UMD build of webp-wasm.
// Parcel should be able to resolve this from node_modules.
// The 'WebP' global might also be available if the UMD module sets it up.
import WebPEncoder from 'webp-wasm/dist/legacy/umd/index.js'; // Or potentially just 'webp-wasm' if Parcel handles it well for UMD

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

    // Check if webp-wasm is loaded
    // The import should make WebPEncoder available.
    // The UMD build also typically creates a global `WebP` object.
    let webpModule = null;
    if (typeof WebPEncoder !== 'undefined' && WebPEncoder.Encoder) { // Check if the import worked directly
        webpModule = WebPEncoder;
    } else if (typeof WebP !== 'undefined' && WebP.Encoder) { // Check for global WebP object (from UMD script)
        webpModule = WebP;
    }


    if (!webpModule) {
        console.error("WebP-WASM library (WebP.Encoder or imported WebPEncoder) not loaded correctly. Animated WebP export will not work.");
        exportMessage.innerHTML = "<span class='text-red-500 font-bold'>CRITICAL ERROR: WebP encoding library not loaded. Animated export disabled.</span><br><small>Ensure 'webp-wasm' is installed via npm and Parcel is bundling correctly.</small>";
        if(exportButton) exportButton.disabled = true;
    }


    function initializeObjectsAndUI() {
        objects = [];
        for (let i = 0; i < MAX_OBJECTS; i++) {
            objects.p
