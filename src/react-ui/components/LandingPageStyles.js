export const landingPageStyles = `
/* Landing Page Container */
.lumiverse-lp-container {
  position: absolute; /* Changed from fixed to absolute to respect parent container */
  inset: 0;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  /* z-index handled in index.js */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  /* background moved to .lumiverse-lp-bg for proper layering */
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  /* padding-top handled inline */
}

/* Ambient background glows */
.lumiverse-lp-bg {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  /* top handled inline */
  overflow: hidden;
  pointer-events: auto; /* Block clicks on underlying content */
  background: linear-gradient(
    165deg,
    rgba(15, 12, 22, 0.98) 0%,
    rgba(22, 18, 32, 0.97) 50%,
    rgba(18, 15, 28, 0.98) 100%
  );
}

.lumiverse-lp-bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: lumiverse-lp-glow-pulse 8s ease-in-out infinite;
}

.lumiverse-lp-bg-glow-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(147, 112, 219, 0.25) 0%, transparent 70%);
  top: -200px;
  right: -100px;
  animation-delay: 0s;
}

.lumiverse-lp-bg-glow-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(100, 149, 237, 0.2) 0%, transparent 70%);
  bottom: -150px;
  left: -100px;
  animation-delay: -2.6s;
}

.lumiverse-lp-bg-glow-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(186, 135, 255, 0.15) 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -5.3s;
}

@keyframes lumiverse-lp-glow-pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

/* Grid pattern overlay */
.lumiverse-lp-grid {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  /* top handled inline */
  background-image:
    linear-gradient(rgba(147, 112, 219, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(147, 112, 219, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
  opacity: 0.6;
}

/* Main content wrapper */
.lumiverse-lp-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: auto;
  min-height: 0; /* Crucial for nested scrolling */
  width: 100%; /* Ensure full width */
  max-width: 100%; /* Prevent overflow */
  padding: 24px 32px;
  box-sizing: border-box;
  pointer-events: auto; /* Enable interaction */
}

/* Header */
.lumiverse-lp-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 44px 32px 60px;
  background: linear-gradient(
    180deg,
    #0f0c16 0%,
    rgba(15, 12, 22, 0.98) 70%,
    rgba(15, 12, 22, 0) 100%
  );
  pointer-events: none;
}

.lumiverse-lp-header > * {
  pointer-events: auto;
}

.lumiverse-lp-header-left {
  display: flex;
  align-items: center;
}

.lumiverse-lp-logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lumiverse-lp-logo-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(147, 112, 219, 0.25) 0%,
    rgba(100, 149, 237, 0.15) 100%
  );
  border: 1px solid rgba(147, 112, 219, 0.4);
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(147, 112, 219, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.lumiverse-lp-logo-icon svg {
  width: 100%;
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  filter: drop-shadow(0 0 4px rgba(186, 135, 255, 0.5));
}

.lumiverse-lp-logo-text h1 {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif !important;
  font-size: 28px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.98);
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  background: none !important;
  box-shadow: none !important;
  text-decoration: none !important;
  line-height: 1.1 !important;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #ffffff 0%, #d8b4fe 100%) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
  text-shadow: 0 4px 12px rgba(147, 112, 219, 0.3) !important;
  padding-top: 4px !important; /* Nudge text down slightly for visual balance */
}

.lumiverse-lp-logo-text span {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif !important;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6) !important;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  background: none !important;
  box-shadow: none !important;
  text-decoration: none !important;
}

/* Buttons */
.lumiverse-lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.lumiverse-lp-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.lumiverse-lp-btn-refresh {
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.lumiverse-lp-btn-refresh:hover {
  background: rgba(147, 112, 219, 0.15);
  border-color: rgba(147, 112, 219, 0.4);
  color: rgba(186, 135, 255, 0.95);
}

.lumiverse-lp-btn-toggle {
  background: linear-gradient(
    135deg,
    rgba(147, 112, 219, 0.2) 0%,
    rgba(100, 149, 237, 0.15) 100%
  );
  border: 1px solid rgba(147, 112, 219, 0.35);
  color: rgba(255, 255, 255, 0.9);
}

.lumiverse-lp-btn-toggle:hover {
  background: linear-gradient(
    135deg,
    rgba(147, 112, 219, 0.3) 0%,
    rgba(100, 149, 237, 0.25) 100%
  );
  border-color: rgba(147, 112, 219, 0.5);
  box-shadow: 0 4px 20px rgba(147, 112, 219, 0.25);
}

.lumiverse-lp-btn-primary {
  background: linear-gradient(
    135deg,
    rgba(147, 112, 219, 0.9) 0%,
    rgba(100, 149, 237, 0.85) 100%
  );
  color: white;
  border: 1px solid rgba(147, 112, 219, 0.4);
}

.lumiverse-lp-btn-primary:hover {
  background: linear-gradient(
    135deg,
    rgba(167, 132, 239, 0.95) 0%,
    rgba(120, 169, 247, 0.9) 100%
  );
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(147, 112, 219, 0.35);
}

/* Spin animation for refresh */
.lumiverse-lp-spin {
  animation: lumiverse-lp-spin 1s linear infinite;
}

@keyframes lumiverse-lp-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Main content area */
.lumiverse-lp-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 120px 4px 8px; /* Increased top padding for header overlap */
  margin: 0; /* Removed negative margins */
  width: 100%;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: rgba(147, 112, 219, 0.3) transparent;
}

.lumiverse-lp-main::-webkit-scrollbar {
  width: 6px;
}

.lumiverse-lp-main::-webkit-scrollbar-track {
  background: transparent;
}

.lumiverse-lp-main::-webkit-scrollbar-thumb {
  background: rgba(147, 112, 219, 0.3);
  border-radius: 3px;
}

.lumiverse-lp-main::-webkit-scrollbar-thumb:hover {
  background: rgba(147, 112, 219, 0.5);
}

/* Card grid */
.lumiverse-lp-grid-cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: flex-start;
  gap: 20px;
  padding: 4px;
  max-width: 1800px; /* Increased max-width for larger screens */
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* Glassmorphic Card */
.lumiverse-lp-card {
  position: relative;
  display: flex;
  flex-direction: column;
  /* Use strict width calculated by JS for perfect alignment */
  width: var(--lumiverse-card-width, 240px);
  /* Ensure consistent height if content varies */
  flex-shrink: 0;

  background: linear-gradient(
    165deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.03) 50%,
    rgba(255, 255, 255, 0.02) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.02) inset;
  transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* Hardware acceleration to prevent flashing */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  perspective: 1000px;
}

.lumiverse-lp-card:hover {
  border-color: rgba(147, 112, 219, 0.4);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(147, 112, 219, 0.15) inset,
    0 0 60px rgba(147, 112, 219, 0.1);
}

/* Glass shimmer effect on hover */
.lumiverse-lp-card-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 0%,
    transparent 40%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 60%,
    transparent 100%
  );
  background-size: 200% 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.lumiverse-lp-card:hover .lumiverse-lp-card-shimmer {
  opacity: 1;
  animation: lumiverse-lp-shimmer 1.5s ease-in-out infinite;
}

@keyframes lumiverse-lp-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Card image container */
.lumiverse-lp-card-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: linear-gradient(
    135deg,
    rgba(20, 16, 28, 0.6) 0%,
    rgba(40, 32, 55, 0.4) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Glow behind avatar */
.lumiverse-lp-card-glow {
  position: absolute;
  width: 70%;
  height: 70%;
  background: radial-gradient(
    circle,
    rgba(147, 112, 219, 0.3) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  filter: blur(20px);
}

.lumiverse-lp-card:hover .lumiverse-lp-card-glow {
  opacity: 1;
}

/* Avatar image */
.lumiverse-lp-card-avatar {
  width: 75%;
  height: 75%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
  user-drag: none;
  -webkit-user-drag: none;
}

.lumiverse-lp-card:hover .lumiverse-lp-card-avatar {
  transform: scale(1.05);
  border-color: rgba(147, 112, 219, 0.4);
  box-shadow:
    0 6px 30px rgba(0, 0, 0, 0.4),
    0 0 30px rgba(147, 112, 219, 0.2);
}

/* Group avatar placeholder (legacy fallback) */
.lumiverse-lp-card-avatar-group {
  width: 75%;
  height: 75%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(100, 149, 237, 0.2) 0%,
    rgba(147, 112, 219, 0.15) 100%
  );
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.1);
  color: rgba(186, 135, 255, 0.8);
}

/* Group image container variant */
.lumiverse-lp-card-image-container.lumiverse-lp-card-image-group {
  background: linear-gradient(
    135deg,
    rgba(100, 149, 237, 0.08) 0%,
    rgba(147, 112, 219, 0.05) 50%,
    rgba(75, 85, 150, 0.1) 100%
  );
}

/* Stacked Group Avatar System */
.lumiverse-lp-group-stack {
  position: relative;
  width: 85%;
  height: 85%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Container sizing for 3-member layout - no transform here to keep spinner centered */
.lumiverse-lp-group-stack:has(.lumiverse-lp-group-stack-avatars[data-count="3"]) {
  width: 90%;
  height: 90%;
}

.lumiverse-lp-group-stack-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(147, 112, 219, 0.5);
}

.lumiverse-lp-group-stack-avatars {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease;
}

/* Shift only the avatars container for 3-member layout to visually center the cluster */
.lumiverse-lp-group-stack-avatars[data-count="3"] {
  transform: translateX(-22%);
}

/* Base avatar wrapper styles */
.lumiverse-lp-group-avatar-wrapper {
  position: absolute;
  border-radius: 50%;
  overflow: hidden;
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.4),
    0 0 0 2px rgba(255, 255, 255, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

/* ===== 2 MEMBERS: Diagonal layout (top-left to bottom-right) ===== */
.lumiverse-lp-group-stack-avatars[data-count="2"] .lumiverse-lp-group-avatar-wrapper {
  width: 55%;
  height: 55%;
}

.lumiverse-lp-group-stack-avatars[data-count="2"] .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  top: 5%;
  left: 5%;
}

.lumiverse-lp-group-stack-avatars[data-count="2"] .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  bottom: 5%;
  right: 5%;
}

/* ===== 3 MEMBERS: Tight cluster layout ===== */
/* Avatars clustered near center with slight overlaps for cohesive group feel. */
.lumiverse-lp-group-stack-avatars[data-count="3"] .lumiverse-lp-group-avatar-wrapper {
  width: 44%;
  height: 44%;
}

/* Top avatar: horizontally centered */
.lumiverse-lp-group-stack-avatars[data-count="3"] .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  top: 8%;
  left: 50%;
  transform: translateX(-50%);
}

/* Bottom-left: offset left from center */
.lumiverse-lp-group-stack-avatars[data-count="3"] .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  bottom: 8%;
  left: calc(50% - 24%);
  transform: translateX(-50%);
}

/* Bottom-right: offset right from center, mirror of bottom-left */
.lumiverse-lp-group-stack-avatars[data-count="3"] .lumiverse-lp-group-avatar-wrapper:nth-child(3) {
  bottom: 8%;
  left: calc(50% + 24%);
  transform: translateX(-50%);
}

/* ===== 4 MEMBERS: Square grid layout ===== */
.lumiverse-lp-group-stack-avatars[data-count="4"] .lumiverse-lp-group-avatar-wrapper {
  width: 46%;
  height: 46%;
}

.lumiverse-lp-group-stack-avatars[data-count="4"] .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  top: 2%;
  left: 2%;
}

.lumiverse-lp-group-stack-avatars[data-count="4"] .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  top: 2%;
  right: 2%;
}

.lumiverse-lp-group-stack-avatars[data-count="4"] .lumiverse-lp-group-avatar-wrapper:nth-child(3) {
  bottom: 2%;
  left: 2%;
}

.lumiverse-lp-group-stack-avatars[data-count="4"] .lumiverse-lp-group-avatar-wrapper:nth-child(4) {
  bottom: 2%;
  right: 2%;
}

/* ===== 5+ MEMBERS: Square grid with overflow indicator ===== */
.lumiverse-lp-group-stack-avatars[data-count="5+"] .lumiverse-lp-group-avatar-wrapper {
  width: 46%;
  height: 46%;
}

.lumiverse-lp-group-stack-avatars[data-count="5+"] .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  top: 2%;
  left: 2%;
}

.lumiverse-lp-group-stack-avatars[data-count="5+"] .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  top: 2%;
  right: 2%;
}

.lumiverse-lp-group-stack-avatars[data-count="5+"] .lumiverse-lp-group-avatar-wrapper:nth-child(3) {
  bottom: 2%;
  left: 2%;
}

/* Overflow indicator (+N more) - matches 4-member grid sizing */
.lumiverse-lp-group-avatar-overflow {
  position: absolute;
  width: 46%;
  height: 46%;
  bottom: 2%;
  right: 2%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(100, 149, 237, 0.85) 0%,
    rgba(147, 112, 219, 0.9) 100%
  );
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(100, 149, 237, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.lumiverse-lp-group-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-drag: none;
  -webkit-user-drag: none;
}

/* Hover effects for group cards */
.lumiverse-lp-card:hover .lumiverse-lp-group-avatar-wrapper {
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.5),
    0 0 0 2px rgba(147, 112, 219, 0.4),
    0 0 20px rgba(147, 112, 219, 0.15);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  transform: translate(-2px, -2px);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  transform: translate(2px, -2px);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-avatar-wrapper:nth-child(3) {
  transform: translate(-2px, 2px);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-avatar-wrapper:nth-child(4) {
  transform: translate(2px, 2px);
}

/* Adjust hover transforms for 2-member layout */
.lumiverse-lp-card:hover .lumiverse-lp-group-stack-avatars:has(.lumiverse-lp-group-avatar-wrapper:nth-child(2):last-child) .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  transform: translate(-3px, -50%);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-stack-avatars:has(.lumiverse-lp-group-avatar-wrapper:nth-child(2):last-child) .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  transform: translate(3px, -50%);
}

/* Adjust hover transforms for 3-member layout - spread cluster apart */
.lumiverse-lp-card:hover .lumiverse-lp-group-stack-avatars:has(.lumiverse-lp-group-avatar-wrapper:nth-child(3):last-child) .lumiverse-lp-group-avatar-wrapper:nth-child(1) {
  transform: translateX(-50%) translateY(-4px);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-stack-avatars:has(.lumiverse-lp-group-avatar-wrapper:nth-child(3):last-child) .lumiverse-lp-group-avatar-wrapper:nth-child(2) {
  transform: translateX(-50%) translate(-4px, 4px);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-stack-avatars:has(.lumiverse-lp-group-avatar-wrapper:nth-child(3):last-child) .lumiverse-lp-group-avatar-wrapper:nth-child(3) {
  transform: translateX(-50%) translate(4px, 4px);
}

.lumiverse-lp-card:hover .lumiverse-lp-group-avatar-overflow {
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.5),
    0 0 30px rgba(100, 149, 237, 0.4);
}

/* Time badge */
.lumiverse-lp-card-time-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.lumiverse-lp-card-time-badge svg {
  width: 10px;
  height: 10px;
  stroke: rgba(255, 255, 255, 0.6);
}

/* Card content */
.lumiverse-lp-card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 0, 0, 0.2) 100%
  );
}

.lumiverse-lp-card-name {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lumiverse-lp-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lumiverse-lp-card-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.lumiverse-lp-card-badge svg {
  width: 10px;
  height: 10px;
}

.lumiverse-lp-card-badge-preset {
  background: rgba(147, 112, 219, 0.2);
  border: 1px solid rgba(147, 112, 219, 0.35);
  color: rgba(186, 135, 255, 0.95);
}

.lumiverse-lp-card-badge-group {
  background: rgba(100, 149, 237, 0.2);
  border: 1px solid rgba(100, 149, 237, 0.35);
  color: rgba(135, 180, 247, 0.95);
}

/* Bottom indicator line */
.lumiverse-lp-card-indicator {
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(147, 112, 219, 0.6) 50%,
    transparent 100%
  );
  border-radius: 1px;
  transform-origin: center;
}

/* Skeleton loading */
.lumiverse-lp-skeleton {
  pointer-events: none;
}

.lumiverse-lp-skeleton-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: linear-gradient(
    90deg,
    rgba(147, 112, 219, 0.08) 0%,
    rgba(147, 112, 219, 0.15) 50%,
    rgba(147, 112, 219, 0.08) 100%
  );
  background-size: 200% 100%;
  animation: lumia-skeleton-shimmer 1.5s ease-in-out infinite;
}

.lumiverse-lp-skeleton-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lumiverse-lp-skeleton-line {
  height: 12px;
  background: linear-gradient(
    90deg,
    rgba(147, 112, 219, 0.08) 0%,
    rgba(147, 112, 219, 0.15) 50%,
    rgba(147, 112, 219, 0.08) 100%
  );
  background-size: 200% 100%;
  animation: lumia-skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.lumiverse-lp-skeleton-title {
  width: 70%;
}

.lumiverse-lp-skeleton-meta {
  width: 40%;
}

@keyframes lumia-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty state */
.lumiverse-lp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.lumiverse-lp-empty-icon {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(147, 112, 219, 0.15) 0%,
    rgba(100, 149, 237, 0.1) 100%
  );
  border: 1px solid rgba(147, 112, 219, 0.25);
  border-radius: 50%;
  margin-bottom: 24px;
  color: rgba(147, 112, 219, 0.6);
}

.lumiverse-lp-empty-icon svg {
  width: 48px;
  height: 48px;
  stroke: rgba(147, 112, 219, 0.8);
}

.lumiverse-lp-empty h3 {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  font-size: 24px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 8px 0;
  letter-spacing: -0.3px;
}

.lumiverse-lp-empty p {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  max-width: 320px;
  line-height: 1.5;
}

/* Error state */
.lumiverse-lp-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.lumiverse-lp-error p {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 16px;
  color: rgba(244, 67, 54, 0.8);
  margin-bottom: 16px;
}

/* Footer */
.lumiverse-lp-footer {
  flex-shrink: 0;
  padding-top: 16px;
  text-align: center;
}

.lumiverse-lp-footer p {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.3px;
}

/* Mobile responsiveness */
@media (max-width: 1024px) {
  .lumiverse-lp-grid-cards {
    gap: 16px;
    /* On tablets, Flexbox logic still applies but with smaller gap */
  }
}

@media (max-width: 768px) {
  .lumiverse-lp-content {
    padding: 16px 20px;
  }

  .lumiverse-lp-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
    padding: 32px 20px 40px; /* Match content padding */
  }

  .lumiverse-lp-main {
    padding-top: 180px; /* Increased for taller header on mobile */
  }

  .lumiverse-lp-header-right {
    width: 100%;
    justify-content: flex-end;
  }

  .lumiverse-lp-logo-icon {
    width: 40px;
    height: 40px;
  }

  .lumiverse-lp-logo-text h1 {
    font-size: 20px;
  }

  .lumiverse-lp-grid-cards {
    /* Switch back to Grid for small screens where 2-column layout is standard */
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .lumiverse-lp-card {
    border-radius: 16px;
    /* Reset fixed width for grid layout */
    width: auto;
    flex-shrink: 1;
  }

  .lumiverse-lp-card-content {
    padding: 12px;
  }

  .lumiverse-lp-card-name {
    font-size: 14px;
  }

  .lumiverse-lp-card-time-badge {
    font-size: 10px;
    padding: 3px 8px;
  }
}

@media (max-width: 480px) {
  .lumiverse-lp-grid-cards {
    /* Keep grid layout */
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  
  .lumiverse-lp-card {
    border-radius: 14px;
  }

  .lumiverse-lp-card-content {
    padding: 10px;
  }

  .lumiverse-lp-card-name {
    font-size: 13px;
  }

  .lumiverse-lp-card-badge {
    font-size: 9px;
    padding: 2px 6px;
  }

  /* Smaller group avatars on mobile */
  .lumiverse-lp-group-avatar-wrapper {
    width: 45%;
    height: 45%;
  }

  .lumiverse-lp-group-avatar-overflow {
    width: 32%;
    height: 32%;
    font-size: 10px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .lumiverse-lp-bg-glow {
    animation: none;
  }

  .lumiverse-lp-card,
  .lumiverse-lp-card-avatar,
  .lumiverse-lp-card-glow,
  .lumiverse-lp-btn,
  .lumiverse-lp-group-avatar-wrapper {
    transition: none;
  }

  .lumiverse-lp-card-shimmer {
    display: none;
  }

  .lumiverse-lp-skeleton-image,
  .lumiverse-lp-skeleton-line {
    animation: none;
  }

  /* Disable hover transforms for group avatars */
  .lumiverse-lp-card:hover .lumiverse-lp-group-avatar-wrapper {
    transform: none;
  }
}
`;