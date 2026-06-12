# Title: Support Dynamic YOLO Model Switching and Input Scaling for Precision Calibration

Date: 2026-06-12

Status: Accepted

Context:
Our baseline YOLO26 Nano model (`yolo26n.pt`) running at `640x640` resolution has proven to be highly performant but lacks the spatial resolution and capacity to accurately detect cell phones at further distances. When a camera is positioned far away, a phone occupies a tiny region of the frame; downsampling it to 640px causes the model to output low confidence scores (false negatives) or misclassify similar hand-held items (such as Rubik's cubes) as cell phones (false positives). We need a way to increase detection precision, support different hardware capabilities, and allow users to calibrate their systems to different physical layouts.

Decision:
We will update the computer vision pipeline to support runtime calibration adjustments sent via stdio IPC:
1. **Dynamic Model Weights Swapping**: Allow the user to select between YOLO Nano (`yolo26n.pt`), Small (`yolo26s.pt`), Medium (`yolo11m.pt`), Large (`yolo11l.pt`), and Extra Large (`yolo11x.pt`). If a model weights file is not cached locally under `src-python/models/`, the Python process will download it from the Ultralytics CDN and cache it automatically.
2. **Inference Resolution Scaling (`imgsz`)**: Allow setting the input frame dimension dynamically (640px, 960px, 1280px). Increasing the input resolution allows YOLO to inspect high-fidelity sub-patches, drastically improving small/distant object classification.
3. **Dynamic Confidence Thresholding**: Expose a confidence slider in the React UI and pass the parameter to the detector.
4. **Temporal Filter (Majority Vote)**: Maintain a 5-frame rolling window buffer in the Python telemetry loop to smooth out transient single-frame false positives and false negatives.

Consequences:
- **Positive:**
  - High-accuracy models (Large/Extra Large) and resolution scaling (960px/1280px) allow full-room camera placements and eliminate false positives from look-alike objects.
  - Low-power states are preserved by default, allowing users to opt-in to resource-intensive models only if required by their physical layouts.
  - Dynamic threshold slider allows local environment calibration in real-time.
- **Negative/Technical Debt:**
  - **Dynamic Weight Download**: Larger model files (up to 110MB for Extra Large) must be downloaded dynamically, requiring network connectivity when first selected.
  - **Higher CPU/Memory Footprint**: Running inference at 1280px resolution or using YOLO Large/Extra Large consumes significantly more RAM and CPU cycles, which may thermal-throttle lower-end host machines.
