import pytest
import numpy as np
from unittest.mock import MagicMock, patch

# Import the class under test
from core.detector import ObjectDetector


def test_detector_initialization():
    with patch("core.detector.YOLO") as mock_yolo:
        detector = ObjectDetector(model_path="models/yolo26n.pt")
        mock_yolo.assert_called_once_with("models/yolo26n.pt")
        assert detector.threshold == 0.45


def test_detector_no_detections():
    with patch("core.detector.YOLO") as mock_yolo:
        mock_model = MagicMock()
        mock_yolo.return_value = mock_model
        
        # Simulate empty detections
        mock_result = MagicMock()
        mock_result.boxes = None
        mock_model.return_value = [mock_result]
        
        detector = ObjectDetector()
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        assert detector.detect_phone(frame) is False


def test_detector_phone_detected_high_confidence():
    with patch("core.detector.YOLO") as mock_yolo:
        mock_model = MagicMock()
        mock_yolo.return_value = mock_model
        
        # Simulate high-confidence phone detection (COCO class 67)
        mock_boxes = MagicMock()
        mock_boxes.cls.tolist.return_value = [67.0]
        mock_boxes.conf.tolist.return_value = [0.85]
        
        mock_result = MagicMock()
        mock_result.boxes = mock_boxes
        mock_model.return_value = [mock_result]
        
        detector = ObjectDetector()
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        assert detector.detect_phone(frame) is True


def test_detector_phone_detected_low_confidence():
    with patch("core.detector.YOLO") as mock_yolo:
        mock_model = MagicMock()
        mock_yolo.return_value = mock_model
        
        # Simulate low-confidence phone detection (e.g. 0.3)
        mock_boxes = MagicMock()
        mock_boxes.cls.tolist.return_value = [67.0]
        mock_boxes.conf.tolist.return_value = [0.3]
        
        mock_result = MagicMock()
        mock_result.boxes = mock_boxes
        mock_model.return_value = [mock_result]
        
        detector = ObjectDetector()
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        assert detector.detect_phone(frame) is False


def test_detector_other_object_detected():
    with patch("core.detector.YOLO") as mock_yolo:
        mock_model = MagicMock()
        mock_yolo.return_value = mock_model
        
        # Simulate high-confidence person detection (class 0)
        mock_boxes = MagicMock()
        mock_boxes.cls.tolist.return_value = [0.0]
        mock_boxes.conf.tolist.return_value = [0.9]
        
        mock_result = MagicMock()
        mock_result.boxes = mock_boxes
        mock_model.return_value = [mock_result]
        
        detector = ObjectDetector()
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        assert detector.detect_phone(frame) is False
