"use strict";

// ============================================================
// AI SENTINEL - CAMERA MODULE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================================
    // DOM ELEMENTS
    // ========================================================

    const video = document.getElementById("cameraVideo");
    const overlay = document.getElementById("cameraOverlay");
    const canvas = document.getElementById("cameraCanvas");

    const startButton = document.getElementById("startCameraButton");
    const captureButton = document.getElementById("captureButton");
    const toggleDetectionButton =
        document.getElementById("toggleDetectionButton");
    const stopButton = document.getElementById("stopCameraButton");

    const emptyState = document.getElementById("cameraEmptyState");
    const cameraHud = document.getElementById("cameraHud");
    const scanLine = document.getElementById("cameraScanLine");

    const cameraLiveDot = document.getElementById("cameraLiveDot");
    const cameraStatusText = document.getElementById("cameraStatusText");
    const sidebarCameraStatus =
        document.getElementById("sidebarCameraStatus");

    const cameraModeChip = document.getElementById("cameraModeChip");

    const liveObjectCount =
        document.getElementById("liveObjectCount");

    const cameraResolution =
        document.getElementById("cameraResolution");

    const detectedObjectCount =
        document.getElementById("detectedObjectCount");

    const analyzedFrameCount =
        document.getElementById("analyzedFrameCount");

    const cameraObjectList =
        document.getElementById("cameraObjectList");

    const detectionStatusChip =
        document.getElementById("detectionStatusChip");

    const errorBox =
        document.getElementById("cameraError");

    const errorText =
        document.getElementById("cameraErrorText");

    const processing =
        document.getElementById("cameraProcessing");

    const processingPercent =
        document.getElementById("cameraProcessingPercent");

    const processingBar =
        document.getElementById("cameraProcessingBar");

    const processingMessage =
        document.getElementById("cameraProcessingMessage");

    const results =
        document.getElementById("cameraScanResults");

    const clearResultButton =
        document.getElementById("clearCameraResultButton");

    const resultObjectCount =
        document.getElementById("cameraResultObjectCount");

    const resultAICount =
        document.getElementById("cameraResultAICount");

    const cloudStatus =
        document.getElementById("cameraCloudStatus");

    const databaseStatus =
        document.getElementById("cameraDatabaseStatus");

    const resultImage =
        document.getElementById("cameraResultImage");

    const resultBoundingBoxes =
        document.getElementById("cameraResultBoundingBoxes");

    const resultYoloChip =
        document.getElementById("cameraResultYoloChip");

    const resultObjects =
        document.getElementById("cameraResultObjects");

    const geminiResults =
        document.getElementById("cameraGeminiResults");

    const cloudinaryResult =
        document.getElementById("cameraCloudinaryResult");

    const supabaseResult =
        document.getElementById("cameraSupabaseResult");

    const originalSize =
        document.getElementById("cameraOriginalSize");

    const compressedSize =
        document.getElementById("cameraCompressedSize");

    const compressionQuality =
        document.getElementById("cameraCompressionQuality");

    const resultResolution =
        document.getElementById("cameraResultResolution");

    const resultScanId =
        document.getElementById("cameraResultScanId");


    // ========================================================
    // VERIFY REQUIRED HTML
    // ========================================================

    if (
        !video ||
        !overlay ||
        !canvas ||
        !startButton ||
        !captureButton ||
        !toggleDetectionButton ||
        !stopButton
    ) {
        console.error(
            "Camera module could not start: required HTML elements missing."
        );

        return;
    }


    // ========================================================
    // STATE
    // ========================================================

    let stream = null;

    let detectionEnabled = true;
    let detectionRunning = false;
    let detectionRequestActive = false;

    let detectionTimer = null;

    let analyzedFrames = 0;

    let currentObjects = [];

    const DETECTION_INTERVAL = 900;

    // Small frame for fast YOLO detection.
    const DETECTION_MAX_WIDTH = 640;
    const DETECTION_QUALITY = 0.65;


    // ========================================================
    // START CAMERA
    // ========================================================

    startButton.addEventListener("click", startCamera);


    async function startCamera() {

        clearError();

        if (stream) {
            return;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            showCameraError(
                "Your browser does not support camera access."
            );

            return;
        }

        try {

            startButton.disabled = true;

            updateCameraStatus(
                "STARTING",
                false
            );

            cameraModeChip.textContent = "STARTING";

            stream =
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: {
                            ideal: 1280
                        },
                        height: {
                            ideal: 720
                        }
                    },
                    audio: false
                });


            video.srcObject = stream;

            video.hidden = false;

            await video.play();

            await waitForVideo();


            // Hide offline screen.
            if (emptyState) {
                emptyState.hidden = true;
            }

            if (cameraHud) {
                cameraHud.hidden = false;
            }


            cameraResolution.textContent =
                `${video.videoWidth} × ${video.videoHeight}`;


            updateCameraStatus(
                "ONLINE",
                true
            );


            cameraModeChip.textContent =
                "LIVE";


            startButton.disabled = true;
            captureButton.disabled = false;
            toggleDetectionButton.disabled = false;
            stopButton.disabled = false;


            analyzedFrames = 0;

            analyzedFrameCount.textContent = "0";


            if (detectionEnabled) {
                startDetection();
            }


            notify(
                "Camera activated successfully.",
                "success"
            );

        } catch (error) {

            console.error(
                "Camera start error:",
                error
            );


            stream = null;

            video.srcObject = null;
            video.hidden = true;


            startButton.disabled = false;
            captureButton.disabled = true;
            toggleDetectionButton.disabled = true;
            stopButton.disabled = true;


            updateCameraStatus(
                "OFFLINE",
                false
            );


            cameraModeChip.textContent =
                "STANDBY";


            let message =
                "Unable to access the camera.";


            if (error.name === "NotAllowedError") {

                message =
                    "Camera permission was denied. Allow camera permission in Chrome and try again.";
            }

            else if (error.name === "NotFoundError") {

                message =
                    "No camera was detected on this computer.";
            }

            else if (error.name === "NotReadableError") {

                message =
                    "The camera is being used by another application.";
            }


            showCameraError(message);

            notify(
                message,
                "error"
            );
        }
    }


    // ========================================================
    // WAIT FOR VIDEO
    // ========================================================

    function waitForVideo() {

        return new Promise((resolve) => {

            if (
                video.videoWidth > 0 &&
                video.videoHeight > 0
            ) {
                resolve();
                return;
            }


            video.addEventListener(
                "loadedmetadata",
                () => resolve(),
                {
                    once: true
                }
            );
        });
    }


    // ========================================================
    // STOP CAMERA
    // ========================================================

    stopButton.addEventListener(
        "click",
        stopCamera
    );


    function stopCamera() {

        stopDetection();


        if (stream) {

            stream
                .getTracks()
                .forEach((track) => {
                    track.stop();
                });
        }


        stream = null;

        video.srcObject = null;
        video.hidden = true;


        clearLiveBoundingBoxes();


        if (emptyState) {
            emptyState.hidden = false;
        }

        if (cameraHud) {
            cameraHud.hidden = true;
        }


        startButton.disabled = false;
        captureButton.disabled = true;
        toggleDetectionButton.disabled = true;
        stopButton.disabled = true;


        updateCameraStatus(
            "OFFLINE",
            false
        );


        cameraModeChip.textContent =
            "STANDBY";


        detectionStatusChip.textContent =
            "WAITING";


        detectedObjectCount.textContent =
            "0";


        liveObjectCount.textContent =
            "0 OBJECTS";


        cameraResolution.textContent =
            "-";


        currentObjects = [];


        renderLiveObjectList([]);


        notify(
            "Camera stopped.",
            "info"
        );
    }


    // ========================================================
    // CAMERA STATUS
    // ========================================================

    function updateCameraStatus(
        text,
        online
    ) {

        if (cameraStatusText) {
            cameraStatusText.textContent = text;
        }


        if (sidebarCameraStatus) {

            sidebarCameraStatus.textContent =
                text;

            sidebarCameraStatus.style.color =
                online
                    ? "#42e68b"
                    : "#ff3551";
        }


        if (cameraLiveDot) {

            cameraLiveDot.classList.toggle(
                "online",
                online
            );

            cameraLiveDot.style.background =
                online
                    ? "#42e68b"
                    : "#626872";

            cameraLiveDot.style.boxShadow =
                online
                    ? "0 0 14px rgba(66,230,139,.7)"
                    : "none";
        }
    }


    // ========================================================
    // YOLO TOGGLE
    // ========================================================

    toggleDetectionButton.addEventListener(
        "click",
        () => {

            detectionEnabled =
                !detectionEnabled;


            if (detectionEnabled) {

                toggleDetectionButton.textContent =
                    "YOLO: ON";


                if (stream) {
                    startDetection();
                }


                notify(
                    "Live YOLO detection enabled.",
                    "success"
                );

            } else {

                toggleDetectionButton.textContent =
                    "YOLO: OFF";


                stopDetection();


                detectionStatusChip.textContent =
                    "PAUSED";


                clearLiveBoundingBoxes();


                notify(
                    "Live YOLO detection paused.",
                    "info"
                );
            }
        }
    );


    // ========================================================
    // START LIVE YOLO
    // ========================================================

    function startDetection() {

        if (
            detectionRunning ||
            !stream ||
            !detectionEnabled
        ) {
            return;
        }


        detectionRunning = true;

        detectionStatusChip.textContent =
            "ACTIVE";


        detectCurrentFrame();


        detectionTimer =
            setInterval(
                detectCurrentFrame,
                DETECTION_INTERVAL
            );
    }


    // ========================================================
    // STOP YOLO
    // ========================================================

    function stopDetection() {

        detectionRunning = false;


        if (detectionTimer) {

            clearInterval(
                detectionTimer
            );

            detectionTimer = null;
        }


        clearLiveBoundingBoxes();
    }


    // ========================================================
    // DETECT CAMERA FRAME
    // ========================================================

    async function detectCurrentFrame() {

        if (
            !stream ||
            !detectionRunning ||
            !detectionEnabled ||
            detectionRequestActive
        ) {
            return;
        }


        if (
            video.videoWidth === 0 ||
            video.videoHeight === 0
        ) {
            return;
        }


        if (
            typeof detectCameraFrame !==
            "function"
        ) {

            console.error(
                "detectCameraFrame() does not exist. Check api.js."
            );


            detectionStatusChip.textContent =
                "API ERROR";


            stopDetection();

            return;
        }


        detectionRequestActive = true;


        try {

            const frameBlob =
                await createDetectionBlob();


            if (!frameBlob) {
                return;
            }


            const data =
                await detectCameraFrame(
                    frameBlob
                );


            analyzedFrames += 1;


            analyzedFrameCount.textContent =
                String(analyzedFrames);


            currentObjects =
                Array.isArray(data?.objects)
                    ? data.objects
                    : [];


            const count =
                Number(
                    data?.objects_detected ??
                    currentObjects.length
                );


            detectedObjectCount.textContent =
                String(count);


            liveObjectCount.textContent =
                `${count} ${
                    count === 1
                        ? "OBJECT"
                        : "OBJECTS"
                }`;


            detectionStatusChip.textContent =
                "LIVE";


            renderLiveObjectList(
                currentObjects
            );


            renderLiveBoundingBoxes(
                currentObjects,
                data?.frame
            );

        } catch (error) {

            console.error(
                "YOLO detection failed:",
                error
            );


            detectionStatusChip.textContent =
                "ERROR";
        }

        finally {

            detectionRequestActive = false;
        }
    }


    // ========================================================
    // CREATE SMALL DETECTION IMAGE
    // ========================================================

    async function createDetectionBlob() {

        const detectionCanvas =
            document.createElement(
                "canvas"
            );


        const scale =
            Math.min(
                1,
                DETECTION_MAX_WIDTH /
                    video.videoWidth
            );


        detectionCanvas.width =
            Math.round(
                video.videoWidth *
                scale
            );


        detectionCanvas.height =
            Math.round(
                video.videoHeight *
                scale
            );


        const context =
            detectionCanvas.getContext(
                "2d"
            );


        context.drawImage(
            video,
            0,
            0,
            detectionCanvas.width,
            detectionCanvas.height
        );


        return canvasToBlob(
            detectionCanvas,
            "image/jpeg",
            DETECTION_QUALITY
        );
    }


    // ========================================================
    // LIVE BOUNDING BOXES
    // ========================================================

    function renderLiveBoundingBoxes(
        objects,
        frame
    ) {

        clearLiveBoundingBoxes();


        if (
            !Array.isArray(objects) ||
            objects.length === 0
        ) {
            return;
        }


        const sourceWidth =
            Number(
                frame?.width ||
                video.videoWidth
            );


        const sourceHeight =
            Number(
                frame?.height ||
                video.videoHeight
            );


        if (
            !sourceWidth ||
            !sourceHeight
        ) {
            return;
        }


        objects.forEach((object) => {

            const box =
                object?.bounding_box;


            if (!box) {
                return;
            }


            const x1 =
                Number(box.x1);

            const y1 =
                Number(box.y1);

            const x2 =
                Number(box.x2);

            const y2 =
                Number(box.y2);


            const left =
                (x1 / sourceWidth) *
                100;


            const top =
                (y1 / sourceHeight) *
                100;


            const width =
                ((x2 - x1) /
                    sourceWidth) *
                100;


            const height =
                ((y2 - y1) /
                    sourceHeight) *
                100;


            const boundingBox =
                document.createElement(
                    "div"
                );


            boundingBox.className =
                "live-bounding-box";


            boundingBox.style.position =
                "absolute";

            boundingBox.style.left =
                `${left}%`;

            boundingBox.style.top =
                `${top}%`;

            boundingBox.style.width =
                `${width}%`;

            boundingBox.style.height =
                `${height}%`;

            boundingBox.style.border =
                "2px solid #ff1744";

            boundingBox.style.boxShadow =
                "0 0 15px rgba(255,23,68,.35)";

            boundingBox.style.pointerEvents =
                "none";


            const label =
                document.createElement(
                    "span"
                );


            label.className =
                "live-bounding-label";


            const confidence =
                Number(
                    object?.confidence ||
                    0
                );


            label.textContent =
                `${object?.name || "object"} ${(confidence * 100).toFixed(1)}%`;


            label.style.position =
                "absolute";

            label.style.left =
                "-2px";

            label.style.top =
                "-27px";

            label.style.padding =
                "5px 8px";

            label.style.background =
                "#ff1744";

            label.style.color =
                "#ffffff";

            label.style.fontSize =
                "10px";

            label.style.fontWeight =
                "700";

            label.style.whiteSpace =
                "nowrap";


            boundingBox.appendChild(
                label
            );


            overlay.appendChild(
                boundingBox
            );
        });
    }


    function clearLiveBoundingBoxes() {

        if (overlay) {
            overlay.innerHTML = "";
        }
    }


    // ========================================================
    // LIVE OBJECT LIST
    // ========================================================

    function renderLiveObjectList(objects) {

        if (!cameraObjectList) {
            return;
        }


        cameraObjectList.innerHTML = "";


        if (
            !Array.isArray(objects) ||
            objects.length === 0
        ) {

            cameraObjectList.innerHTML =
                `
                <div class="empty-result-message">
                    No objects currently detected.
                </div>
                `;

            return;
        }


        objects.forEach((object) => {

            const confidence =
                Number(
                    object?.confidence ||
                    0
                );


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "camera-live-object";


            item.innerHTML =
                `
                <div>
                    <span>DETECTED</span>
                    <strong>
                        ${escapeValue(
                            object?.name ||
                            "Object"
                        )}
                    </strong>
                </div>

                <span>
                    ${(confidence * 100).toFixed(1)}%
                </span>
                `;


            cameraObjectList.appendChild(
                item
            );
        });
    }


    // ========================================================
    // FULL GEMINI AI SCAN
    // ========================================================

    captureButton.addEventListener(
        "click",
        runFullAIScan
    );


    async function runFullAIScan() {

        clearError();


        if (!stream) {

            showCameraError(
                "Start the camera before running an AI scan."
            );

            return;
        }


        if (
            typeof scanCameraFrame !==
            "function"
        ) {

            showCameraError(
                "scanCameraFrame() is unavailable. Check api.js."
            );

            return;
        }


        captureButton.disabled = true;


        if (scanLine) {
            scanLine.hidden = false;
        }


        processing.hidden = false;

        results.hidden = true;


        updateProcessing(
            10,
            "Capturing camera frame..."
        );


        try {

            // Full resolution frame.
            canvas.width =
                video.videoWidth;

            canvas.height =
                video.videoHeight;


            const context =
                canvas.getContext("2d");


            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );


            updateProcessing(
                25,
                "Preparing image for AI analysis..."
            );


            const blob =
                await canvasToBlob(
                    canvas,
                    "image/jpeg",
                    0.88
                );


            if (!blob) {

                throw new Error(
                    "Unable to capture camera image."
                );
            }


            updateProcessing(
                45,
                "Running YOLO and Gemini Vision..."
            );


            /*
             * This calls:
             *
             * POST /api/camera/scan
             *
             * through api.js
             */

            const responsePromise =
                scanCameraFrame(blob);


            animateProcessingWhileWaiting();


            const data =
                await responsePromise;


            updateProcessing(
                90,
                "Confirming Cloudinary and Supabase..."
            );


            renderFullScanResult(
                data
            );


            updateProcessing(
                100,
                "Analysis complete."
            );


            await delay(350);


            processing.hidden = true;

            results.hidden = false;


            results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });


            notify(
                "Full AI camera analysis completed.",
                "success"
            );

        } catch (error) {

            console.error(
                "Full camera scan failed:",
                error
            );


            processing.hidden = true;


            showCameraError(
                error?.message ||
                "Camera scan failed."
            );


            notify(
                error?.message ||
                "Camera scan failed.",
                "error"
            );
        }

        finally {

            if (scanLine) {
                scanLine.hidden = true;
            }


            if (stream) {
                captureButton.disabled = false;
            }
        }
    }


    // ========================================================
    // PROCESSING ANIMATION
    // ========================================================

    function updateProcessing(
        percent,
        message
    ) {

        if (processingPercent) {
            processingPercent.textContent =
                `${percent}%`;
        }


        if (processingBar) {
            processingBar.style.width =
                `${percent}%`;
        }


        if (processingMessage) {
            processingMessage.textContent =
                message;
        }
    }


    function animateProcessingWhileWaiting() {

        let value = 45;


        const timer =
            setInterval(() => {

                if (
                    processing.hidden ||
                    value >= 82
                ) {

                    clearInterval(timer);

                    return;
                }


                value += 2;


                updateProcessing(
                    value,
                    value < 65
                        ? "Gemini is analyzing the captured frame..."
                        : "Compressing and storing image..."
                );

            }, 400);
    }


    // ========================================================
    // RENDER FULL SCAN
    // ========================================================

    function renderFullScanResult(data) {

        console.log(
            "Camera full scan response:",
            data
        );


        const objects =
            Array.isArray(data?.objects)
                ? data.objects
                : [];


        const aiAnalysis =
            Array.isArray(data?.ai_analysis)
                ? data.ai_analysis
                : [];


        // ----------------------------------------------------
        // SUMMARY
        // ----------------------------------------------------

        resultObjectCount.textContent =
            String(
                data?.objects_detected ??
                objects.length
            );


        resultAICount.textContent =
            String(
                aiAnalysis.length
            );


        const cloudSaved =
            Boolean(
                data?.cloudinary?.secure_url
            );


        const dbSaved =
            Boolean(
                data?.database?.saved
            );


        cloudStatus.textContent =
            cloudSaved
                ? "STORED"
                : "FAILED";


        databaseStatus.textContent =
            dbSaved
                ? "SAVED"
                : "FAILED";


        // ----------------------------------------------------
        // IMAGE
        // ----------------------------------------------------

        if (
            data?.cloudinary?.secure_url
        ) {

            resultImage.src =
                data.cloudinary.secure_url;

        } else {

            /*
             * If Cloudinary URL is unavailable,
             * display captured canvas.
             */

            resultImage.src =
                canvas.toDataURL(
                    "image/jpeg",
                    0.85
                );
        }


        resultImage.onload =
            () => {

                renderResultBoundingBoxes(
                    objects,
                    data?.image
                );
            };


        // ----------------------------------------------------
        // YOLO
        // ----------------------------------------------------

        resultYoloChip.textContent =
            `${objects.length} ${
                objects.length === 1
                    ? "OBJECT"
                    : "OBJECTS"
            }`;


        renderResultObjects(
            objects
        );


        // ----------------------------------------------------
        // GEMINI
        // ----------------------------------------------------

        renderGeminiResults(
            aiAnalysis
        );


        // ----------------------------------------------------
        // CLOUDINARY
        // ----------------------------------------------------

        renderCloudinaryResult(
            data?.cloudinary
        );


        // ----------------------------------------------------
        // SUPABASE
        // ----------------------------------------------------

        renderSupabaseResult(
            data?.database
        );


        // ----------------------------------------------------
        // IMAGE INFORMATION
        // ----------------------------------------------------

        originalSize.textContent =
            data?.compression
                ?.original_size_kb != null
                ? `${data.compression.original_size_kb} KB`
                : data?.image?.size_kb != null
                    ? `${data.image.size_kb} KB`
                    : "-";


        compressedSize.textContent =
            data?.compression
                ?.compressed_size_kb != null
                ? `${data.compression.compressed_size_kb} KB`
                : "-";


        compressionQuality.textContent =
            data?.compression?.quality != null
                ? `${data.compression.quality}%`
                : "-";


        const width =
            data?.image?.width ??
            data?.compression?.width;


        const height =
            data?.image?.height ??
            data?.compression?.height;


        resultResolution.textContent =
            width && height
                ? `${width} × ${height}`
                : "-";


        resultScanId.textContent =
            data?.database?.scan_id ||
            "-";
    }


    // ========================================================
    // RESULT YOLO OBJECTS
    // ========================================================

    function renderResultObjects(objects) {

        resultObjects.innerHTML = "";


        if (!objects.length) {

            resultObjects.innerHTML =
                `
                <div class="empty-result-message">
                    YOLO did not detect any supported objects.
                </div>
                `;

            return;
        }


        objects.forEach(
            (object, index) => {

                const confidence =
                    Number(
                        object?.confidence ||
                        0
                    );


                const box =
                    object?.bounding_box ||
                    {};


                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "yolo-object-item";


                card.innerHTML =
                    `
                    <div class="yolo-object-number">
                        ${index + 1}
                    </div>

                    <div class="yolo-object-info">

                        <span>
                            OBJECT
                        </span>

                        <strong>
                            ${escapeValue(
                                object?.name ||
                                "Unknown"
                            )}
                        </strong>

                        <small>
                            BOX:
                            X1 ${box.x1 ?? "-"}
                            /
                            Y1 ${box.y1 ?? "-"}
                            /
                            X2 ${box.x2 ?? "-"}
                            /
                            Y2 ${box.y2 ?? "-"}
                        </small>

                    </div>

                    <div class="yolo-confidence">

                        <strong>
                            ${(confidence * 100).toFixed(1)}%
                        </strong>

                        <span>
                            CONFIDENCE
                        </span>

                    </div>
                    `;


                resultObjects.appendChild(
                    card
                );
            }
        );
    }


    // ========================================================
    // GEMINI RESULTS
    // ========================================================

    function renderGeminiResults(items) {

        geminiResults.innerHTML = "";


        if (!items.length) {

            geminiResults.innerHTML =
                `
                <div class="empty-result-message">
                    No Gemini analysis returned.
                </div>
                `;

            return;
        }


        items.forEach(
            (item, index) => {

                const alternatives =
                    Array.isArray(
                        item?.alternative_matches
                    )
                        ? item.alternative_matches
                        : [];


                const confidence =
                    item?.identification_confidence ??
                    item?.confidence ??
                    "Unknown";


                const card =
                    document.createElement(
                        "article"
                    );


                card.className =
                    "gemini-result-card";


                card.innerHTML =
                    `
                    <div class="gemini-result-header">

                        <span class="gemini-number">
                            AI ${index + 1}
                        </span>

                        <strong>
                            ${escapeValue(
                                item?.category ||
                                "Unknown"
                            )}
                        </strong>

                    </div>


                    <div class="gemini-result-grid">

                        ${informationRow(
                            "BRAND",
                            item?.brand
                        )}

                        ${informationRow(
                            "MODEL",
                            item?.model
                        )}

                        ${informationRow(
                            "PRODUCT FAMILY",
                            item?.product_family
                        )}

                        ${informationRow(
                            "CONFIDENCE",
                            confidence
                        )}

                    </div>


                    ${textSection(
                        "DESCRIPTION",
                        item?.description
                    )}


                    ${textSection(
                        "VISUAL EVIDENCE",
                        item?.visual_evidence
                    )}


                    ${textSection(
                        "VISIBLE TEXT",
                        item?.visible_text
                    )}


                    ${
                        alternatives.length
                            ? `
                            <div class="gemini-text-section">

                                <span>
                                    ALTERNATIVE MATCHES
                                </span>

                                <p>
                                    ${alternatives
                                        .map(
                                            escapeValue
                                        )
                                        .join(", ")}
                                </p>

                            </div>
                            `
                            : ""
                    }
                    `;


                geminiResults.appendChild(
                    card
                );
            }
        );
    }


    // ========================================================
    // CLOUDINARY RESULT
    // ========================================================

    function renderCloudinaryResult(cloud) {

        if (!cloudinaryResult) {
            return;
        }


        const content =
            cloudinaryResult.querySelector(
                ".storage-confirmation-content p"
            );


        const status =
            cloudinaryResult.querySelector(
                ".storage-confirmation-status"
            );


        if (
            cloud?.secure_url
        ) {

            if (content) {

                content.innerHTML =
                    `
                    Image stored successfully.<br>
                    ${escapeValue(
                        cloud.width
                    )} ×
                    ${escapeValue(
                        cloud.height
                    )}
                    •
                    ${escapeValue(
                        cloud.size_kb
                    )} KB
                    `;
            }


            if (status) {

                status.textContent =
                    "✓";
            }


            cloudinaryResult.classList.add(
                "storage-success"
            );

        } else {

            if (content) {

                content.textContent =
                    "Cloud storage was not confirmed.";
            }


            if (status) {

                status.textContent =
                    "!";
            }
        }
    }


    // ========================================================
    // SUPABASE RESULT
    // ========================================================

    function renderSupabaseResult(database) {

        if (!supabaseResult) {
            return;
        }


        const content =
            supabaseResult.querySelector(
                ".storage-confirmation-content p"
            );


        const status =
            supabaseResult.querySelector(
                ".storage-confirmation-status"
            );


        if (database?.saved) {

            if (content) {

                content.innerHTML =
                    `
                    Scan saved successfully.<br>
                    ID:
                    ${escapeValue(
                        database.scan_id ||
                        "-"
                    )}
                    `;
            }


            if (status) {

                status.textContent =
                    "✓";
            }


            supabaseResult.classList.add(
                "storage-success"
            );

        } else {

            if (content) {

                content.textContent =
                    "Database save was not confirmed.";
            }


            if (status) {

                status.textContent =
                    "!";
            }
        }
    }


    // ========================================================
    // RESULT BOUNDING BOXES
    // ========================================================

    function renderResultBoundingBoxes(
        objects,
        image
    ) {

        resultBoundingBoxes.innerHTML =
            "";


        const sourceWidth =
            Number(
                image?.width ||
                video.videoWidth
            );


        const sourceHeight =
            Number(
                image?.height ||
                video.videoHeight
            );


        if (
            !sourceWidth ||
            !sourceHeight
        ) {
            return;
        }


        objects.forEach((object) => {

            const box =
                object?.bounding_box;


            if (!box) {
                return;
            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "result-bounding-box";


            element.style.position =
                "absolute";


            element.style.left =
                `${(
                    Number(box.x1) /
                    sourceWidth
                ) * 100}%`;


            element.style.top =
                `${(
                    Number(box.y1) /
                    sourceHeight
                ) * 100}%`;


            element.style.width =
                `${(
                    (
                        Number(box.x2) -
                        Number(box.x1)
                    ) /
                    sourceWidth
                ) * 100}%`;


            element.style.height =
                `${(
                    (
                        Number(box.y2) -
                        Number(box.y1)
                    ) /
                    sourceHeight
                ) * 100}%`;


            element.style.border =
                "2px solid #ff1744";


            const label =
                document.createElement(
                    "span"
                );


            label.textContent =
                object?.name ||
                "Object";


            element.appendChild(
                label
            );


            resultBoundingBoxes.appendChild(
                element
            );
        });
    }


    // ========================================================
    // CLEAR FULL RESULT
    // ========================================================

    if (clearResultButton) {

        clearResultButton.addEventListener(
            "click",
            () => {

                results.hidden = true;


                resultObjects.innerHTML =
                    "";

                geminiResults.innerHTML =
                    "";

                resultBoundingBoxes.innerHTML =
                    "";

                resultImage.removeAttribute(
                    "src"
                );


                resultObjectCount.textContent =
                    "0";

                resultAICount.textContent =
                    "0";

                cloudStatus.textContent =
                    "-";

                databaseStatus.textContent =
                    "-";

                originalSize.textContent =
                    "-";

                compressedSize.textContent =
                    "-";

                compressionQuality.textContent =
                    "-";

                resultResolution.textContent =
                    "-";

                resultScanId.textContent =
                    "-";


                resetStorageCards();


                notify(
                    "Camera result cleared.",
                    "info"
                );
            }
        );
    }


    // ========================================================
    // RESET STORAGE CARDS
    // ========================================================

    function resetStorageCards() {

        [
            cloudinaryResult,
            supabaseResult
        ].forEach((card) => {

            if (!card) {
                return;
            }


            card.classList.remove(
                "storage-success"
            );


            const status =
                card.querySelector(
                    ".storage-confirmation-status"
                );


            if (status) {
                status.textContent = "—";
            }
        });
    }


    // ========================================================
    // ERRORS
    // ========================================================

    function showCameraError(message) {

        if (!errorBox) {
            return;
        }


        errorBox.hidden = false;


        if (errorText) {
            errorText.textContent =
                message;
        }
    }


    function clearError() {

        if (errorBox) {
            errorBox.hidden = true;
        }
    }


    // ========================================================
    // HELPERS
    // ========================================================

    function canvasToBlob(
        sourceCanvas,
        type,
        quality
    ) {

        return new Promise(
            (resolve) => {

                sourceCanvas.toBlob(
                    resolve,
                    type,
                    quality
                );
            }
        );
    }


    function delay(ms) {

        return new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    }


    function escapeValue(value) {

        const text =
            value === null ||
            value === undefined ||
            value === ""
                ? "Unknown"
                : String(value);


        const div =
            document.createElement(
                "div"
            );


        div.textContent = text;


        return div.innerHTML;
    }


    function informationRow(
        label,
        value
    ) {

        return `
            <div class="gemini-info-item">

                <span>
                    ${label}
                </span>

                <strong>
                    ${escapeValue(value)}
                </strong>

            </div>
        `;
    }


    function textSection(
        label,
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === "" ||
            value === "None"
        ) {
            return "";
        }


        return `
            <div class="gemini-text-section">

                <span>
                    ${label}
                </span>

                <p>
                    ${escapeValue(value)}
                </p>

            </div>
        `;
    }


    function notify(
        message,
        type
    ) {

        /*
         * Use app.js toast system
         * if available.
         */

        if (
            typeof window.showToast ===
            "function"
        ) {

            window.showToast(
                message,
                type
            );

            return;
        }


        console.log(
            `[${type}] ${message}`
        );
    }


    // ========================================================
    // CLEANUP
    // ========================================================

    window.addEventListener(
        "beforeunload",
        () => {

            stopDetection();


            if (stream) {

                stream
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );
            }
        }
    );


    // ========================================================
    // INITIAL UI STATE
    // ========================================================

    updateCameraStatus(
        "OFFLINE",
        false
    );


    cameraModeChip.textContent =
        "STANDBY";


    detectionStatusChip.textContent =
        "WAITING";


    startButton.disabled =
        false;

    captureButton.disabled =
        true;

    toggleDetectionButton.disabled =
        true;

    stopButton.disabled =
        true;


    console.log(
        "AI Sentinel Camera Module: READY"
    );

});