# Title: Migrate Medium, Large, and Extra Large YOLO Models to YOLO26 Family

Date: 2026-06-17

Status: Supersedes ADR-005

Context:
In ADR-005, we introduced dynamic model weights swapping between YOLO Nano (`yolo26n.pt`), Small (`yolo26s.pt`), and the older YOLO11 Medium (`yolo11m.pt`), Large (`yolo11l.pt`), and Extra Large (`yolo11x.pt`) models to address spatial resolution issues at further distances. However, mixing model architectures introduces package complexity, inconsistent prediction paths, and prevents us from utilizing YOLO26's performance gains (such as CPU execution optimization via NMS-free dual-head inference) across all precision tiers.

Decision:
We will replace all remaining YOLO11 model weights with their YOLO26 equivalents:
1. `yolo11m.pt` -> `yolo26m.pt`
2. `yolo11l.pt` -> `yolo26l.pt`
3. `yolo11x.pt` -> `yolo26x.pt`

We will also update the default model configuration to `yolo26l.pt` (YOLO26 Large) with a confidence threshold of 75% for high-accuracy tracking. All developer debug calibration tools and frontend selection menus will be updated to reflect this migration.

Consequences:
- Positive:
  - 100% architectural consistency: All model selection options are now unified on the YOLO26 dual-head model family.
  - Native NMS-free inference for all model options, reducing CPU overhead by up to 43% compared to YOLO11 models of similar capacity.
- Negative:
  - YOLO26 Large and Extra Large model weights still require significant download bandwidth on first activation if they are not cached locally, and carry a higher CPU and memory footprint compared to the Nano and Small variants.
