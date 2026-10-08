# ADR 0004: TigerVNC + noVNC through a controller bridge

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

GUI applications (Electron apps, Windows `.exe` under wine, browsers) must run
inside the sandbox and be visible and interactive from the phone. The phone
app is React Native. It has no maintained native VNC widget, but it can host a
WebView. The only network-facing service must be the controller, with its auth.

## Decision

- **Xvnc** (TigerVNC) provides X display `:1` (default `1600x900`) and the RFB
  server on TCP 5901 in a single process, with VncAuth using the password in
  `/home/dev/.vnc/passwd` (`TESSERACT_VNC_PASSWORD`). **openbox** is the window manager.
- The controller exposes **`/v1/display/vnc`**, a binary WebSocket ↔ TCP
  bridge to `127.0.0.1:5901`, authorized with a one-time ticket. It echoes the
  `binary` subprotocol for noVNC.
- The controller serves a static **`/ui/vnc`** page with **noVNC** that reads
  `ticket` and `password` from the URL fragment. The app loads it in
  `react-native-webview`, or an `<iframe>` on web.
- Native VNC clients on the tailnet can connect to TCP 5901, which the
  Tailscale sidecar forwards. This path has VncAuth only.
- Screenshots come from the same display (`GET /v1/display/screenshot`, PNG via ImageMagick `import`).

## Consequences

- One auth system (token + ticket) guards the phone path. No separate websockify service.
- Xvnc avoids the Xvfb + x11vnc pair: one process owns both the framebuffer and the RFB server.
- noVNC in a WebView works but is not native. Touch-to-mouse mapping, pinch
  zoom and on-screen keyboard behavior depend on noVNC's touch handling.
  Scaling mode matters on small screens (see [display-vnc.md](../architecture/display-vnc.md)).
- VncAuth truncates passwords to 8 characters and is weak by itself. On the
  phone path the tailnet and ticket are the real protection. On the direct
  5901 path, the Tailscale ACLs are.
- No audio and no GPU acceleration. Software rendering is used for Electron (see ADR 0005).

## Alternatives considered

- **Xvfb + x11vnc + websockify.** Three processes, and a second network-facing
  WebSocket service with its own auth.
- **Apache Guacamole.** Heavy (Java server and daemon) for a single display.
- **KasmVNC.** A better web client, but a modified RFB server with its own web
  server and auth that would bypass the controller.
- **WebRTC streaming (e.g. Selkies).** Lower latency, but much more
  complexity (TURN/STUN, encoders) than the MVP needs.
- **Native VNC component in React Native.** None maintained. Writing one is out of scope.
