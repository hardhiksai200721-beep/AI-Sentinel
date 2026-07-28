from io import BytesIO

import cv2
import numpy as np

from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from backend.services.detector import detector
from backend.services.gemini_service import gemini_service
from backend.services.compression import compression_service
from backend.services.cloudinary_service import cloudinary_service
from backend.services.supabase_service import supabase_service


router = APIRouter(
    prefix="/api",
    tags=["Camera Scanner"],
)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


# ============================================================
# HELPER — READ AND VALIDATE CAMERA IMAGE
# ============================================================

async def read_camera_image(file: UploadFile):

    # --------------------------------------------------------
    # 1. Validate content type
    # --------------------------------------------------------

    if file.content_type not in ALLOWED_CONTENT_TYPES:

        raise HTTPException(
            status_code=415,
            detail=(
                "Camera frame must be JPEG, "
                "PNG, or WebP."
            ),
        )

    # --------------------------------------------------------
    # 2. Read image
    # --------------------------------------------------------

    image_bytes = await file.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="Camera frame is empty.",
        )

    if len(image_bytes) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=413,
            detail=(
                "Camera frame exceeds "
                "the 10 MB limit."
            ),
        )

    # --------------------------------------------------------
    # 3. Verify actual image
    # --------------------------------------------------------

    try:

        pil_image = Image.open(
            BytesIO(image_bytes)
        )

        pil_image.verify()

    except (UnidentifiedImageError, OSError):

        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded camera frame "
                "is not a valid image."
            ),
        )

    # --------------------------------------------------------
    # 4. Decode using OpenCV
    # --------------------------------------------------------

    np_buffer = np.frombuffer(
        image_bytes,
        dtype=np.uint8,
    )

    image = cv2.imdecode(
        np_buffer,
        cv2.IMREAD_COLOR,
    )

    if image is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "OpenCV could not decode "
                "the camera frame."
            ),
        )

    return image_bytes, image


# ============================================================
# LIVE YOLO DETECTION
# ============================================================
#
# This endpoint is intentionally lightweight.
#
# It does NOT:
# - Call Gemini
# - Compress images
# - Upload to Cloudinary
# - Save to Supabase
#
# It only performs YOLO detection and returns bounding boxes.
#
# ============================================================

@router.post("/camera/detect")
async def detect_camera_frame(
    file: UploadFile = File(...)
):

    image_bytes, image = await read_camera_image(
        file
    )

    height, width = image.shape[:2]

    # --------------------------------------------------------
    # YOLO DETECTION
    # --------------------------------------------------------

    try:

        detected_objects = detector.detect(
            image
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Live object detection failed: "
                f"{str(error)}"
            ),
        )

    # --------------------------------------------------------
    # RETURN LIGHTWEIGHT RESULT
    # --------------------------------------------------------

    return {

        "status": "detection_complete",

        "source": "camera_live",

        "frame": {
            "width": width,
            "height": height,
            "size_bytes": len(image_bytes),
            "size_kb": round(
                len(image_bytes) / 1024,
                2,
            ),
        },

        "objects_detected":
            len(detected_objects),

        "objects":
            detected_objects,

        "pipeline": {
            "opencv": "ready",
            "yolo": "ready",
            "gemini": "not_used",
            "cloudinary": "not_used",
            "supabase": "not_used",
        },
    }


# ============================================================
# FULL CAMERA AI SCAN
# ============================================================
#
# This endpoint performs:
#
# Camera frame
#     ↓
# OpenCV
#     ↓
# YOLO
#     ↓
# Gemini
#     ↓
# Compression
#     ↓
# Cloudinary
#     ↓
# Supabase
#
# ============================================================

