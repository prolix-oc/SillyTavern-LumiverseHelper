# Pack Developer Naming Guide

This guide explains the naming conventions for Lumia Injector packs. Proper naming ensures your content is correctly parsed and displayed to users.

## Overview

Lumia Injector recognizes **4 item types** within packs:

| Type                  | Category | Purpose                                    |
| --------------------- | -------- | ------------------------------------------ |
| **Lumia Definition**  | Lumia    | Physical descriptions of characters        |
| **Lumia Behavior**    | Lumia    | Behavioral traits and patterns             |
| **Lumia Personality** | Lumia    | Personality traits and characteristics     |
| **Loom Content**      | Loom     | Narrative styles, utilities, and retrofits |

---

## Pack Names

Pack names are the top-level identifier for your content collection.

### Naming Rules

- Pack names are derived from the **filename** when fetched via URL
- For uploads, the user provides the pack name
- Pack names must be **unique** - duplicates will prompt an overwrite confirmation

### Best Practices

- Use descriptive, concise names
- Avoid special characters that may cause filesystem issues
- Include version numbers if you plan to release updates (e.g., `MyPack_v2`)

**Examples:**

- `FantasyCharacters.json`
- `SciFi_Companions_v3.json`
- `NarrativeStyles_Premium.json`

---

## Pack Metadata

Pack metadata provides information about the pack itself, displayed in the pack browser. This is a special entry that sets the cover image and author name for your pack.

### Comment Format

The metadata entry is identified by its comment field:

```
Metadata
```

Or with parentheses:

```
(Metadata)
```

Both formats are recognized (case-insensitive).

### Content Tags

| Tag                  | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `[cover_img=URL]`    | Cover image displayed in the pack browser  |
| `[author_name=Name]` | Author/creator name shown on the pack card |

### Complete Metadata Example

```json
{
  "comment": "Metadata",
  "content": "[cover_img=https://example.com/pack-cover.png][author_name=JohnDoe]"
}
```

### Display Behavior

- If no metadata entry exists, the pack shows a placeholder image and "Unknown Author"
- Cover images are lazy-loaded in the browser for performance
- The metadata entry itself is not processed as a Lumia or Loom item

### Best Practices

- Use a high-quality square or landscape image for the cover (recommended: 400x300px or similar)
- Host images on reliable services (imgur, GitHub raw, etc.)
- Keep author names concise

---

## Item Naming Convention

All items within a pack are identified by a **comment field** in the World Book entry. The name is extracted from **parentheses** in the comment.

```
Category (ItemName)
```

### Critical Rule

**Items without parentheses in the comment field will be IGNORED.**

---

## Lumia Items (Definition, Behavior, Personality)

Lumia items describe characters with three aspects: physical definition, behavior, and personality. Items with the **same name** are **merged** into a single Lumia character.

### Lumia Definition

Physical description of a character.

**Comment Format Options:**

```
Lumia (CharacterName)
Definition (CharacterName)
```

**Alternative:** Set `outletName` to `"Lumia_Description"`

**Example Entry:**

```json
{
  "comment": "Lumia (Aria)",
  "content": "Aria is a tall elven woman with silver hair...",
  "outletName": "Lumia_Description"
}
```

### Lumia Behavior

Behavioral patterns and tendencies.

**Comment Format:**

```
Behavior (CharacterName)
```

**Alternative:** Set `outletName` to `"Lumia_Behavior"`

**Example Entry:**

```json
{
  "comment": "Behavior (Aria)",
  "content": "Aria speaks softly and deliberately. She pauses before answering questions...",
  "outletName": "Lumia_Behavior"
}
```

### Lumia Personality

Personality traits and characteristics.

**Comment Format:**

```
Personality (CharacterName)
```

**Alternative:** Set `outletName` to `"Lumia_Personality"`

**Example Entry:**

```json
{
  "comment": "Personality (Aria)",
  "content": "Aria is introverted but deeply caring. She values honesty above all...",
  "outletName": "Lumia_Personality"
}
```

### Complete Lumia Character Example

A full character with all three components:

