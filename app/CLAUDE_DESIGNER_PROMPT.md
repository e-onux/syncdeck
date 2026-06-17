# Claude Designer Prompt

Design a polished macOS desktop app UI for an Ionic + React + Electron utility named "Rclone Syncer".

Purpose: the app lets a user pick any local source folder and any destination folder, then run `rclone sync` or `rclone copy` without mounting. It can install a macOS LaunchAgent so enabled sync profiles run automatically at login.

Audience: a technical but busy Mac user who wants a calm, reliable, scan-friendly tool rather than a marketing page.

Main screen requirements:
- App shell with a compact toolbar title: "Rclone Syncer".
- First viewport is the actual working interface, not a landing page.
- Top band with a short product statement, rclone status, active profile count, and a launch-at-login toggle.
- Left sidebar listing sync profiles with name, source path, enabled/disabled state, and mode badge.
- Main editor panel for the selected profile:
  - Profile name field.
  - Source folder picker.
  - Destination folder picker.
  - Segmented control for "Mirror sync" and "Copy only".
  - Toggle for "Run this profile at login".
  - Optional extra rclone arguments textarea.
  - Primary save button, secondary run-now button, destructive delete action.
- Bottom log panel showing the latest run output with success/error status.

Visual direction:
- Quiet operational desktop UI, not a SaaS landing page.
- Light theme, restrained contrast, mostly white and soft gray surfaces with clear blue primary actions and green success accents.
- Cards only for functional panels; no nested cards, no decorative blobs, no oversized hero section.
- 8px radius max on panels and buttons.
- Dense but comfortable spacing; optimized for repeated use.
- Use familiar icons for folder picking, save, run, refresh, delete, success, warning.
- Text must never overlap or truncate awkwardly; long paths should ellipsize cleanly.

Deliverables:
- Produce a high-fidelity desktop mockup at 1120x780.
- Include responsive behavior notes for a narrow 900px desktop window.
- Keep all labels in Turkish.
