# Title: Upgrade Baseline Model to YOLO26 Nano

Date: 2026-06-05

Status: Accepted

Context:
In ADR-002, we decided to pivot our computer vision pipeline to focus on mobile phone detection using the YOLOv8 Nano model. However, in January 2026, Ultralytics released the YOLO26 model family, which introduces key features specifically tailored for edge devices and low-power hardware. Most notably, YOLO26 features native end-to-end NMS-free inference and delivers up to 43% faster CPU inference compared to previous models. In a local-only background application like FocusSentinel, reducing CPU overhead is vital so that target tracking does not degrade the performance of the user's computer during study sessions.

Decision:
We will upgrade the baseline object detection model to **YOLO26 Nano** (`yolo26n.pt`). We will update our dependencies in `requirements.txt` to require `ultralytics>=8.3.0` to ensure proper support for the YOLO26 model family.

Consequences:
- **Positive:**
  - ~43% faster CPU inference, significantly reducing the background processor overhead.
  - Native NMS-free inference simplifies prediction pipelines and avoids custom Non-Maximum Suppression mathematical steps.
  - Maintainability is preserved since the API wrappers are fully unified inside the `ultralytics` package.
- **Negative/Technical Debt:**
  - YOLO26 model weights are newer, which requires downloading `yolo26n.pt` on the first execution or embedding it in the installer bundle.
