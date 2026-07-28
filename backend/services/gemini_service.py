import json
import os

from google import genai
from google.genai import types
from dotenv import load_dotenv


load_dotenv()


class GeminiVisionService:

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY was not found in the .env file."
            )

        self.client = genai.Client(api_key=api_key)

        # We can change the model later if needed.
        self.model = "gemini-3.6-flash"

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        yolo_objects: list,
    ) -> dict:

        detected_names = [
            obj["name"] for obj in yolo_objects
        ]

        prompt = f"""
You are the detailed visual identification component of
Hardhik's AI Recognition/Monitoring System.

YOLO detected these general object classes:
{detected_names}

Analyze ALL important physical objects visible in the image.

For every object:

1. Identify the general category.
2. Identify the brand only when visually supported.
3. Identify the product family/series when possible.
4. Identify the exact or possible model only when evidence supports it.
5. Read useful visible text, logos, labels, or model numbers.
6. Give a short factual description.
7. Give an identification confidence:
   high, medium, or low.
8. Explain briefly what visual evidence supports the identification.
9. Give alternative possible matches when appropriate.

IMPORTANT RULES:

- Do not invent an exact model number.
- If the brand cannot be determined, use "Unknown".
- If the exact model cannot be determined, use "Unknown".
- Distinguish a confirmed identification from a likely/possible match.
- YOLO detections are hints and may be incorrect.
- Analyze the actual image yourself.
"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                prompt,
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type,
                ),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        if not response.text:
            raise RuntimeError(
                "Gemini returned an empty response."
            )

        try:
            return json.loads(response.text)

        except json.JSONDecodeError:
            raise RuntimeError(
                "Gemini returned invalid JSON."
            )


gemini_service = GeminiVisionService()