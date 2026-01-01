# Pack Developer Guide

This guide explains how to create Lumia and Loom content packs for the Lumiverse Helper extension.

## Overview

Lumiverse Helper recognizes **4 item types** within packs:

| Type                  | Category | Purpose                                    |
| --------------------- | -------- | ------------------------------------------ |
| **Lumia Definition**  | Lumia    | Physical descriptions of characters        |
| **Lumia Behavior**    | Lumia    | Behavioral traits and patterns             |
| **Lumia Personality** | Lumia    | Personality traits and characteristics     |
| **Loom Content**      | Loom     | Narrative styles, utilities, and retrofits |

---

## Native Pack Format (Recommended)

The native Lumiverse format is a structured JSON schema with separate arrays for Lumia and Loom items.

### Pack Structure

```json
{
  "packName": "My Character Pack",
  "packAuthor": "YourName",
  "coverUrl": "https://example.com/cover.png",
  "version": 1,
  "packExtras": [],
  "lumiaItems": [],
  "loomItems": []
}
```

### Pack Fields

| Field         | Type   | Required | Description                              |
| ------------- | ------ | -------- | ---------------------------------------- |
| `packName`    | string | Yes      | Display name for the pack                |
| `packAuthor`  | string | No       | Creator/author name                      |
| `coverUrl`    | string | No       | URL to pack cover image (400x300px recommended) |
| `version`     | number | No       | Pack version number (default: 1)         |
| `packExtras`  | array  | No       | Additional pack metadata (reserved)      |
| `lumiaItems`  | array  | Yes      | Array of Lumia character items           |
| `loomItems`   | array  | No       | Array of Loom narrative items            |

---

## Lumia Items

Each Lumia item represents a character with definition, personality, and behavior combined into a single object.

### Lumia Item Structure

```json
{
  "lumiaName": "Aria",
  "lumiaDefinition": "Aria is a tall elven woman with silver hair and piercing blue eyes...",
  "lumiaPersonality": "Introverted but deeply caring. Values honesty and loyalty above all else.",
  "lumiaBehavior": "Speaks softly and deliberately. Often pauses mid-sentence to gather her thoughts.",
  "avatarUrl": "https://example.com/aria.png",
  "genderIdentity": 0,
  "authorName": "JohnDoe",
  "version": 1
}
```

### Lumia Item Fields

| Field             | Type   | Required | Description                                      |
| ----------------- | ------ | -------- | ------------------------------------------------ |
| `lumiaName`       | string | Yes      | Character's display name                         |
| `lumiaDefinition` | string | Yes      | Physical description and background              |
| `lumiaPersonality`| string | No       | Personality traits and characteristics           |
| `lumiaBehavior`   | string | No       | Behavioral patterns and tendencies               |
| `avatarUrl`       | string | No       | URL to character portrait image                  |
| `genderIdentity`  | number | No       | Pronoun preference: 0=she/her, 1=he/him, 2=they/them |
| `authorName`      | string | No       | Creator of this specific character               |
| `version`         | number | No       | Item version number (default: 1)                 |

### Gender Identity Values

| Value | Pronouns   |
| ----- | ---------- |
| 0     | she/her    |
| 1     | he/him     |
| 2     | they/them  |

### Complete Lumia Pack Example

```json
{
  "packName": "Fantasy Characters",
  "packAuthor": "JohnDoe",
  "coverUrl": "https://example.com/fantasy-pack.png",
  "version": 1,
  "packExtras": [],
  "lumiaItems": [
    {
      "lumiaName": "Aria",
      "lumiaDefinition": "Aria is a tall elven woman with silver hair that cascades down to her waist. Her piercing blue eyes reflect centuries of wisdom. She wears flowing robes of deep forest green.",
      "lumiaPersonality": "Introverted but deeply caring. Values honesty and loyalty above all else. Has a dry sense of humor that emerges unexpectedly.",
      "lumiaBehavior": "Speaks softly and deliberately. Often pauses mid-sentence to gather her thoughts. Tilts her head slightly when listening intently.",
      "avatarUrl": "https://example.com/aria.png",
      "genderIdentity": 0,
      "authorName": "JohnDoe",
      "version": 1
    },
    {
      "lumiaName": "Marcus",
      "lumiaDefinition": "Marcus is a weathered human knight in his late forties. His graying beard is neatly trimmed, and a prominent scar runs across his left cheek. He wears well-maintained plate armor.",
      "lumiaPersonality": "Stoic and disciplined, but harbors a deep sense of guilt over past failures. Protective of those he considers under his care.",
      "lumiaBehavior": "Stands at attention even when relaxed. Speaks in measured, formal tones. Often checks exits and potential threats when entering new spaces.",
      "avatarUrl": "https://example.com/marcus.png",
      "genderIdentity": 1,
      "authorName": "JohnDoe",
      "version": 1
    }
  ],
  "loomItems": []
}
```

---

## Loom Items

Loom items provide narrative guidance, utilities, and system modifications. Each item belongs to a category.

### Loom Item Structure

```json
{
  "loomName": "Gothic Horror",
  "loomContent": "Write in a dark, atmospheric style. Use vivid sensory descriptions emphasizing shadows, decay, and unease.",
  "loomCategory": "Narrative Style",
  "authorName": "JohnDoe",
  "version": 1
}
```

### Loom Item Fields

| Field          | Type   | Required | Description                              |
| -------------- | ------ | -------- | ---------------------------------------- |
| `loomName`     | string | Yes      | Display name for the item                |
| `loomContent`  | string | Yes      | The actual content/instructions          |
| `loomCategory` | string | Yes      | Category (see below)                     |
| `authorName`   | string | No       | Creator of this item                     |
| `version`      | number | No       | Item version number (default: 1)         |

