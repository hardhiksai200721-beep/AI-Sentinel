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
    tags=["AI Scanner"],
)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


# ============================================================
# IMAGE SCANNING ENDPOINT
# ============================================================

@router.post("/scan")
async def scan_image(file: UploadFile = File(...)):

    # --------------------------------------------------------
    # 1. Validate file type
    # --------------------------------------------------------

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, and WebP images are supported.",
        )

    # --------------------------------------------------------
    # 2. Read image
    # --------------------------------------------------------

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 10 MB upload limit.",
        )

    # --------------------------------------------------------
    # 3. Verify actual image
    # --------------------------------------------------------

    try:

        pil_image = Image.open(BytesIO(image_bytes))

        pil_image.verify()

    except (UnidentifiedImageError, OSError):

        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )

    # --------------------------------------------------------
    # 4. Decode image using OpenCV
    # --------------------------------------------------------

    np_buffer = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        np_buffer,
        cv2.IMREAD_COLOR
    )

    if image is None:

        raise HTTPException(
            status_code=400,
            detail="OpenCV could not decode the image.",
        )

    height, width = image.shape[:2]

    # --------------------------------------------------------
    # 5. YOLO OBJECT DETECTION
    # --------------------------------------------------------

    try:

        detected_objects = detector.detect(image)

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Object detection failed: {str(error)}",
        )
    
    # --------------------------------------------------------
    # 6. GEMINI DETAILED IDENTIFICATION
    # --------------------------------------------------------

    try:
        ai_analysis = gemini_service.analyze_image(
            image_bytes=image_bytes,
            mime_type=file.content_type,
            yolo_objects=detected_objects,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini analysis failed: {str(error)}",
        )

    # --------------------------------------------------------
    # 7. CREATE COMPRESSED STORAGE COPY
    # --------------------------------------------------------

    try:
        compression_result = compression_service.compress(
            image_bytes
        )

        compressed_bytes = compression_result["compressed"]["bytes"]

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Image compression failed: {str(error)}",
        )


    # --------------------------------------------------------
    # 8. UPLOAD COMPRESSED IMAGE TO CLOUDINARY
    # --------------------------------------------------------

    try:
        cloudinary_result = cloudinary_service.upload_image(
            compressed_bytes
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Cloudinary upload failed: {str(error)}",
        )

    # --------------------------------------------------------
    # 9.SAVE SCAN HISTORY TO SUPABASE
    # --------------------------------------------------------

    try:
        scan_record = {
            "filename": file.filename,
            "source": "upload",

            "original_width": width,
            "original_height": height,

            "original_size_bytes": len(image_bytes),
            "original_size_kb": round(
                len(image_bytes) / 1024,
                2
            ),

            "compressed_size_bytes": len(compressed_bytes),
            "compressed_size_kb": round(
                len(compressed_bytes) / 1024,
                2,
            ),

            "cloudinary_public_id": cloudinary_result["public_id"],
            "cloudinary_url": cloudinary_result["secure_url"],

            "objects_detected": len(detected_objects),

            "yolo_objects": detected_objects,
            "gemini_analysis": ai_analysis,
        }

        saved_scan = supabase_service.save_scan(scan_record)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase save failed: {str(error)}",
        )
    
    # --------------------------------------------------------
    # 10. Return results
    # --------------------------------------------------------

    return {

        "status": "analysis_complete",
        "database": {
            "saved": True,
            "scan_id": saved_scan["id"],
            "created_at": saved_scan["created_at"],
        },
        
        "ai_analysis": ai_analysis,
        "cloudinary": {
            "public_id": cloudinary_result["public_id"],
            "secure_url": cloudinary_result["secure_url"],
            "format": cloudinary_result["format"],
            "width": cloudinary_result["width"],
            "height": cloudinary_result["height"],
            "size_bytes": cloudinary_result["bytes"],
            "size_kb": round(
                cloudinary_result["bytes"] / 1024,
                2
            ),
        },
        "compression": {
            "original_size_kb":
                compression_result["original_size_kb"],

            "compressed_size_kb":
                compression_result["compressed"]["size_kb"],

            "quality":
                compression_result["compressed"]["quality"],

            "width":
                compression_result["compressed"]["width"],

            "height":
                compression_result["compressed"]["height"],

            "format":
                compression_result["compressed"]["format"],
        },

        "image": {
            "filename": file.filename,
            "content_type": file.content_type,
            "width": width,
            "height": height,
            "size_bytes": len(image_bytes),
            "size_kb": round(
                len(image_bytes) / 1024,
                2
            ),
        },

        "objects_detected": len(detected_objects),

        "objects": detected_objects,

        "pipeline": {
            "opencv": "ready",
            "yolo": "ready",
            "gemini": "ready",
            "cloudinary": "ready",
            "supabase": "ready",
        },
    }