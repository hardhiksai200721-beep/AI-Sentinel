"use strict";

// ============================================================
// AI SENTINEL - API CLIENT
// ============================================================

const API_BASE_URL = "https://ai-sentinel-uueb.onrender.com";

const DEFAULT_TIMEOUT = 120000;


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// GENERIC REQUEST
// ============================================================

async function apiRequest(endpoint, options = {}) {

    const url = `${API_BASE_URL}${endpoint}`;

    const controller = new AbortController();

    const timeout =
        options.timeout || DEFAULT_TIMEOUT;

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeout);

    const {
        timeout: _ignoredTimeout,
        ...fetchOptions
    } = options;

    const config = {
        ...fetchOptions,

        signal: controller.signal,

        headers: {
            Accept: "application/json",
            ...(fetchOptions.headers || {})
        }
    };

    try {

        console.log(
            `[AI Sentinel] ${config.method || "GET"} ${url}`
        );

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


        // ----------------------------------------------------
        // HTTP ERROR
        // ----------------------------------------------------

        if (!response.ok) {

            let message =
                `HTTP ${response.status} ${response.statusText}`;

            if (
                data &&
                typeof data === "object"
            ) {

                message =
                    data.detail ||
                    data.message ||
                    data.error ||
                    message;

            } else if (
                typeof data === "string" &&
                data.trim()
            ) {

                message = data;
            }

            throw new Error(message);
        }


        return data;

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                "Backend request timed out. Render may still be starting."
            );
        }

        console.error(
            `[AI Sentinel] API request failed: ${endpoint}`,
            error
        );

        throw error;

    } finally {

        clearTimeout(timeoutId);
    }
}


// ============================================================
// HEALTH
// ============================================================

async function getHealth() {

    return apiRequest(
        "/api/health",
        {
            timeout: 120000
        }
    );
}


// ============================================================
// WAKE RENDER BACKEND
// ============================================================

async function wakeBackend(
    attempts = 3,
    delay = 5000
) {

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= attempts;
        attempt++
    ) {

        try {

            console.log(
                `[AI Sentinel] Backend health check ${attempt}/${attempts}`
            );

            const health = await getHealth();

            if (
                health &&
                (
                    health.status === "healthy" ||
                    health.backend === "online"
                )
            ) {

                console.log(
                    "[AI Sentinel] Backend ONLINE"
                );

                return health;
            }

        } catch (error) {

            lastError = error;

            console.warn(
                `[AI Sentinel] Backend not ready (${attempt}/${attempts})`,
                error.message
            );
        }


        if (attempt < attempts) {

            await sleep(delay);
        }
    }


    throw (
        lastError ||
        new Error("Backend is unavailable.")
    );
}


// ============================================================
// DASHBOARD STATISTICS
// ============================================================

async function getDashboardStats() {

    await wakeBackend();

    return apiRequest(
        "/api/stats"
    );
}


// ============================================================
// HISTORY
// ============================================================

async function getHistory(limit = 100) {

    await wakeBackend();

    const params =
        new URLSearchParams();

    params.set(
        "limit",
        String(limit)
    );

    return apiRequest(
        `/api/history?${params.toString()}`
    );
}


// ============================================================
// SINGLE HISTORY RECORD
// ============================================================

async function getScanById(scanId) {

    if (!scanId) {

        throw new Error(
            "Scan ID is required."
        );
    }

    await wakeBackend();

    return apiRequest(
        `/api/history/${encodeURIComponent(scanId)}`
    );
}


// ============================================================
// DELETE HISTORY RECORD
// ============================================================

async function deleteScan(scanId) {

    if (!scanId) {

        throw new Error(
            "Scan ID is required."
        );
    }

    await wakeBackend();

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

    await wakeBackend();

    const params =
        new URLSearchParams();

    if (query.trim()) {

        params.set(
            "q",
            query.trim()
        );
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

        params.set(
            "start_date",
            startDate
        );
    }

    if (endDate) {

        params.set(
            "end_date",
            endDate
        );
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

        throw new Error(
            "Image file is required."
        );
    }


    // Wake Render before sending potentially expensive scan
    await wakeBackend();


    const formData =
        new FormData();

    formData.append(
        "file",
        file,
        file.name || "uploaded_image.jpg"
    );


    return apiRequest(
        "/api/scan",
        {
            method: "POST",

            body: formData,

            // AI analysis can take longer
            timeout: 180000
        }
    );
}


// ============================================================
// CAMERA LIVE YOLO
// ============================================================

async function detectCameraFrame(imageBlob) {

    if (!imageBlob) {

        throw new Error(
            "Camera frame is required."
        );
    }


    await wakeBackend();


    const formData =
        new FormData();

    formData.append(
        "file",
        imageBlob,
        "camera_frame.jpg"
    );


    return apiRequest(
        "/api/camera/detect",
        {
            method: "POST",

            body: formData,

            timeout: 120000
        }
    );
}


// ============================================================
// CAMERA FULL AI SCAN
// ============================================================

async function scanCameraFrame(imageBlob) {

    if (!imageBlob) {

        throw new Error(
            "Camera image is required."
        );
    }


    await wakeBackend();


    const formData =
        new FormData();

    formData.append(
        "file",
        imageBlob,
        "camera_capture.jpg"
    );


    return apiRequest(
        "/api/camera/scan",
        {
            method: "POST",

            body: formData,

            timeout: 180000
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

window.wakeBackend =
    wakeBackend;

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


// ============================================================
// READY
// ============================================================

console.log(
    "AI Sentinel API ready:",
    API_BASE_URL
);