### Loom Categories

| Category           | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `Narrative Style`  | Writing style and prose guidance             |
| `Loom Utilities`   | Utility functions and helper content         |
| `Retrofits`        | System modifications and enhancements        |

### Complete Loom Pack Example

```json
{
  "packName": "Narrative Styles Collection",
  "packAuthor": "JaneDoe",
  "coverUrl": "https://example.com/styles-pack.png",
  "version": 1,
  "packExtras": [],
  "lumiaItems": [],
  "loomItems": [
    {
      "loomName": "Gothic Horror",
      "loomContent": "Write in a dark, atmospheric style. Use vivid sensory descriptions emphasizing shadows, decay, and unease. Sentences should be longer and more complex, building tension gradually. Favor archaic vocabulary and formal prose.",
      "loomCategory": "Narrative Style",
      "authorName": "JaneDoe",
      "version": 1
    },
    {
      "loomName": "Scene Transition Helper",
      "loomContent": "When transitioning between scenes, use a brief temporal or spatial marker followed by sensory grounding in the new location. Example: 'Three hours later, the rain had stopped...'",
      "loomCategory": "Loom Utilities",
      "authorName": "JaneDoe",
      "version": 1
    },
    {
      "loomName": "Memory Enhancement",
      "loomContent": "Track and reference previous conversations, character states, and plot points. Maintain consistency with established facts. When uncertain, acknowledge what was previously established.",
      "loomCategory": "Retrofits",
      "authorName": "JaneDoe",
      "version": 1
    }
  ]
}
```

---

## Mixed Pack Example

Packs can contain both Lumia and Loom items:

```json
{
  "packName": "Complete Fantasy Kit",
  "packAuthor": "StudioName",
  "coverUrl": "https://example.com/kit.png",
  "version": 2,
  "packExtras": [],
  "lumiaItems": [
    {
      "lumiaName": "Aria",
      "lumiaDefinition": "A tall elven mage with silver hair...",
      "lumiaPersonality": "Wise and patient...",
      "lumiaBehavior": "Speaks in measured tones...",
      "avatarUrl": "https://example.com/aria.png",
      "genderIdentity": 0,
      "authorName": "StudioName",
      "version": 1
    }
  ],
  "loomItems": [
    {
      "loomName": "High Fantasy Style",
      "loomContent": "Write with epic scope and grandeur...",
      "loomCategory": "Narrative Style",
      "authorName": "StudioName",
      "version": 1
    }
  ]
}
```

---

## Pack Extras (Advanced)

The `packExtras` array allows for additional pack-level content. This is reserved for future use but follows this structure:

```json
{
  "packExtras": [
    {
      "type": "bar",
      "name": "Custom Status Bar",
      "description": "A status bar for tracking...",
      "content": "..."
    }
  ]
}
```

---

## Best Practices

### Pack Names
- Use descriptive, concise names
- Avoid special characters that may cause filesystem issues
- Include version numbers for updates (e.g., "My Pack v2")

### Cover Images
- Use high-quality images (recommended: 400x300px)
- Host on reliable services (imgur, GitHub raw, etc.)
- Use landscape or square aspect ratios

### Character Definitions
- Be specific and detailed in physical descriptions
- Include distinctive features that make the character memorable
- Mention typical clothing, accessories, or equipment

### Personality & Behavior
- Focus on actionable traits the AI can portray
- Include speech patterns, mannerisms, and habits
- Describe how the character reacts in different situations

### Loom Content
- Be clear and directive in writing style guidance
- Provide examples where helpful
- Keep utility content focused on specific techniques

---

## Legacy World Book Format

For backward compatibility, Lumiverse Helper also supports the SillyTavern World Book format. See the [Legacy Format Reference](#legacy-world-book-format-reference) below.

---

## Legacy World Book Format Reference

The World Book format uses comment-based naming to identify items.

### File Structure

```json
{
  "entries": {
    "0": { "comment": "...", "content": "..." },
    "1": { "comment": "...", "content": "..." }
  }
}
```

### Naming Convention

Items are identified by a **comment field** with the name in **parentheses**:

```
Category (ItemName)
```

### Lumia Items

```json
{
  "comment": "Lumia (Aria)",
  "content": "[lumia_img=https://example.com/aria.png][lumia_author=JohnDoe]Aria is a tall elven woman..."
}
```

```json
{
  "comment": "Behavior (Aria)",
  "content": "Speaks softly and deliberately..."
}
```

```json
{
  "comment": "Personality (Aria)",
  "content": "Introverted but deeply caring..."
}
```

Items with the same name in parentheses are merged into a single character.

### Loom Items

```json
{
  "comment": "Narrative Style (Gothic Horror)",
  "content": "Write in a dark, atmospheric style..."
}
```

### Pack Metadata

```json
{
  "comment": "Metadata",
  "content": "[cover_img=https://example.com/cover.png][author_name=JohnDoe]"
}
```

### Quick Reference

| Item Type       | Comment Format                        |
| --------------- | ------------------------------------- |
| Definition      | `Lumia (Name)` or `Definition (Name)` |
| Behavior        | `Behavior (Name)`                     |
| Personality     | `Personality (Name)`                  |
| Narrative Style | `Narrative Style (Name)`              |
| Loom Utilities  | `Loom Utilities (Name)`               |
| Retrofits       | `Retrofits (Name)`                    |
