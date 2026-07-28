from io import BytesIO

from PIL import Image, ImageOps


# ============================================================
# IMAGE COMPRESSION SERVICE
# ============================================================

class ImageCompressionService:

    def __init__(
        self,
        target_min_kb: int = 30,
        target_max_kb: int = 50,
        max_dimension: int = 1280,
    ):
        self.target_min_bytes = target_min_kb * 1024
        self.target_max_bytes = target_max_kb * 1024
        self.max_dimension = max_dimension

    def compress(self, image_bytes: bytes) -> dict:
        """
        Compress an image for cloud storage.

        Target:
            30-50 KB when practical.

        Returns:
            compressed image bytes
            original size
            compressed size
            dimensions
            quality used
        """

        image = Image.open(BytesIO(image_bytes))

        # Correct phone/camera EXIF orientation.
        image = ImageOps.exif_transpose(image)

        # JPEG doesn't support normal RGBA transparency.
        if image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, "white")

            if image.mode == "P":
                image = image.convert("RGBA")

            if image.mode in ("RGBA", "LA"):
                background.paste(
                    image,
                    mask=image.getchannel("A"),
                )
            else:
                background.paste(image)

            image = background

        elif image.mode != "RGB":
            image = image.convert("RGB")

        # Don't store unnecessarily huge dimensions.
        image.thumbnail(
            (self.max_dimension, self.max_dimension),
            Image.Resampling.LANCZOS,
        )

        best_result = None

        # Gradually reduce JPEG quality.
        for quality in range(90, 14, -5):

            output = BytesIO()

            image.save(
                output,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=True,
            )

            data = output.getvalue()
            size = len(data)

            best_result = {
                "bytes": data,
                "size_bytes": size,
                "size_kb": round(size / 1024, 2),
                "quality": quality,
                "width": image.width,
                "height": image.height,
                "format": "jpeg",
                "content_type": "image/jpeg",
            }

            # Ideal range: 30-50 KB
            if self.target_min_bytes <= size <= self.target_max_bytes:
                break

            # Already below 50 KB.
            if size < self.target_max_bytes:
                break

        return {
            "original_size_bytes": len(image_bytes),
            "original_size_kb": round(len(image_bytes) / 1024, 2),
            "compressed": best_result,
        }


compression_service = ImageCompressionService()