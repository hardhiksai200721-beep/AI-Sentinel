"use strict";

// ============================================================
// AI SENTINEL - API CLIENT
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000";


// ============================================================
// GENERIC REQUEST
// ============================================================

async function apiRequest(endpoint, options = {}) {

    const url = `${API_BASE_URL}${endpoint}`;

    const config = {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        }
    };

    try {

        const response = await fetch(url, config);

        const contentType =
            response.headers.get("content-type") || "";

        let data = null;

        if (contentType.includes("application/json")) {

            try {
                data = await response.json();
            } catch {
                data = null;
            }

        } else {

            try {
                data = await response.text();
            } catch {
                data = null;
            }
        }

        if (!response.ok) {

            let message = `HTTP ${response.status}`;

            if (data && typeof data === "object") {

                message =
                    data.detail ||
                    data.message ||
                    data.error ||
                    message;

            } else if (typeof data === "string" && data.trim()) {

                message = data;
            }

            throw new Error(message);
        }

        return data;

    } catch (error) {

        console.error(
            `API request failed: ${endpoint}`,
            error
        );

        throw error;
    }
}


// ============================================================
// HEALTH
// ============================================================

async function getHealth() {
    return apiRequest("/api/health");
}


// ============================================================
// DASHBOARD STATISTICS
// ============================================================

async function getDashboardStats() {
    return apiRequest("/api/stats");
}


// ============================================================
// HISTORY
// ============================================================

async function getHistory(limit = 100) {

    const params = new URLSearchParams();

    params.set("limit", String(limit));

    return apiRequest(
        `/api/history?${params.toString()}`
    );
}


// ============================================================
// SINGLE HISTORY RECORD
// ============================================================

async function getScanById(scanId) {

    if (!scanId) {
        throw new Error("Scan ID is required.");
    }

    return apiRequest(
        `/api/history/${encodeURIComponent(scanId)}`
    );
}


// ============================================================
// DELETE HISTORY RECORD
// ============================================================

async function deleteScan(scanId) {

    if (!scanId) {
        throw new Error("Scan ID is required.");
    }

    return apiRequest(
        `/api/history/${encodeURIComponent(scanId)}`,
        {
            method: "DELETE"
        }
    );
}


// ============================================================
// SEARCH HISTORY
// ============================================================

async function searchHistory({
    query = "",
    period = "all",
    startDate = "",
    endDate = "",
    limit = 100
} = {}) {

    const params = new URLSearchParams();

    if (query.trim()) {
        params.set("q", query.trim());
    }

    params.set(
        "period",
        period || "all"
    );

    params.set(
        "limit",
        String(limit)
    );

    if (startDate) {
        params.set("start_date", startDate);
    }

    if (endDate) {
        params.set("end_date", endDate);
    }

    return apiRequest(
        `/api/history/search?${params.toString()}`
    );
}


// ============================================================
// IMAGE UPLOAD SCAN
// ============================================================

async function scanUploadedImage(file) {

    if (!file) {
        throw new Error("Image file is required.");
    }

    const formData = new FormData();

    formData.append(
        "file",
        file
    );

    return apiRequest(
        "/api/scan",
        {
            method: "POST",
            body: formData
        }
    );
}


// ============================================================
// CAMERA LIVE YOLO
// ============================================================

async function detectCameraFrame(imageBlob) {

    if (!imageBlob) {
        throw new Error("Camera frame is required.");
    }

    const formData = new FormData();

    formData.append(
        "file",
        imageBlob,
        "camera_frame.jpg"
    );

    return apiRequest(
        "/api/camera/detect",
        {
            method: "POST",
            body: formData
        }
    );
}


// ============================================================
// CAMERA FULL AI SCAN
// ============================================================

async function scanCameraFrame(imageBlob) {

    if (!imageBlob) {
        throw new Error("Camera image is required.");
    }

    const formData = new FormData();

    formData.append(
        "file",
        imageBlob,
        "camera_capture.jpg"
    );

    return apiRequest(
        "/api/camera/scan",
        {
            method: "POST",
            body: formData
        }
    );
}


// ============================================================
// EXPORT API FUNCTIONS
// ============================================================

window.API_BASE_URL =
    API_BASE_URL;

window.apiRequest =
    apiRequest;

window.getHealth =
    getHealth;

window.getDashboardStats =
    getDashboardStats;

window.getHistory =
    getHistory;

window.getScanById =
    getScanById;

window.deleteScan =
    deleteScan;

window.searchHistory =
    searchHistory;

window.scanUploadedImage =
    scanUploadedImage;

window.detectCameraFrame =
    detectCameraFrame;

window.scanCameraFrame =
    scanCameraFrame;


console.log(
    "AI Sentinel API ready:",
    API_BASE_URL
);