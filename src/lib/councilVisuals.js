/**
 * Council Visuals Module
 * 
 * Provides beautiful visual indicators for council tool responses in sidecar mode.
 * Displays stacked circular avatars in the message avatar wrapper as council members
 * respond, creating an ethereal "council convergence" effect.
 * 
 * Aesthetic: Ethereal Council Convergence
 * - Glassmorphism with soft purple accents
 * - Layered circular avatars with negative overlap
 * - Subtle pulse animations and smooth scale-ins
 * - Organic, mystical feel fitting for the Lumiverse
 */

import { getSettings, MODULE_NAME } from "./settingsManager.js";
import { getItemFromLibrary } from "./dataProcessor.js";
import { getLumiaField } from "./lumiaContent.js";
import { getLumiaAvatarByName } from "./oocComments.js";

// Track the current indicator state
let currentIndicator = null;
let currentMessageId = null;
let respondedMembers = new Set();
let autoHideTimeout = null;

// Container ID for easy cleanup
const INDICATOR_CONTAINER_ID = "lumiverse-council-indicator";

/**
 * Get avatar URL for a council member by their pack/item reference
 * @param {Object} member - Council member object with packName and itemName
 * @returns {string|null} Avatar image URL or null
 */
function getMemberAvatarUrl(member) {
  if (!member) return null;
  
  const item = getItemFromLibrary(member.packName, member.itemName);
  if (!item) return null;
  
  // Try to get avatar from item fields
  const avatarUrl = item.avatarUrl || item.lumia_img || null;
  if (avatarUrl) return avatarUrl;
  
  // Fallback: try by name
  const memberName = getLumiaField(item, "name") || member.itemName;
  return getLumiaAvatarByName(memberName);
}

/**
 * Get the last assistant message element
 * @returns {HTMLElement|null} The last message element or null
 */
function getLastAssistantMessage() {
  const chat = document.getElementById("chat");
  if (!chat) return null;
  
  // Find all messages
  const messages = chat.querySelectorAll(".mes");
  if (messages.length === 0) return null;
  
  // Get the last message (cast to HTMLElement)
  const lastMessage = /** @type {HTMLElement} */ (messages[messages.length - 1]);
  
  // Check if it's an assistant message (not user)
  const isUser = lastMessage.getAttribute("is_user") === "true" || 
                 lastMessage.classList.contains("is_user");
  
  if (isUser) return null;
  
  return lastMessage;
}

/**
 * Create the CSS styles for the council indicator
 * Injected once and reused
 */
