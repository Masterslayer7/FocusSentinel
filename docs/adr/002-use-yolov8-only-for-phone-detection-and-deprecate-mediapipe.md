# Title: Use YOLOv8 Only for Phone Detection and Deprecate MediaPipe Gaze Tracking

Date: 2026-06-05

Status: Accepted

Context:
Our initial design planned to estimate head pose, gaze direction, and eye closure metrics using MediaPipe. However, gaze tracking introduces significant UX issues: it is overly intrusive and triggers high numbers of false-positive distraction events for normal user activities, such as looking down to write on physical paper, stretching, or reading printed material. Additionally, running face mesh modeling alongside object detection creates a larger computational footprint, straining low-end machines. 

Decision:
We will deprecate MediaPipe-based facial tracking and gaze estimation. The FocusSentinel computer vision pipeline will focus solely on detecting high-certainty physical distractions, specifically mobile phone usage. We will run an OpenCV capture stream and a YOLOv8 Nano object detector to identify the presence of a mobile phone (`cell_phone` class).

Consequences:
- **Positive:**
  - Dramatically reduced false-positive rate. User focus is evaluated based on concrete, actionable distraction events (picking up a phone) rather than simple eye movement.
  - Lower CPU/GPU utilization by deactivating MediaPipe mesh calculations, saving battery and resources for the user's primary work.
  - Simplified Python dependency footprint and cleaner core logic.
- **Negative/Technical Debt:**
  - The application loses the capability to track passive distractions (e.g., staring out of the window or daydreaming) and physical tiredness/sleepiness.
