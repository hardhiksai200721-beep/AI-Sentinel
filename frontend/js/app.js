// ============================================================
// HARDHIK AI RECOGNITION / MONITORING SYSTEM
// SHARED APPLICATION JAVASCRIPT
// ============================================================

"use strict";


// ============================================================
// APPLICATION STATE
// ============================================================

const AppState = {
    backendOnline: false,
    healthData: null,
    dashboardStats: null,
    currentPage: "",
};


// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log(
        "%c HARDHIK AI SYSTEM ",
        "background:#8b0014;color:white;font-weight:bold;padding:5px 10px;"
    );

    detectCurrentPage();

    initializeSidebar();

    initializeNavigation();

    initializeRefreshButtons();

    initializeTiltCards();

    initializeKeyboardShortcuts();

    await initializeBackendStatus();

    if (AppState.currentPage === "dashboard") {
        await initializeDashboard();
    }
});


// ============================================================
// DETECT CURRENT PAGE
// ============================================================

function detectCurrentPage() {

    const path =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

    if (
        path === "" ||
        path === "/" ||
        path === "index.html"
    ) {
        AppState.currentPage = "dashboard";
    }

    else if (path === "scanner.html") {
        AppState.currentPage = "scanner";
    }

    else if (path === "camera.html") {
        AppState.currentPage = "camera";
    }

    else if (path === "history.html") {
        AppState.currentPage = "history";
    }

    else {
        AppState.currentPage = "unknown";
    }

    console.log(
        "Current page:",
        AppState.currentPage
    );
}


// ============================================================
// SIDEBAR
// ============================================================

function initializeSidebar() {

    const sidebar =
        document.querySelector(".sidebar");

    const overlay =
        document.querySelector(".sidebar-overlay");

    const menuButton =
        document.querySelector(".menu-button");

    if (!sidebar) {
        return;
    }

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle("open");

                if (overlay) {
                    overlay.classList.toggle("show");
                }
            }
        );
    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            () => {

                sidebar.classList.remove("open");

                overlay.classList.remove("show");
            }
        );
    }

    const navLinks =
        sidebar.querySelectorAll(".nav-link");

    navLinks.forEach((link) => {

        link.addEventListener(
            "click",
            () => {

                if (window.innerWidth <= 960) {

                    sidebar.classList.remove("open");

                    if (overlay) {
                        overlay.classList.remove("show");
                    }
                }
            }
        );
    });
}


// ============================================================
// ACTIVE NAVIGATION
// ============================================================

function initializeNavigation() {

    const links =
        document.querySelectorAll(".nav-link");

    links.forEach((link) => {

        link.classList.remove("active");

        const href =
            link
                .getAttribute("href")
                ?.toLowerCase();

        if (!href) {
            return;
        }

        let active = false;

        switch (AppState.currentPage) {

            case "dashboard":

                active =
                    href === "index.html" ||
                    href === "./index.html" ||
                    href === "/";

                break;

            case "scanner":

                active =
                    href.includes("scanner.html");

                break;

            case "camera":

                active =
                    href.includes("camera.html");

                break;

            case "history":

                active =
                    href.includes("history.html");

                break;
        }

        if (active) {
            link.classList.add("active");
        }
    });
}


// ============================================================
// BACKEND HEALTH
// ============================================================

async function initializeBackendStatus() {

    setBackendStatus(
        "checking",
        "CHECKING"
    );

    /*
        api.js provides:

        getHealth()
    */

    if (typeof getHealth !== "function") {

        console.warn(
            "getHealth() not found. Check api.js."
        );

        setBackendStatus(
            "offline",
            "API ERROR"
        );

        return;
    }

    try {

        const data =
            await getHealth();

        AppState.healthData = data;

        AppState.backendOnline = true;

        setBackendStatus(
            "online",
            "ONLINE"
        );

        updateSidebarSystem(data);

    } catch (error) {

        AppState.backendOnline = false;

        console.error(
            "Backend health check failed:",
            error
        );

        setBackendStatus(
            "offline",
            "OFFLINE"
        );

        updateSidebarSystem(null);
    }
}


// ============================================================
// SET BACKEND STATUS
// ============================================================

