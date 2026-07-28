"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const grid = $("historyGrid");
    if (!grid) return;

    const ui = {
        grid,
        loading: $("historyLoading"),
        empty: $("historyEmpty"),
        error: $("historyError"),
        errorText: $("historyErrorText"),
        search: $("historySearchInput"),
        period: $("historyPeriodFilter"),
        source: $("historySourceFilter"),
        searchButton: $("historySearchButton"),
        refresh: $("refreshHistoryButton"),
        total: $("historyTotalScans"),
        uploads: $("historyUploadScans"),
        cameras: $("historyCameraScans"),
        objects: $("historyObjectCount"),
        dbStatus: $("historyDatabaseStatus"),
        backendStatus: $("historyBackendStatus"),
        dbHero: $("databaseHeroStatus"),
        globalBackend: $("backendStatus"),
        dbTelemetry: $("historyDatabaseTelemetry"),
        backendTelemetry: $("historyBackendTelemetry"),
        modal: $("historyModal"),
        modalBackdrop: $("historyModalBackdrop"),
        closeModal: $("closeHistoryModal"),
        image: $("historyDetailImage"),
        cloudLink: $("historyCloudLink"),
        detailSource: $("detailSource"),
        detailObjects: $("detailObjectCount"),
        detailSize: $("detailImageSize"),
        databaseDetails: $("historyDatabaseDetails"),
        yoloDetails: $("historyYoloDetails"),
        geminiDetails: $("historyGeminiDetails"),
        modalScanId: $("historyModalScanId"),
        deleteButton: $("deleteHistoryRecordButton"),
        deleteDialog: $("deleteHistoryDialog"),
        cancelDelete: $("cancelHistoryDelete"),
        confirmDelete: $("confirmHistoryDelete")
    };

    let records = [];
    let selectedRecord = null;

    const escapeHtml = (value = "") =>
        String(value).replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;",
            '"': "&quot;", "'": "&#039;"
        })[c]);

    const pick = (obj, ...keys) => {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
        }
        return null;
    };

    function extractRecords(response) {
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.records)) return response.records;
        if (Array.isArray(response?.history)) return response.history;
        if (Array.isArray(response?.data)) return response.data;
        return [];
    }

    function scanId(r) {
        return pick(r, "scan_id", "id", "uuid") || "unknown";
    }

    function sourceOf(r) {
        return String(pick(r, "source", "scan_source", "input_source") || "upload").toLowerCase();
    }

    function imageUrl(r) {
        return pick(r, "image_url", "cloudinary_url", "secure_url", "annotated_image_url", "url") || "";
    }

    function createdAt(r) {
        return pick(r, "created_at", "timestamp", "scanned_at", "date");
    }

    function detectionsOf(r) {
        const value = pick(r, "detections", "objects", "yolo_detections", "detected_objects");
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.detections)) return value.detections;
        return [];
    }

    function geminiOf(r) {
        return pick(r, "gemini_analysis", "gemini", "analysis", "ai_analysis", "description");
    }

    function objectCountOf(r) {
        const explicit = pick(r, "object_count", "objects_detected", "total_objects");
        return explicit !== null ? Number(explicit) || 0 : detectionsOf(r).length;
    }

    function formatDate(value) {
        if (!value) return "Unknown date";
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    }

    function formatSize(r) {
        const width = pick(r, "width", "image_width");
        const height = pick(r, "height", "image_height");
        if (width && height) return `${width} × ${height}`;
        return pick(r, "image_size", "dimensions") || "-";
    }

    function textFromGemini(value) {
        if (!value) return "No Gemini analysis stored.";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
            return pick(value, "summary", "description", "analysis", "text") ||
                JSON.stringify(value, null, 2);
        }
        return String(value);
    }

    function setStatus(status) {
        const online = status === "ONLINE";
        const nodes = [
            ui.dbStatus, ui.backendStatus, ui.dbHero, ui.globalBackend,
            ui.dbTelemetry, ui.backendTelemetry
        ];
        nodes.forEach(el => { if (el) el.textContent = status; });

        const chip = $("globalBackendChip");
        if (chip) {
            chip.classList.toggle("online", online);
            chip.classList.toggle("offline", status === "OFFLINE");
        }
    }

    function setLoading(active) {
        ui.loading.hidden = !active;
        if (active) {
            ui.empty.hidden = true;
            ui.grid.hidden = true;
        } else {
            ui.grid.hidden = false;
        }
    }

    function showError(message) {
        ui.errorText.textContent = message;
        ui.error.hidden = false;
    }

    function clearError() {
        ui.error.hidden = true;
        ui.errorText.textContent = "";
    }

    async function loadStats() {
        try {
            if (typeof window.getDashboardStats === "function") {
                const response = await window.getDashboardStats();
                const s = response?.stats || response || {};
                ui.total.textContent = s.total_scans ?? records.length ?? 0;
                ui.uploads.textContent = s.upload_scans ?? 0;
                ui.cameras.textContent = s.camera_scans ?? 0;
                ui.objects.textContent = s.total_objects_detected ?? 0;
                return;
            }
        } catch (error) {
            console.warn("Dashboard stats unavailable:", error);
        }

        ui.total.textContent = records.length;
        ui.uploads.textContent = records.filter(r => sourceOf(r).includes("upload")).length;
        ui.cameras.textContent = records.filter(r => sourceOf(r).includes("camera")).length;
        ui.objects.textContent = records.reduce((sum, r) => sum + objectCountOf(r), 0);
    }

    async function loadHistory() {
        clearError();
        setLoading(true);
        setStatus("CHECKING");

        try {
            if (typeof window.getHistory !== "function") {
                throw new Error("getHistory() was not found. Check js/api.js.");
            }

            const response = await window.getHistory(100);
            records = extractRecords(response);
            applyFilters();
            await loadStats();
            setStatus("ONLINE");
        } catch (error) {
            console.error("History loading failed:", error);
            records = [];
            render([]);
            showError(error?.message || "Unable to retrieve scan history.");
            setStatus("OFFLINE");
        } finally {
            setLoading(false);
        }
    }

    function applyFilters() {
        const query = ui.search.value.trim().toLowerCase();
        const source = ui.source.value;
        const period = ui.period.value;
        const now = Date.now();

        const filtered = records.filter(record => {
            if (source !== "all" && !sourceOf(record).includes(source)) return false;

            if (period !== "all") {
                const d = new Date(createdAt(record));
                if (!Number.isNaN(d.getTime())) {
                    const ageDays = (now - d.getTime()) / 86400000;
                    if (period === "today" && ageDays > 1) return false;
                    if (period === "7" && ageDays > 7) return false;
                    if (period === "30" && ageDays > 30) return false;
                }
            }

            if (!query) return true;

            const haystack = [
                scanId(record),
                sourceOf(record),
                textFromGemini(geminiOf(record)),
                ...detectionsOf(record).map(d => pick(d, "label", "class_name", "name", "class") || "")
            ].join(" ").toLowerCase();

            return haystack.includes(query);
        });

        render(filtered);
    }

    function render(list) {
        ui.grid.innerHTML = "";
        ui.empty.hidden = list.length !== 0;

        if (!list.length) return;

        const fragment = document.createDocumentFragment();

        list.forEach(record => {
            const id = scanId(record);
            const image = imageUrl(record);
            const source = sourceOf(record);
            const objects = objectCountOf(record);
            const description = textFromGemini(geminiOf(record));

            const card = document.createElement("article");
            card.className = "history-card";
            card.dataset.scanId = id;

            card.innerHTML = `
                <div class="history-card-image">
                    ${image
                        ? `<img src="${escapeHtml(image)}" alt="Scan ${escapeHtml(id)}" loading="lazy">`
                        : `<div class="history-camera-state"><span>No image preview</span></div>`}
                    <span class="history-source-badge">${escapeHtml(source.toUpperCase())}</span>
                </div>
                <div class="history-card-body">
                    <div class="history-card-title-row">
                        <h3>${escapeHtml(id)}</h3>
                        <span class="history-card-source">${escapeHtml(source)}</span>
                    </div>
                    <p>${escapeHtml(formatDate(createdAt(record)))}</p>
                    <p class="history-card-description">${escapeHtml(description.slice(0, 150))}</p>
                    <div class="history-card-stats">
                        <div class="history-card-stat"><span>OBJECTS</span><strong>${objects}</strong></div>
                        <div class="history-card-stat"><span>SIZE</span><strong>${escapeHtml(formatSize(record))}</strong></div>
                    </div>
                    <div class="history-card-actions">
                        <button class="secondary-button history-view-button" type="button">View Details</button>
                        <button class="history-card-delete" type="button" aria-label="Delete scan">×</button>
                    </div>
                </div>`;

            card.querySelector(".history-view-button").addEventListener("click", e => {
                e.stopPropagation();
                openRecord(record);
            });

            card.querySelector(".history-card-delete").addEventListener("click", e => {
                e.stopPropagation();
                selectedRecord = record;
                ui.deleteDialog.hidden = false;
                document.body.classList.add("modal-open");
            });

            card.addEventListener("dblclick", () => openRecord(record));
            fragment.appendChild(card);
        });

        ui.grid.appendChild(fragment);
    }

    function openRecord(record) {
        selectedRecord = record;
        const image = imageUrl(record);
        const detections = detectionsOf(record);

        ui.image.src = image || "";
        ui.image.hidden = !image;
        ui.cloudLink.hidden = !image;
        if (image) ui.cloudLink.href = image;

        ui.detailSource.textContent = sourceOf(record);
        ui.detailObjects.textContent = objectCountOf(record);
        ui.detailSize.textContent = formatSize(record);
        ui.modalScanId.textContent = scanId(record);

        ui.databaseDetails.innerHTML = `
            <div class="technical-grid">
                <div class="technical-item"><span>SCAN ID</span><strong>${escapeHtml(scanId(record))}</strong></div>
                <div class="technical-item"><span>CREATED</span><strong>${escapeHtml(formatDate(createdAt(record)))}</strong></div>
                <div class="technical-item"><span>SOURCE</span><strong>${escapeHtml(sourceOf(record))}</strong></div>
                <div class="technical-item"><span>IMAGE</span><strong>${image ? "Stored" : "Unavailable"}</strong></div>
            </div>`;

        ui.yoloDetails.innerHTML = detections.length
            ? `<div class="yolo-object-list">${detections.map(d => {
                const label = pick(d, "label", "class_name", "name", "class") || "Object";
                const confidence = pick(d, "confidence", "score", "probability");
                const conf = confidence !== null
                    ? `${(Number(confidence) <= 1 ? Number(confidence) * 100 : Number(confidence)).toFixed(1)}%`
                    : "-";
                return `<div class="modal-object-item"><strong>${escapeHtml(label)}</strong><span>Confidence: ${escapeHtml(conf)}</span></div>`;
            }).join("")}</div>`
            : `<div class="empty-result-message">No YOLO detections stored for this scan.</div>`;

        ui.geminiDetails.innerHTML = `
            <div class="gemini-card">
                <h4>Visual Intelligence</h4>
                <p>${escapeHtml(textFromGemini(geminiOf(record))).replace(/\n/g, "<br>")}</p>
            </div>`;

        ui.modal.hidden = false;
        document.body.classList.add("modal-open");
    }

    function closeRecord() {
        ui.modal.hidden = true;
        if (ui.deleteDialog.hidden) document.body.classList.remove("modal-open");
    }

    async function deleteSelected() {
        if (!selectedRecord) return;

        const id = scanId(selectedRecord);
        ui.confirmDelete.disabled = true;
        ui.confirmDelete.textContent = "Deleting…";

        try {
            if (typeof window.deleteHistoryRecord === "function") {
                await window.deleteHistoryRecord(id);
            } else if (typeof window.deleteHistory === "function") {
                await window.deleteHistory(id);
            } else if (typeof window.deleteScan === "function") {
                await window.deleteScan(id);
            } else {
                throw new Error("No history delete function was found in js/api.js.");
            }

            records = records.filter(r => String(scanId(r)) !== String(id));
            ui.deleteDialog.hidden = true;
            ui.modal.hidden = true;
            selectedRecord = null;
            document.body.classList.remove("modal-open");
            applyFilters();
            await loadStats();
        } catch (error) {
            ui.deleteDialog.hidden = true;
            showError(error?.message || "Unable to delete this scan.");
        } finally {
            ui.confirmDelete.disabled = false;
            ui.confirmDelete.textContent = "Delete";
        }
    }

    ui.searchButton.addEventListener("click", applyFilters);
    ui.search.addEventListener("input", applyFilters);
    ui.period.addEventListener("change", applyFilters);
    ui.source.addEventListener("change", applyFilters);
    ui.refresh.addEventListener("click", loadHistory);

    ui.closeModal.addEventListener("click", closeRecord);
    ui.modalBackdrop.addEventListener("click", closeRecord);
    ui.deleteButton.addEventListener("click", () => {
        if (!selectedRecord) return;
        ui.deleteDialog.hidden = false;
    });
    ui.cancelDelete.addEventListener("click", () => {
        ui.deleteDialog.hidden = true;
        if (ui.modal.hidden) document.body.classList.remove("modal-open");
    });
    ui.confirmDelete.addEventListener("click", deleteSelected);

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        if (!ui.deleteDialog.hidden) {
            ui.deleteDialog.hidden = true;
            return;
        }
        if (!ui.modal.hidden) closeRecord();
    });

    loadHistory();
});
