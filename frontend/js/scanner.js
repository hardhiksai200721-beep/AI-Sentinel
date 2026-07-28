"use strict";

// ============================================================
// AI SENTINEL - SCANNER CONTROLLER
// Compatible with the current scanner.html
// ============================================================

const SCANNER_MAX_FILE_SIZE = 15 * 1024 * 1024;
const SCANNER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

let selectedFile = null;
let previewUrl = null;
let isScanning = false;

// ============================================================
// DOM
// ============================================================

const $ = (id) => document.getElementById(id);

const uploadBox = $("uploadBox");
const fileInput = $("fileInput");
const browseButton = $("browseButton");
const uploadEmptyState = $("uploadEmptyState");
const imagePreviewContainer = $("imagePreviewContainer");
const imagePreview = $("imagePreview");
const selectedFileName = $("selectedFileName");
const selectedFileSize = $("selectedFileSize");
const fileStatus = $("fileStatus");

const scanButton = $("scanButton");
const resetButton = $("resetButton");
const newScanButton = $("newScanButton");

const scannerError = $("scannerError");
const scannerErrorText = $("scannerErrorText");

const scanProcessing = $("scanProcessing");
const processingTitle = $("processingTitle");
const processingPercent = $("processingPercent");
const processingProgressBar = $("processingProgressBar");
const processingMessage = $("processingMessage");

const scanResults = $("scanResults");

const resultObjectCount = $("resultObjectCount");
const resultAIResultCount = $("resultAIResultCount");
const resultCompression = $("resultCompression");
const resultDatabaseStatus = $("resultDatabaseStatus");

const yoloObjectCount = $("yoloObjectCount");
const detectionImage = $("detectionImage");
const boundingBoxLayer = $("boundingBoxLayer");
const yoloObjects = $("yoloObjects");
const geminiResults = $("geminiResults");

const cloudinaryResult = $("cloudinaryResult");
const supabaseResult = $("supabaseResult");

const originalImageSize = $("originalImageSize");
const compressedImageSize = $("compressedImageSize");
const compressionQuality = $("compressionQuality");
const compressionDimensions = $("compressionDimensions");
const resultScanId = $("resultScanId");