function setBackendStatus(
    status,
    text
) {

    const containers =
        document.querySelectorAll(
            ".backend-status"
        );

    containers.forEach(
        (container) => {

            container.classList.remove(
                "online",
                "offline",
                "checking"
            );

            container.classList.add(status);

            const strong =
                container.querySelector(
                    "strong"
                );

            if (strong) {
                strong.textContent = text;
            }

            const dot =
                container.querySelector(
                    ".status-dot"
                );

            if (dot) {

                if (status === "online") {

                    dot.style.background =
                        "#42e68b";

                    dot.style.boxShadow =
                        "0 0 10px rgba(66,230,139,.7)";
                }

                else if (
                    status === "offline"
                ) {

                    dot.style.background =
                        "#ff3551";

                    dot.style.boxShadow =
                        "0 0 10px rgba(255,53,81,.7)";
                }

                else {

                    dot.style.background =
                        "#ffb648";

                    dot.style.boxShadow =
                        "0 0 10px rgba(255,182,72,.7)";
                }
            }
        }
    );
}


// ============================================================
// SIDEBAR PIPELINE STATUS
// ============================================================

function updateSidebarSystem(data) {

    const mappings = {

        opencv:
            data?.opencv,

        yolo:
            data?.yolo,

        gemini:
            data?.gemini,

        database:
            data?.database,

        cloud_storage:
            data?.cloud_storage,

        camera_api:
            data?.camera_api
    };

    Object.entries(
        mappings
    ).forEach(
        ([key, value]) => {

            const element =
                document.querySelector(
                    `[data-system="${key}"]`
                );

            if (!element) {
                return;
            }

            if (
                value === "ready" ||
                value === true
            ) {

                element.textContent =
                    "READY";

                element.style.color =
                    "#42e68b";
            }

            else {

                element.textContent =
                    "OFFLINE";

                element.style.color =
                    "#ff3551";
            }
        }
    );
}


// ============================================================
// DASHBOARD
// ============================================================

async function initializeDashboard() {

    if (
        typeof getDashboardStats !==
        "function"
    ) {

        console.warn(
            "getDashboardStats() missing."
        );

        return;
    }

    await loadDashboardStats();
}


// ============================================================
// LOAD DASHBOARD STATS
// ============================================================

async function loadDashboardStats() {

    try {

        const response =
            await getDashboardStats();

        const stats =
            response?.stats || {};

        AppState.dashboardStats =
            stats;

        updateStat(
            "totalScans",
            stats.total_scans ?? 0
        );

        updateStat(
            "uploadScans",
            stats.upload_scans ?? 0
        );

        updateStat(
            "cameraScans",
            stats.camera_scans ?? 0
        );

        updateStat(
            "totalObjects",
            stats.total_objects_detected ?? 0
        );

        updateStat(
            "averageObjects",
            stats.average_objects_per_scan ?? 0
        );

        updateStat(
            "todayScans",
            stats.today_scans ?? 0
        );

        updateStat(
            "weekScans",
            stats.last_7_days ?? 0
        );

        updateStat(
            "monthScans",
            stats.last_30_days ?? 0
        );

        /*
            Alternative support.

            If HTML uses data-stat instead
            of IDs, these will also update.
        */

        updateDataStat(
            "total-scans",
            stats.total_scans ?? 0
        );

        updateDataStat(
            "upload-scans",
            stats.upload_scans ?? 0
        );

        updateDataStat(
            "camera-scans",
            stats.camera_scans ?? 0
        );

        updateDataStat(
            "objects",
            stats.total_objects_detected ?? 0
        );

        updateDataStat(
            "average",
            stats.average_objects_per_scan ?? 0
        );

        updateDataStat(
            "today",
            stats.today_scans ?? 0
        );

        updateDataStat(
            "week",
            stats.last_7_days ?? 0
        );

        updateDataStat(
            "month",
            stats.last_30_days ?? 0
        );

        updateModuleCounters(stats);

    } catch (error) {

        console.error(
            "Dashboard statistics failed:",
            error
        );

        showToast(
            "Unable to load dashboard statistics.",
            "error"
        );
    }
}


// ============================================================
// UPDATE DASHBOARD ELEMENT
// ============================================================

function updateStat(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    animateNumber(
        element,
        value
    );
}


// ============================================================
// DATA ATTRIBUTE STAT
// ============================================================

function updateDataStat(
    name,
    value
) {

    const elements =
        document.querySelectorAll(
            `[data-stat="${name}"]`
        );

    elements.forEach(
        (element) => {

            animateNumber(
                element,
                value
            );
        }
    );
}


