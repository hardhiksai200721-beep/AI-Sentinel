import os
import uuid

import cloudinary
import cloudinary.uploader

from dotenv import load_dotenv


load_dotenv()


# ============================================================
# CLOUDINARY CONFIGURATION
# ============================================================

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)


# ============================================================
# CLOUDINARY SERVICE
# ============================================================

class CloudinaryService:

    def __init__(self):
        self.folder = "hardhik-ai-recognition"

    # ========================================================
    # UPLOAD IMAGE
    # ========================================================

    def upload_image(self, image_bytes: bytes) -> dict:
        """
        Upload compressed image bytes to Cloudinary.
        """

        public_id = f"scan_{uuid.uuid4().hex}"

        result = cloudinary.uploader.upload(
            image_bytes,
            folder=self.folder,
            public_id=public_id,
            resource_type="image",
            overwrite=False,
        )

        return {
            "public_id": result.get("public_id"),
            "secure_url": result.get("secure_url"),
            "format": result.get("format"),
            "width": result.get("width"),
            "height": result.get("height"),
            "bytes": result.get("bytes"),
        }

    # ========================================================
    # DELETE IMAGE
    # ========================================================

    def delete_image(self, public_id: str) -> dict:
        """
        Delete an image from Cloudinary using its public ID.
        """

        if not public_id:
            raise ValueError(
                "Cloudinary public_id is required."
            )

        result = cloudinary.uploader.destroy(
            public_id,
            resource_type="image",
            invalidate=True,
        )

        return {
            "public_id": public_id,
            "result": result.get("result"),
        }


# ============================================================
# CREATE SERVICE INSTANCE
# ============================================================

cloudinary_service = CloudinaryService()