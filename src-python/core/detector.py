import os
from ultralytics import YOLO

class ObjectDetector:
    """
    ObjectDetector wrapper using Ultralytics YOLO to scan video frame matrices
    specifically for target distraction objects (such as cell phones).
    """
    def __init__(self, model_path="yolo11l.pt", threshold=0.75, imgsz=640):
        # Initialize YOLO. This downloads model weights to model_path if not found
        self.model = YOLO(model_path)
        self.threshold = threshold
        self.imgsz = imgsz

    def set_threshold(self, threshold: float):
        """Updates the confidence threshold for object detection."""
        self.threshold = threshold

    def set_model(self, model_path: str):
        """Atomically switches the active YOLO model weights."""
        new_model = YOLO(model_path)
        self.model = new_model

    def set_imgsz(self, imgsz: int):
        """Updates the image resolution size used for inference."""
        self.imgsz = imgsz

    def detect_phone(self, frame) -> bool:
        """
        Runs YOLO inference on a single frame and returns True if a cell phone
        (COCO class index 67) is detected with confidence >= threshold.
        """
        if frame is None:
            return False
            
        # Run inference in silent mode with the specified input resolution
        results = self.model(frame, imgsz=self.imgsz, verbose=False)
        
        for r in results:
            if r.boxes is not None:
                # Retrieve class IDs and confidence values as standard Python lists
                classes = r.boxes.cls.tolist()
                confidences = r.boxes.conf.tolist()
                
                for cls_id, conf in zip(classes, confidences):
                    # COCO class 67 is cell_phone
                    if int(cls_id) == 67 and conf >= self.threshold:
                        return True
                        
        return False