// ============================================================
// MODULE COUNTERS
// ============================================================

function updateModuleCounters(stats) {

    const scannerCounter =
        document.querySelector(
            '[data-module-count="scanner"]'
        );

    const cameraCounter =
        document.querySelector(
            '[data-module-count="camera"]'
        );

    const historyCounter =
        document.querySelector(
            '[data-module-count="history"]'
        );

    if (scannerCounter) {

        scannerCounter.textContent =
            stats.upload_scans ?? 0;
    }

    if (cameraCounter) {

        cameraCounter.textContent =
            stats.camera_scans ?? 0;
    }

    if (historyCounter) {

        historyCounter.textContent =
            stats.total_scans ?? 0;
    }
}


// ============================================================
// NUMBER ANIMATION
// ============================================================

function animateNumber(
    element,
    finalValue
) {

    if (!element) {
        return;
    }

    const numericValue =
        Number(finalValue);

    if (
        Number.isNaN(numericValue)
    ) {

        element.textContent =
            finalValue;

        return;
    }

    const decimal =
        !Number.isInteger(
            numericValue
        );

    const duration = 550;

    const startTime =
        performance.now();

    function update(currentTime) {

        const elapsed =
            currentTime -
            startTime;

        const progress =
            Math.min(
                elapsed / duration,
                1
            );

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );

        const current =
            numericValue * eased;

        element.textContent =
            decimal
                ? current.toFixed(2)
                : Math.round(current);

        if (progress < 1) {

            requestAnimationFrame(
                update
            );
        }

        else {

            element.textContent =
                decimal
                    ? numericValue.toFixed(2)
                    : numericValue;
        }
    }

    requestAnimationFrame(update);
}


// ============================================================
// REFRESH BUTTONS
// ============================================================

function initializeRefreshButtons() {

    const buttons =
        document.querySelectorAll(
            ".topbar-refresh"
        );

    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                async () => {

                    button.disabled = true;

                    const oldText =
                        button.textContent;

                    button.textContent =
                        "REFRESHING...";

                    try {

                        await initializeBackendStatus();

                        if (
                            AppState.currentPage ===
                            "dashboard"
                        ) {

                            await loadDashboardStats();
                        }

                        /*
                            Page-specific scripts
                            can listen to this.
                        */

                        document.dispatchEvent(
                            new CustomEvent(
                                "app:refresh"
                            )
                        );

                        showToast(
                            "System refreshed.",
                            "success"
                        );

                    } catch (error) {

                        console.error(error);

                        showToast(
                            "Refresh failed.",
                            "error"
                        );
                    }

                    finally {

                        button.disabled =
                            false;

                        button.textContent =
                            oldText;
                    }
                }
            );
        }
    );
}


// ============================================================
// TOAST SYSTEM
// ============================================================

function showToast(
    message,
    type = "info",
    duration = 3200
) {

    let container =
        document.querySelector(
            ".toast-container"
        );

    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.className =
            "toast-container";

        document.body.appendChild(
            container
        );
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `app-toast ${type}`;

    const icon =
        document.createElement(
            "span"
        );

    icon.className =
        "toast-icon";

    if (type === "success") {

        icon.textContent = "✓";
    }

    else if (
        type === "error"
    ) {

        icon.textContent = "!";
    }

    else {

        icon.textContent = "i";
    }

    const text =
        document.createElement(
            "span"
        );

    text.textContent =
        message;

    toast.append(
        icon,
        text
    );

    container.appendChild(
        toast
    );

    requestAnimationFrame(
        () => {

            toast.classList.add(
                "show"
            );
        }
    );

    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

            setTimeout(
                () => toast.remove(),
                220
            );

        },
        duration
    );
}


// ============================================================
// 3D TILT CARDS
// ============================================================

