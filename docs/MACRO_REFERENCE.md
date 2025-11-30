# Macro Reference

This document lists all available macros provided by Lumia Injector for use in prompts, character cards, and other SillyTavern templates.

## Usage

Macros are enclosed in double curly braces and are automatically replaced with their content during prompt generation:

```
{{macroName}}
```

---

## Lumia Content Macros

These macros inject content from your selected Lumia characters.

### Selected Content

| Macro                  | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `{{lumiaDef}}`         | The physical definition of the selected Lumia character |
| `{{lumiaBehavior}}`    | All selected behaviors, merged together                 |
| `{{lumiaPersonality}}` | All selected personalities, merged together             |

### Length Counters

| Macro                      | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `{{lumiaDef.len}}`         | Returns `1` if a definition is selected, `0` otherwise |
| `{{lumiaBehavior.len}}`    | Number of selected behaviors (e.g., `3`)               |
| `{{lumiaPersonality.len}}` | Number of selected personalities                       |

### Example Usage

```
{{#if lumiaBehavior.len}}
Character behaviors:
{{lumiaBehavior}}
{{/if}}
```

---

## Random Lumia Macros

These macros select a random Lumia from all loaded packs and provide access to its properties. The same random Lumia is used for all macros within a single generation.

| Macro                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `{{randomLumia}}`       | Physical definition of a random Lumia             |
| `{{randomLumia.phys}}`  | Physical definition (alias for `{{randomLumia}}`) |
| `{{randomLumia.pers}}`  | Personality of the random Lumia                   |
| `{{randomLumia.behav}}` | Behavior of the random Lumia                      |
| `{{randomLumia.name}}`  | Name of the random Lumia                          |

### Nested Usage

Random Lumia macros can be nested within pack content. If a Lumia definition contains `{{randomLumia.name}}`, it will be expanded when the content is retrieved.

---

## Loom Content Macros

These macros inject content from your selected Loom items.

### Selected Content

| Macro               | Description                                    |
| ------------------- | ---------------------------------------------- |
| `{{loomStyle}}`     | All selected narrative styles, merged together |
| `{{loomUtils}}`     | All selected Loom utilities, merged together   |
| `{{loomRetrofits}}` | All selected retrofits, merged together        |

### Length Counters

| Macro                   | Description                         |
| ----------------------- | ----------------------------------- |
| `{{loomStyle.len}}`     | Number of selected narrative styles |
| `{{loomUtils.len}}`     | Number of selected utilities        |
| `{{loomRetrofits.len}}` | Number of selected retrofits        |

---

## Loom System Macros

These macros support the Loom summarization and Sovereign Hand features.

### Summarization

| Macro                   | Description                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| `{{loomSummary}}`       | The current stored story summary                                           |
| `{{loomSummaryPrompt}}` | Directive that instructs the AI to generate summaries in `<loom_sum>` tags |

### Sovereign Hand (Co-Pilot Mode)

| Macro                     | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `{{loomSovHand}}`         | Full Sovereign Hand prompt with user instructions injected           |
| `{{loomSovHandActive}}`   | Returns `**Yes.**` or `**No.**` based on feature status              |
| `{{loomLastUserMessage}}` | The captured last user message (only when Sovereign Hand is enabled) |

---

## Quick Reference Table

| Category | Macro                     | Multi-Select | Has `.len` |
| -------- | ------------------------- | ------------ | ---------- |
| Lumia    | `{{lumiaDef}}`            | No           | Yes        |
| Lumia    | `{{lumiaBehavior}}`       | Yes          | Yes        |
| Lumia    | `{{lumiaPersonality}}`    | Yes          | Yes        |
| Lumia    | `{{randomLumia}}`         | N/A          | No         |
| Lumia    | `{{randomLumia.phys}}`    | N/A          | No         |
| Lumia    | `{{randomLumia.pers}}`    | N/A          | No         |
| Lumia    | `{{randomLumia.behav}}`   | N/A          | No         |
| Lumia    | `{{randomLumia.name}}`    | N/A          | No         |
| Loom     | `{{loomStyle}}`           | Yes          | Yes        |
| Loom     | `{{loomUtils}}`           | Yes          | Yes        |
| Loom     | `{{loomRetrofits}}`       | Yes          | Yes        |
| Loom     | `{{loomSummary}}`         | N/A          | No         |
| Loom     | `{{loomSummaryPrompt}}`   | N/A          | No         |
| Loom     | `{{loomSovHand}}`         | N/A          | No         |
| Loom     | `{{loomSovHandActive}}`   | N/A          | No         |
| Loom     | `{{loomLastUserMessage}}` | N/A          | No         |

---

## Notes

- **Empty values**: Macros return an empty string if nothing is selected
- **Dominant traits**: When a behavior or personality is marked as dominant, it receives a special tag like `(My MOST PREVALENT Trait)` appended to its header
- **Merge behavior**: Multi-select content is joined with newlines (behaviors) or double newlines (personalities)
- **Random persistence**: The random Lumia selection persists for the duration of a single prompt generation, ensuring consistency across multiple `{{randomLumia.*}}` calls