@router.post("/camera/scan")
async def scan_camera_frame(
    file: UploadFile = File(...)
):

    # --------------------------------------------------------
    # 1. READ + VALIDATE CAMERA FRAME
    # --------------------------------------------------------

    image_bytes, image = await read_camera_image(
        file
    )

    height, width = image.shape[:2]

    # --------------------------------------------------------
    # 2. YOLO OBJECT DETECTION
    # --------------------------------------------------------

    try:

        detected_objects = detector.detect(
            image
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Object detection failed: "
                f"{str(error)}"
            ),
        )

    # --------------------------------------------------------
    # 3. GEMINI DETAILED ANALYSIS
    # --------------------------------------------------------

    try:

        ai_analysis = (
            gemini_service.analyze_image(
                image_bytes=image_bytes,
                mime_type=file.content_type,
                yolo_objects=detected_objects,
            )
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Gemini analysis failed: "
                f"{str(error)}"
            ),
        )

    # --------------------------------------------------------
    # 4. CREATE COMPRESSED STORAGE COPY
    # --------------------------------------------------------

    try:

        compression_result = (
            compression_service.compress(
                image_bytes
            )
        )

        compressed_bytes = (
            compression_result[
                "compressed"
            ]["bytes"]
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Image compression failed: "
                f"{str(error)}"
            ),
        )

    # --------------------------------------------------------
    # 5. UPLOAD COMPRESSED IMAGE TO CLOUDINARY
    # --------------------------------------------------------

    try:

        cloudinary_result = (
            cloudinary_service.upload_image(
                compressed_bytes
            )
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Cloudinary upload failed: "
                f"{str(error)}"
            ),
        )

    # --------------------------------------------------------
    # 6. SAVE CAMERA SCAN TO SUPABASE
    # --------------------------------------------------------

    try:

        scan_record = {

            "filename":
                file.filename
                or "camera_capture.jpg",

            "source":
                "camera",

            "original_width":
                width,

            "original_height":
                height,

            "original_size_bytes":
                len(image_bytes),

            "original_size_kb":
                round(
                    len(image_bytes) / 1024,
                    2,
                ),

            "compressed_size_bytes":
                len(compressed_bytes),

            "compressed_size_kb":
                round(
                    len(compressed_bytes)
                    / 1024,
                    2,
                ),

            "cloudinary_public_id":
                cloudinary_result[
                    "public_id"
                ],

            "cloudinary_url":
                cloudinary_result[
                    "secure_url"
                ],

            "objects_detected":
                len(detected_objects),

            "yolo_objects":
                detected_objects,

            "gemini_analysis":
                ai_analysis,
        }

        saved_scan = (
            supabase_service.save_scan(
                scan_record
            )
        )

    except Exception as error:

        # ----------------------------------------------------
        # CLEAN UP CLOUDINARY IF DATABASE SAVE FAILS
        # ----------------------------------------------------

        try:

            public_id = (
                cloudinary_result.get(
                    "public_id"
                )
            )

            if public_id:

                cloudinary_service.delete_image(
                    public_id
                )

        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase save failed: "
                f"{str(error)}"
            ),
        )

    # --------------------------------------------------------
    # 7. RETURN COMPLETE RESULT
    # --------------------------------------------------------

    return {

        "status":
            "camera_analysis_complete",

        "source":
            "camera",

        "database": {

            "saved":
                True,

            "scan_id":
                saved_scan["id"],

            "created_at":
                saved_scan["created_at"],
        },

        "image": {

            "filename":
                file.filename
                or "camera_capture.jpg",

            "content_type":
                file.content_type,

            "width":
                width,

            "height":
                height,

            "size_bytes":
                len(image_bytes),

            "size_kb":
                round(
                    len(image_bytes) / 1024,
                    2,
                ),
        },

        "objects_detected":
            len(detected_objects),

        "objects":
            detected_objects,

        "ai_analysis":
            ai_analysis,

        "compression": {

            "original_size_kb":
                compression_result[
                    "original_size_kb"
                ],

            "compressed_size_kb":
                compression_result[
                    "compressed"
                ]["size_kb"],

            "quality":
                compression_result[
                    "compressed"
                ]["quality"],

            "width":
                compression_result[
                    "compressed"
                ]["width"],

            "height":
                compression_result[
                    "compressed"
                ]["height"],

            "format":
                compression_result[
                    "compressed"
                ]["format"],
        },

        "cloudinary": {

            "public_id":
                cloudinary_result[
                    "public_id"
                ],

            "secure_url":
                cloudinary_result[
                    "secure_url"
                ],

            "format":
                cloudinary_result[
                    "format"
                ],

            "width":
                cloudinary_result[
                    "width"
                ],

            "height":
                cloudinary_result[
                    "height"
                ],

            "size_bytes":
                cloudinary_result[
                    "bytes"
                ],

            "size_kb":
                round(
                    cloudinary_result[
                        "bytes"
                    ] / 1024,
                    2,
                ),
        },

        "pipeline": {
            "opencv": "ready",
            "yolo": "ready",
            "gemini": "ready",
            "compression": "ready",
            "cloudinary": "ready",
            "supabase": "ready",
        },
    }