function injectIndicatorStyles() {
  if (document.getElementById("lumiverse-council-indicator-styles")) return;

  const styles = document.createElement("style");
  styles.id = "lumiverse-council-indicator-styles";
  styles.textContent = `
    /* Make form_sheld a positioning context for absolute positioning */
    #form_sheld {
      position: relative !important;
    }

    /* Council Indicator Wrapper - Absolute position above form_sheld content */
    .lumiverse-council-indicator-wrapper {
      position: absolute;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      opacity: 0;
      animation: lumiverse-council-fade-in 0.4s ease forwards;
      pointer-events: none;
    }

    .lumiverse-council-indicator-wrapper.fading-out {
      animation: lumiverse-council-fade-out 0.4s ease forwards;
    }

    /* Council Indicator Container - Centered and larger */
    .lumiverse-council-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 10px 18px;
      min-width: 100px;
      min-height: 48px;
      background: linear-gradient(135deg, var(--lumiverse-bg-hover-095) 0%, var(--lumiverse-bg-surface-2) 100%);
      border: 1px solid var(--lumiverse-primary-040);
      border-radius: 24px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: var(--lumiverse-shadow-md), 0 2px 12px var(--lumiverse-primary-020), var(--lumiverse-highlight-inset);
      animation: lumiverse-council-pulse 2s ease-in-out infinite;
      position: relative;
      overflow: hidden;
      pointer-events: auto;
    }

    .lumiverse-council-indicator::before {
      content: "";
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, var(--lumiverse-primary-015), transparent);
      animation: lumiverse-council-shimmer 3s ease-in-out infinite;
    }

    /* Council Label - Larger text */
    .lumiverse-council-label {
      font-family: "Courier New", "Monaco", "Consolas", monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--lumiverse-primary-095);
      white-space: nowrap;
      position: relative;
      z-index: 1;
    }

    /* Avatar Stack Container */
    .lumiverse-council-avatar-stack {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    /* Individual Avatar - Larger size */
    .lumiverse-council-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--lumiverse-swatch-border);
      box-shadow: var(--lumiverse-shadow-sm), 0 0 0 1px var(--lumiverse-primary-040);
      object-fit: cover;
      margin-left: -10px;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      animation: lumiverse-council-avatar-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      opacity: 0;
      transform: scale(0.8) translateY(4px);
      background: linear-gradient(135deg, var(--lumiverse-bg-deep) 0%, var(--lumiverse-bg-elevated) 100%);
    }

    .lumiverse-council-avatar:first-child {
      margin-left: 0;
    }

    /* Hover state - subtle glow only, no displacement */
    .lumiverse-council-avatar:hover {
      box-shadow: var(--lumiverse-shadow-sm), 0 0 0 2px var(--lumiverse-primary-050);
    }

    /* Loading State */
    .lumiverse-council-indicator.loading {
      animation: lumiverse-council-pulse 1.5s ease-in-out infinite;
    }

    /* Complete State - Larger with darker background */
    .lumiverse-council-indicator.complete {
      animation: none;
      border-color: var(--lumiverse-primary-050);
      background: linear-gradient(135deg, var(--lumiverse-bg-surface-2) 0%, var(--lumiverse-bg-surface-2) 100%);
      box-shadow: var(--lumiverse-shadow-md), 0 4px 16px var(--lumiverse-border-hover), var(--lumiverse-highlight-inset);
    }

    .lumiverse-council-indicator.complete::before {
      animation: none;
    }

    /* Checkmark for complete state - Larger */
    .lumiverse-council-complete-icon {
      width: 20px;
      height: 20px;
      margin-left: 6px;
      color: var(--lumiverse-primary-text-100);
      animation: lumiverse-council-icon-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    /* Animations - Enhanced for larger indicator with darker background */
    @keyframes lumiverse-council-pulse {
      0%, 100% {
        box-shadow: var(--lumiverse-shadow-md), 0 2px 12px var(--lumiverse-primary-020), var(--lumiverse-highlight-inset);
      }
      50% {
        box-shadow: var(--lumiverse-shadow-md), 0 3px 18px var(--lumiverse-primary-035), var(--lumiverse-highlight-inset-md);
      }
    }

    @keyframes lumiverse-council-shimmer {
      0% {
        left: -100%;
      }
      100% {
        left: 100%;
      }
    }

    @keyframes lumiverse-council-avatar-enter {
      0% {
        opacity: 0;
        transform: scale(0.8) translateY(4px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes lumiverse-council-icon-pop {
      0% {
        opacity: 0;
        transform: scale(0) rotate(-45deg);
      }
      70% {
        transform: scale(1.2) rotate(10deg);
      }
      100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }

    @keyframes lumiverse-council-fade-in {
      0% {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      100% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    @keyframes lumiverse-council-fade-out {
      0% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
      }
    }

    /* Staggered animation delays for avatars */
    .lumiverse-council-avatar:nth-child(1) { animation-delay: 0ms; }
    .lumiverse-council-avatar:nth-child(2) { animation-delay: 50ms; }
    .lumiverse-council-avatar:nth-child(3) { animation-delay: 100ms; }
    .lumiverse-council-avatar:nth-child(4) { animation-delay: 150ms; }
    .lumiverse-council-avatar:nth-child(5) { animation-delay: 200ms; }
    .lumiverse-council-avatar:nth-child(6) { animation-delay: 250ms; }
    .lumiverse-council-avatar:nth-child(7) { animation-delay: 300ms; }
    .lumiverse-council-avatar:nth-child(8) { animation-delay: 350ms; }

    /* Mobile: Truncate avatar stack to prevent overflow */
    @media (max-width: 768px) {
      .lumiverse-council-indicator-wrapper {
        top: -55px;
      }

      .lumiverse-council-avatar:nth-child(n+7) {
        display: none;
      }

      .lumiverse-council-avatar-overflow {
        display: flex !important;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid var(--lumiverse-swatch-border);
        background: linear-gradient(135deg, var(--lumiverse-primary-085) 0%, var(--lumiverse-primary-080) 100%);
        color: white;
        font-size: 10px;
        font-weight: 600;
        margin-left: -10px;
        box-shadow: var(--lumiverse-shadow-sm), 0 0 0 1px var(--lumiverse-primary-040);
        animation: lumiverse-council-avatar-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        animation-delay: 300ms;
      }
    }

    /* Hide overflow counter on desktop */
    @media (min-width: 769px) {
      .lumiverse-council-avatar-overflow {
        display: none !important;
      }
    }
  `;

  document.head.appendChild(styles);
}

/**
 * Create the indicator container element
 * @returns {HTMLElement} The indicator wrapper containing the indicator
 */
function createIndicatorContainer() {
  injectIndicatorStyles();

  // Create wrapper for positioning and animations
  const wrapper = document.createElement("div");
  wrapper.id = INDICATOR_CONTAINER_ID;
  wrapper.className = "lumiverse-council-indicator-wrapper";

  // Create the actual indicator
  const container = document.createElement("div");
  container.className = "lumiverse-council-indicator loading";

  // Label
  const label = document.createElement("span");
  label.className = "lumiverse-council-label";
  label.textContent = "Council";
  container.appendChild(label);

  // Avatar stack container
  const avatarStack = document.createElement("div");
  avatarStack.className = "lumiverse-council-avatar-stack";
  avatarStack.id = "lumiverse-council-avatar-stack";
  container.appendChild(avatarStack);

  wrapper.appendChild(container);

  return wrapper;
}