const pipelineIds = {
    opencv: "pipelineOpenCV",
    yolo: "pipelineYOLO",
    gemini: "pipelineGemini",
    compression: "pipelineCompression",
    cloudinary: "pipelineCloudinary",
    supabase: "pipelineSupabase"
};

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const missing = [
        ["uploadBox", uploadBox],
        ["fileInput", fileInput],
        ["browseButton", browseButton],
        ["scanButton", scanButton],
        ["resetButton", resetButton]
    ].filter(([, el]) => !el);

    if (missing.length) {
        console.error(
            "Scanner initialization failed. Missing elements:",
            missing.map(([name]) => name)
        );
        return;
    }

    bindEvents();
    resetScanner();
    console.log("AI Sentinel scanner initialized.");
});

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {
    browseButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isScanning) {
            fileInput.click();
        }
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) selectFile(file);
    });

    uploadBox.addEventListener("click", (event) => {
        if (isScanning) return;
        if (event.target.closest("button, a, input")) return;
        fileInput.click();
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isScanning) uploadBox.classList.add("dragging");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            uploadBox.classList.remove("dragging");
        });
    });

    uploadBox.addEventListener("drop", (event) => {
        if (isScanning) return;
        const file = event.dataTransfer?.files?.[0];
        if (file) selectFile(file);
    });

    scanButton.addEventListener("click", startScan);
    resetButton.addEventListener("click", resetScanner);

    if (newScanButton) {
        newScanButton.addEventListener("click", () => {
            resetScanner();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
}

// ============================================================
// FILE SELECTION
// ============================================================

function validateFile(file) {
    if (!file) return "No image selected.";

    if (!SCANNER_ALLOWED_TYPES.includes(file.type)) {
        return "Unsupported image format. Select a JPG, PNG, or WebP image.";
    }

    if (file.size <= 0) return "The selected image is empty.";

    if (file.size > SCANNER_MAX_FILE_SIZE) {
        return "The image is larger than the 15 MB limit.";
    }

    return null;
}

function selectFile(file) {
    clearError();

    const error = validateFile(file);
    if (error) {
        fileInput.value = "";
        showError(error);
        return;
    }

    selectedFile = file;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);

    imagePreview.src = previewUrl;
    selectedFileName.textContent = file.name || "image";
    selectedFileSize.textContent = formatBytes(file.size);

    uploadEmptyState.hidden = true;
    imagePreviewContainer.hidden = false;

    fileStatus.textContent = "IMAGE READY";
    scanButton.disabled = false;

    if (scanResults) scanResults.hidden = true;

    showToast(`Selected ${file.name}`, "success");
    console.log("Scanner image selected:", file.name, file.type, file.size);
}

// ============================================================
// SCAN
// ============================================================

async function startScan() {
    if (!selectedFile || isScanning) return;

    if (typeof window.scanUploadedImage !== "function") {
        showError("scanUploadedImage() is unavailable. Check that api.js loads before scanner.js.");
        return;
    }

    clearError();
    isScanning = true;

    scanButton.disabled = true;
    resetButton.disabled = true;
    fileInput.disabled = true;

    scanProcessing.hidden = false;
    scanResults.hidden = true;

    resetPipeline();
    updateProgress(8, "Preparing image...", "Initializing scanner");

    try {
        setPipeline("opencv", "PROCESSING");
        updateProgress(18, "Reading and decoding image...", "OpenCV");
        await delay(150);

        setPipeline("opencv", "COMPLETE");
        setPipeline("yolo", "PROCESSING");
        updateProgress(35, "Detecting objects...", "YOLO Detection");

        // api.js performs the actual POST /api/scan request.
        const request = window.scanUploadedImage(selectedFile);

        await delay(250);
        setPipeline("yolo", "PROCESSING");
        setPipeline("gemini", "PROCESSING");
        updateProgress(52, "Running visual intelligence...", "Gemini Vision");

        await delay(250);
        setPipeline("compression", "PROCESSING");
        updateProgress(68, "Compressing image...", "Image Optimization");

        await delay(200);
        setPipeline("cloudinary", "PROCESSING");
        updateProgress(80, "Storing optimized image...", "Cloudinary");

        await delay(200);
        setPipeline("supabase", "PROCESSING");
        updateProgress(90, "Saving scan record...", "Supabase");

        const result = await request;

        Object.keys(pipelineIds).forEach((key) => setPipeline(key, "COMPLETE"));
        updateProgress(100, "Analysis complete.", "Scan Complete");

        renderResults(result || {});

        scanResults.hidden = false;
        showToast("AI scan completed successfully.", "success");

        setTimeout(() => {
            scanResults.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    } catch (error) {
        console.error("Scanner scan failed:", error);
        showError(error?.message || "Image scan failed.");
        showToast("Image scan failed.", "error");

        Object.keys(pipelineIds).forEach((key) => {
            const item = $(pipelineIds[key]);
            const value = item?.querySelector(".pipeline-state-value");
            if (value?.textContent === "PROCESSING") {
                setPipeline(key, "ERROR");
            }
        });
    } finally {
        isScanning = false;
        fileInput.disabled = false;
        resetButton.disabled = false;
        scanButton.disabled = !selectedFile;

        setTimeout(() => {
            if (!isScanning) scanProcessing.hidden = true;
        }, 800);
    }
}

// ============================================================
// RESULT NORMALIZATION / RENDERING
// ============================================================

function renderResults(data) {
    const objects = Array.isArray(data.objects)
        ? data.objects
        : Array.isArray(data.detections)
            ? data.detections
            : [];

    const aiAnalysis = Array.isArray(data.ai_analysis)
        ? data.ai_analysis
        : data.ai_analysis
            ? [data.ai_analysis]
            : Array.isArray(data.gemini_analysis)
                ? data.gemini_analysis
                : data.gemini_analysis
                    ? [data.gemini_analysis]
                    : [];

    const compression = data.compression || {};
    const cloud = data.cloudinary || data.cloud_storage || {};
    const database = data.database || data.supabase || {};

    const objectCount = Number(
        data.objects_detected ??
        data.object_count ??
        objects.length
    ) || 0;

    resultObjectCount.textContent = String(objectCount);
    resultAIResultCount.textContent = String(aiAnalysis.length);

    const compressedKb =
        compression.compressed_size_kb ??
        cloud.size_kb;

    resultCompression.textContent =
        compressedKb != null ? `${compressedKb} KB` : "-";

    const dbSaved =
        database.saved === true ||
        database.status === "saved" ||
        database.status === "SAVED" ||
        Boolean(database.scan_id || data.scan_id);

    resultDatabaseStatus.textContent = dbSaved ? "SAVED" : "CHECK";

    renderDetection(data, objects, objectCount);
    renderGemini(aiAnalysis);
    renderCloud(cloud);
    renderDatabase(database, data);
    renderCompression(compression, cloud);
}

function renderDetection(data, objects, objectCount) {
    yoloObjectCount.textContent = `${objectCount} OBJECT${objectCount === 1 ? "" : "S"}`;

    const resultImage =
        data.annotated_image_url ||
        data.detection_image_url ||
        data.cloudinary?.secure_url ||
        data.cloud_storage?.secure_url ||
        previewUrl ||
        "";

    if (resultImage) detectionImage.src = resultImage;

    if (boundingBoxLayer) boundingBoxLayer.innerHTML = "";
    yoloObjects.innerHTML = "";

    if (!objects.length) {
        yoloObjects.innerHTML = '<div class="empty-result-message">No objects detected.</div>';
        return;
    }

    objects.forEach((object, index) => {
        const name = escapeHTML(object.name || object.class_name || object.label || "Object");
        let confidence = Number(object.confidence ?? object.score ?? 0);
        if (confidence <= 1) confidence *= 100;

        const box = object.bounding_box || object.box || {};

        const card = document.createElement("div");
        card.className = "scanner-object-card";
        card.innerHTML = `
            <div class="scanner-object-header">
                <span class="scanner-object-number">${index + 1}</span>
                <strong>${name}</strong>
                <span class="scanner-confidence">${confidence.toFixed(1)}%</span>
            </div>
            <div class="scanner-object-box">
                X1 ${escapeHTML(box.x1 ?? "-")} ·
                Y1 ${escapeHTML(box.y1 ?? "-")} ·
                X2 ${escapeHTML(box.x2 ?? "-")} ·
                Y2 ${escapeHTML(box.y2 ?? "-")}
            </div>
        `;
        yoloObjects.appendChild(card);
    });
}

function renderGemini(items) {
    geminiResults.innerHTML = "";

    if (!items.length) {
        geminiResults.innerHTML =
            '<div class="empty-result-message">No detailed Gemini analysis returned.</div>';
        return;
    }

    items.forEach((item, index) => {
        if (typeof item === "string") {
            const card = document.createElement("div");
            card.className = "scanner-gemini-card";
            card.innerHTML = `<p>${escapeHTML(item)}</p>`;
            geminiResults.appendChild(card);
            return;
        }

        const card = document.createElement("div");
        card.className = "scanner-gemini-card";

        const category = item.category || item.object || item.name || `Result ${index + 1}`;
        const brand = item.brand || "Unknown";
        const model = item.model || "Unknown";
        const family = item.product_family || "Unknown";
        const confidence = item.identification_confidence || item.confidence || "Unknown";
        const description = item.description || item.summary || "No description available.";
        const evidence = item.visual_evidence || "No visual evidence provided.";
        const visibleText = normalizeList(item.visible_text).join(" • ") || "None detected";
        const alternatives = normalizeList(item.alternative_matches).join(" • ") || "None";

        card.innerHTML = `
            <div class="scanner-gemini-header">
                <span>AI ${index + 1}</span>
                <strong>${escapeHTML(category)}</strong>
            </div>
            <div class="scanner-gemini-grid">
                <div><span>BRAND</span><strong>${escapeHTML(brand)}</strong></div>
                <div><span>PRODUCT FAMILY</span><strong>${escapeHTML(family)}</strong></div>
                <div><span>MODEL</span><strong>${escapeHTML(model)}</strong></div>
                <div><span>CONFIDENCE</span><strong>${escapeHTML(confidence)}</strong></div>
            </div>
            <div class="scanner-analysis-block">
                <span>DESCRIPTION</span><p>${escapeHTML(description)}</p>
            </div>
            <div class="scanner-analysis-block">
                <span>VISUAL EVIDENCE</span><p>${escapeHTML(evidence)}</p>
            </div>
            <div class="scanner-analysis-block">
                <span>VISIBLE TEXT</span><p>${escapeHTML(visibleText)}</p>
            </div>
            <div class="scanner-analysis-block">
                <span>ALTERNATIVE MATCHES</span><p>${escapeHTML(alternatives)}</p>
            </div>
        `;
        geminiResults.appendChild(card);
    });
}

function renderCloud(cloud) {
    if (!cloudinaryResult) return;

    const url = cloud.secure_url || cloud.url || "";
    const stored =
        cloud.stored === true ||
        cloud.status === "saved" ||
        cloud.status === "SAVED" ||
        Boolean(url || cloud.public_id);

    const content = cloudinaryResult.querySelector(".storage-confirmation-content");
    const status = cloudinaryResult.querySelector(".storage-confirmation-status");

    if (content) {
        content.innerHTML = `
            <span>CLOUD STORAGE</span>
            <h3>Cloudinary</h3>
            <p>${stored ? "Compressed image stored successfully." : "No cloud confirmation returned."}</p>
            ${url ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">OPEN STORED IMAGE ↗</a>` : ""}
        `;
    }

    if (status) status.textContent = stored ? "✓" : "—";
}

function renderDatabase(database, data) {
    if (!supabaseResult) return;

    const scanId = database.scan_id || data.scan_id || "-";
    const createdAt = database.created_at || data.created_at || "";

    const saved =
        database.saved === true ||
        database.status === "saved" ||
        database.status === "SAVED" ||
        scanId !== "-";

    const content = supabaseResult.querySelector(".storage-confirmation-content");
    const status = supabaseResult.querySelector(".storage-confirmation-status");

    if (content) {
        content.innerHTML = `
            <span>DATABASE</span>
            <h3>Supabase</h3>
            <p>${saved ? "Scan record saved successfully." : "No database confirmation returned."}</p>
        `;
    }

    if (status) status.textContent = saved ? "✓" : "—";
    resultScanId.textContent = scanId;

    if (createdAt) resultScanId.title = `Created: ${formatDate(createdAt)}`;
}

function renderCompression(compression, cloud) {
    const originalKb = compression.original_size_kb;
    const compressedKb = compression.compressed_size_kb ?? cloud.size_kb;
    const quality = compression.quality;

    originalImageSize.textContent =
        originalKb != null ? `${originalKb} KB` :
        selectedFile ? formatBytes(selectedFile.size) : "-";

    compressedImageSize.textContent =
        compressedKb != null ? `${compressedKb} KB` : "-";

    compressionQuality.textContent =
        quality != null ? `${quality}%` : "-";

    const width = compression.width ?? cloud.width;
    const height = compression.height ?? cloud.height;

    compressionDimensions.textContent =
        width && height ? `${width} × ${height}` : "-";
}

// ============================================================
// PIPELINE / PROGRESS
// ============================================================

function setPipeline(name, state) {
    const item = $(pipelineIds[name]);
    if (!item) return;

    const value = item.querySelector(".pipeline-state-value");
    if (value) value.textContent = state;

    item.dataset.state = state.toLowerCase();
}

function resetPipeline() {
    Object.keys(pipelineIds).forEach((key) => setPipeline(key, "READY"));
}

function updateProgress(percent, message, title) {
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));

    if (processingProgressBar) processingProgressBar.style.width = `${safe}%`;
    if (processingPercent) processingPercent.textContent = `${safe}%`;
    if (processingMessage) processingMessage.textContent = message || "";
    if (processingTitle) processingTitle.textContent = title || "Analyzing image...";
}

// ============================================================
// RESET / ERROR / TOAST
// ============================================================

function resetScanner() {
    selectedFile = null;
    isScanning = false;

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    if (fileInput) {
        fileInput.value = "";
        fileInput.disabled = false;
    }

    if (imagePreview) imagePreview.removeAttribute("src");
    if (uploadEmptyState) uploadEmptyState.hidden = false;
    if (imagePreviewContainer) imagePreviewContainer.hidden = true;

    if (selectedFileName) selectedFileName.textContent = "-";
    if (selectedFileSize) selectedFileSize.textContent = "-";
    if (fileStatus) fileStatus.textContent = "NO IMAGE";

    if (scanButton) scanButton.disabled = true;
    if (resetButton) resetButton.disabled = false;

    if (scanProcessing) scanProcessing.hidden = true;
    if (scanResults) scanResults.hidden = true;

    updateProgress(0, "Preparing image...", "Analyzing image...");
    resetPipeline();
    clearError();
    resetResultDisplay();
}

function resetResultDisplay() {
    if (resultObjectCount) resultObjectCount.textContent = "0";
    if (resultAIResultCount) resultAIResultCount.textContent = "0";
    if (resultCompression) resultCompression.textContent = "-";
    if (resultDatabaseStatus) resultDatabaseStatus.textContent = "-";
    if (yoloObjectCount) yoloObjectCount.textContent = "0 OBJECTS";
    if (yoloObjects) yoloObjects.innerHTML = '<div class="empty-result-message">No objects detected.</div>';
    if (geminiResults) geminiResults.innerHTML = "";
    if (boundingBoxLayer) boundingBoxLayer.innerHTML = "";
    if (detectionImage) detectionImage.removeAttribute("src");
    if (originalImageSize) originalImageSize.textContent = "-";
    if (compressedImageSize) compressedImageSize.textContent = "-";
    if (compressionQuality) compressionQuality.textContent = "-";
    if (compressionDimensions) compressionDimensions.textContent = "-";
    if (resultScanId) resultScanId.textContent = "-";
}

function showError(message) {
    if (scannerError) scannerError.hidden = false;
    if (scannerErrorText) scannerErrorText.textContent = message || "Scanner error.";
}

function clearError() {
    if (scannerError) scannerError.hidden = true;
    if (scannerErrorText) scannerErrorText.textContent = "";
}

function showToast(message, type = "success") {
    if (typeof window.showToast === "function") {
        window.showToast(message, type);
        return;
    }

    const toast = $("toast");
    const toastMessage = $("toastMessage");
    const toastIcon = $("toastIcon");

    if (!toast || !toastMessage) {
        console.log(message);
        return;
    }

    toastMessage.textContent = message;
    if (toastIcon) toastIcon.textContent = type === "error" ? "!" : "✓";

    toast.classList.remove("success", "error", "show");
    toast.classList.add(type);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => toast.classList.remove("show"), 3000);
}

// ============================================================
// HELPERS
// ============================================================

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "-";
    if (value < 1024) return `${value} B`;

    const kb = value / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;

    return `${(kb / 1024).toFixed(2)} MB`;
}

function normalizeList(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);

    const text = String(value).trim();
    return text && text.toLowerCase() !== "none" ? [text] : [];
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

window.addEventListener("beforeunload", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
});