```json
{
  "entries": {
    "0": {
      "comment": "Lumia (Aria)",
      "content": "[lumia_img=https://example.com/aria.png][lumia_author=JohnDoe]Aria is a tall elven woman with silver hair and piercing blue eyes.",
      "outletName": "Lumia_Description"
    },
    "1": {
      "comment": "Behavior (Aria)",
      "content": "Aria speaks softly and deliberately. She often pauses mid-sentence to gather her thoughts.",
      "outletName": "Lumia_Behavior"
    },
    "2": {
      "comment": "Personality (Aria)",
      "content": "Introverted but deeply caring. Values honesty and loyalty above all else.",
      "outletName": "Lumia_Personality"
    }
  }
}
```

**Result:** These three entries merge into one Lumia item named "Aria".

---

## Loom Items (Narrative Style, Utilities, Retrofits)

Loom items are standalone content pieces for narrative control. Unlike Lumia items, Loom items are **not merged** - each entry remains separate.

### Loom Categories

| Category            | Purpose                               |
| ------------------- | ------------------------------------- |
| **Narrative Style** | Writing style and prose guidance      |
| **Loom Utilities**  | Utility functions and helper content  |
| **Retrofits**       | System modifications and enhancements |

### Naming Format

Loom items use **exact category prefixes** before the parentheses:

```
Narrative Style (ItemName)
Loom Utilities (ItemName)
Retrofits (ItemName)
```

**The category prefix must match exactly (case-sensitive).**

### Nested Parentheses Support

Loom item names can contain nested parentheses for additional descriptions:

```
Narrative Style (Kafka (Surreal Bureaucratic Horror))
Loom Utilities (Scene Manager (Advanced))
Retrofits (Memory System (v2))
```

The parser captures everything between the first `(` after the category and the final `)` at the end of the comment.

### Narrative Style Example

```json
{
  "comment": "Narrative Style (Gothic Horror)",
  "content": "Write in a dark, atmospheric style. Use vivid sensory descriptions emphasizing shadows, decay, and unease. Sentences should be longer and more complex, building tension gradually."
}
```

### Loom Utilities Example

```json
{
  "comment": "Loom Utilities (Scene Transition)",
  "content": "When transitioning between scenes, use a brief temporal or spatial marker followed by sensory grounding in the new location."
}
```

### Retrofits Example

```json
{
  "comment": "Retrofits (Memory Enhancement)",
  "content": "Track and reference previous conversations, character states, and plot points. Maintain consistency with established facts."
}
```

---

## Metadata Tags

Lumia Definitions support optional metadata tags within the content field.

### Image Tag

Add a character portrait:

```
[lumia_img=https://example.com/image.png]
```

### Author Tag

Credit the content creator:

```
[lumia_author=AuthorName]
```

### Usage Example

```json
{
  "comment": "Lumia (Aria)",
  "content": "[lumia_img=https://i.imgur.com/abc123.png][lumia_author=JohnDoe]Aria is a tall elven woman with silver hair..."
}
```

The tags are automatically stripped from the displayed content.

---

## Quick Reference

| Item Type       | Comment Format                        | Merges?      |
| --------------- | ------------------------------------- | ------------ |
| Definition      | `Lumia (Name)` or `Definition (Name)` | Yes, by name |
| Behavior        | `Behavior (Name)`                     | Yes, by name |
| Personality     | `Personality (Name)`                  | Yes, by name |
| Narrative Style | `Narrative Style (Name)`              | No           |
| Loom Utilities  | `Loom Utilities (Name)`               | No           |
| Retrofits       | `Retrofits (Name)`                    | No           |

---

## Common Mistakes

1. **Missing parentheses** - Entry will be ignored
   - Wrong: `Lumia Aria`
   - Correct: `Lumia (Aria)`

2. **Typos in Loom categories** - Entry will be treated as Lumia
   - Wrong: `Narrative Styles (Gothic)` (note the 's')
   - Correct: `Narrative Style (Gothic)`

3. **Mismatched names for Lumia merging** - Creates separate characters
   - `Lumia (Aria)` + `Behavior (aria)` = Two separate items (case matters)

4. **Missing content** - Entry will be skipped
   - Always ensure the `content` field has actual text

---

## File Structure

Your World Book JSON should follow this structure:

```json
{
  "entries": {
    "0": { "comment": "...", "content": "..." },
    "1": { "comment": "...", "content": "..." }
  }
}
```

Or as a flat array:

```json
[
  { "comment": "...", "content": "..." },
  { "comment": "...", "content": "..." }
]
```

Both formats are supported.