function initializeTiltCards() {

    /*
        Desktop only.

        This creates a subtle 3D movement,
        not an aggressive rotation.
    */

    if (
        window.matchMedia(
            "(pointer: coarse)"
        ).matches
    ) {
        return;
    }

    const cards =
        document.querySelectorAll(
            ".tilt-card"
        );

    cards.forEach(
        (card) => {

            card.addEventListener(
                "mousemove",
                (event) => {

                    const rect =
                        card.getBoundingClientRect();

                    const x =
                        event.clientX -
                        rect.left;

                    const y =
                        event.clientY -
                        rect.top;

                    const centerX =
                        rect.width / 2;

                    const centerY =
                        rect.height / 2;

                    const rotateX =
                        (
                            (y - centerY) /
                            centerY
                        ) * -2.5;

                    const rotateY =
                        (
                            (x - centerX) /
                            centerX
                        ) * 2.5;

                    card.style.transform =
                        `
                        perspective(900px)
                        rotateX(${rotateX}deg)
                        rotateY(${rotateY}deg)
                        translateY(-3px)
                        `;
                }
            );

            card.addEventListener(
                "mouseleave",
                () => {

                    card.style.transform =
                        "";
                }
            );
        }
    );
}


// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

function initializeKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        (event) => {

            /*
                Ignore shortcuts while
                user types into inputs.
            */

            const target =
                event.target;

            if (
                target instanceof
                HTMLInputElement ||
                target instanceof
                HTMLTextAreaElement
            ) {
                return;
            }

            /*
                ALT + D = Dashboard
                ALT + S = Scanner
                ALT + C = Camera
                ALT + H = History
            */

            if (!event.altKey) {
                return;
            }

            const key =
                event.key.toLowerCase();

            switch (key) {

                case "d":

                    window.location.href =
                        "index.html";

                    break;

                case "s":

                    window.location.href =
                        "scanner.html";

                    break;

                case "c":

                    window.location.href =
                        "camera.html";

                    break;

                case "h":

                    window.location.href =
                        "history.html";

                    break;
            }
        }
    );
}


// ============================================================
// FORMAT FILE SIZE
// ============================================================

function formatFileSize(bytes) {

    const size =
        Number(bytes || 0);

    if (size === 0) {
        return "0 KB";
    }

    if (size < 1024) {

        return `${size} B`;
    }

    const kb =
        size / 1024;

    if (kb < 1024) {

        return `${kb.toFixed(2)} KB`;
    }

    const mb =
        kb / 1024;

    return `${mb.toFixed(2)} MB`;
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatAppDate(
    value
) {

    if (!value) {
        return "Unknown";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }

    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// ============================================================
// SAFE TEXT
// ============================================================

function safeText(
    value,
    fallback = "Unknown"
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;
    }

    return String(value);
}


// ============================================================
// CONFIDENCE FORMATTER
// ============================================================

function formatConfidence(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "N/A";
    }

    const number =
        Number(value);

    if (
        Number.isNaN(number)
    ) {

        return String(value);
    }

    /*
        YOLO normally gives:
        0.8661

        Convert to:
        86.61%
    */

    if (
        number >= 0 &&
        number <= 1
    ) {

        return `${(
            number * 100
        ).toFixed(2)}%`;
    }

    return `${number.toFixed(2)}%`;
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    const element =
        document.createElement(
            "div"
        );

    element.textContent =
        safeText(
            value,
            ""
        );

    return element.innerHTML;
}


// ============================================================
// PIPELINE STATUS HELPER
// ============================================================

function pipelineReady(
    value
) {

    return (
        value === "ready" ||
        value === true ||
        value === "success" ||
        value === "ok"
    );
}


// ============================================================
// STORAGE STATUS HELPER
// ============================================================

function databaseSaved(
    response
) {

    return Boolean(
        response?.database?.saved
    );
}


function cloudinarySaved(
    response
) {

    return Boolean(
        response?.cloudinary?.secure_url ||
        response?.cloudinary?.public_id
    );
}


// ============================================================
// GLOBAL APPLICATION ERROR HANDLING
// ============================================================

window.addEventListener(
    "unhandledrejection",
    (event) => {

        console.error(
            "Unhandled Promise Rejection:",
            event.reason
        );
    }
);


window.addEventListener(
    "error",
    (event) => {

        console.error(
            "Application Error:",
            event.error ||
            event.message
        );
    }
);


// ============================================================
// MAKE SHARED HELPERS AVAILABLE TO OTHER JS FILES
// ============================================================

window.AppState =
    AppState;

window.showToast =
    showToast;

window.formatFileSize =
    formatFileSize;

window.formatAppDate =
    formatAppDate;

window.safeText =
    safeText;

window.formatConfidence =
    formatConfidence;

window.escapeHTML =
    escapeHTML;

window.pipelineReady =
    pipelineReady;

window.databaseSaved =
    databaseSaved;

window.cloudinarySaved =
    cloudinarySaved;