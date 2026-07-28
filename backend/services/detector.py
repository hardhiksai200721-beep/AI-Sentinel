from ultralytics import YOLO
import numpy as np


# ============================================================
# YOLO OBJECT DETECTOR
# ============================================================

class ObjectDetector:

    def __init__(self):
        """
        Load the YOLO model once when the application starts.
        """
        self.model = YOLO("yolo11n.pt")


    def detect(self, image: np.ndarray):
        """
        Detect multiple objects inside an OpenCV image.

        Returns a list containing:
        - object number
        - object name
        - confidence
        - bounding box
        """

        results = self.model.predict(
            source=image,
            conf=0.40,
            verbose=False
        )

        detected_objects = []

        object_number = 1

        for result in results:

            if result.boxes is None:
                continue

            for box in result.boxes:

                class_id = int(box.cls[0].item())

                confidence = float(box.conf[0].item())

                object_name = self.model.names[class_id]

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detected_objects.append(
                    {
                        "object_number": object_number,
                        "name": object_name,
                        "confidence": round(confidence, 4),

                        "bounding_box": {
                            "x1": round(x1),
                            "y1": round(y1),
                            "x2": round(x2),
                            "y2": round(y2),
                        },
                    }
                )

                object_number += 1

        return detected_objects


# ============================================================
# CREATE ONE DETECTOR INSTANCE
# ============================================================

detector = ObjectDetector()