/**
 * Show the council indicator above the chat input
 * Call this when starting sidecar tool execution
 */
export function showCouncilIndicator() {
  // Clear any existing indicator first
  hideCouncilIndicator();

  // Check if indicator is already visible
  const existing = document.getElementById(INDICATOR_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }

  respondedMembers.clear();

  // Create the indicator
  currentIndicator = createIndicatorContainer();

  // Insert at the beginning of form_sheld so it appears above the input
  // This positions it naturally without affecting layout flow
  const formSheld = document.getElementById("form_sheld");
  if (formSheld) {
    // Prepend to form_sheld - indicator will be absolutely positioned
    formSheld.insertBefore(currentIndicator, formSheld.firstChild);
  } else {
    // Fallback to body if form_sheld not found
    document.body.appendChild(currentIndicator);
  }

  console.log(`[${MODULE_NAME}] Council indicator shown`);
}

/**
 * Add a member's avatar to the indicator
 * Call this when a council member responds
 * @param {Object} member - Council member object with packName and itemName
 */
export function addMemberToIndicator(member) {
  if (!currentIndicator || !member) return;

  const memberKey = `${member.packName}::${member.itemName}`;

  // Don't add duplicates
  if (respondedMembers.has(memberKey)) return;
  respondedMembers.add(memberKey);

  // Query within the indicator element inside the wrapper
  const indicatorEl = currentIndicator.querySelector('.lumiverse-council-indicator');
  if (!indicatorEl) return;

  const avatarStack = indicatorEl.querySelector("#lumiverse-council-avatar-stack");
  if (!avatarStack) return;

  // Remove existing overflow badge if present
  const existingOverflow = avatarStack.querySelector(".lumiverse-council-avatar-overflow");
  if (existingOverflow) {
    existingOverflow.remove();
  }

  const avatarUrl = getMemberAvatarUrl(member);

  // Create avatar image
  const avatar = document.createElement("img");
  avatar.className = "lumiverse-council-avatar";
  avatar.alt = member.itemName || "Council Member";

  if (avatarUrl) {
    avatar.src = avatarUrl;
  } else {
    // Fallback: use initials or generic avatar
    avatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%239370DB'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='10'%3E?%3C/text%3E%3C/svg%3E";
  }

  // Add tooltip with member name
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = item ? (getLumiaField(item, "name") || member.itemName) : member.itemName;
  avatar.title = `${memberName} has spoken`;

  avatarStack.appendChild(avatar);

  // Add overflow badge if more than 6 members (mobile only via CSS)
  const memberCount = respondedMembers.size;
  if (memberCount > 6) {
    const overflowBadge = document.createElement("span");
    overflowBadge.className = "lumiverse-council-avatar-overflow";
    overflowBadge.textContent = `+${memberCount - 6}`;
    overflowBadge.title = `${memberCount} total council members`;
    avatarStack.appendChild(overflowBadge);
  }

  console.log(`[${MODULE_NAME}] Added ${memberName} to council indicator`);
}

/**
 * Mark the indicator as complete
 * Shows a checkmark and changes styling
 */
export function markIndicatorComplete() {
  if (!currentIndicator) return;

  const indicatorEl = currentIndicator.querySelector('.lumiverse-council-indicator');
  if (!indicatorEl) return;

  indicatorEl.classList.remove("loading");
  indicatorEl.classList.add("complete");

  // Add checkmark icon
  const checkmark = document.createElement("span");
  checkmark.className = "lumiverse-council-complete-icon";
  checkmark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  checkmark.title = "Council deliberation complete";
  indicatorEl.appendChild(checkmark);

  console.log(`[${MODULE_NAME}] Council indicator marked complete`);

  // Clear any existing timeout
  clearAutoHideTimeout();

  // Auto-hide after 2 seconds with fade-out animation
  autoHideTimeout = setTimeout(() => {
    if (currentIndicator) {
      currentIndicator.classList.add("fading-out");
      // Wait for animation to complete before removing
      setTimeout(() => {
        hideCouncilIndicator();
      }, 400);
    }
  }, 2000);
}

/**
 * Clear any pending auto-hide timeout
 */
function clearAutoHideTimeout() {
  if (autoHideTimeout) {
    clearTimeout(autoHideTimeout);
    autoHideTimeout = null;
  }
}

/**
 * Hide and remove the council indicator
 */
export function hideCouncilIndicator() {
  clearAutoHideTimeout();
  if (currentIndicator) {
    currentIndicator.remove();
    currentIndicator = null;
  }
  respondedMembers.clear();
}

/**
 * Check if indicator is currently shown
 * @returns {boolean}
 */
export function isIndicatorShown() {
  return !!currentIndicator;
}

/**
 * Reset the indicator state (call on new generation start)
 */
export function resetIndicator() {
  hideCouncilIndicator();
}
