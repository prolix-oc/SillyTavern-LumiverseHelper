# Lumia Injector Extension

An extension for SillyTavern that dynamically injects character definitions, personalities, behaviors, and narrative styles into prompts using macros.

## Features

- **Pack Management**: Load and manage multiple content packs from URLs or local files
- **Lumia Content**: Mix and match character definitions, behaviors, and personalities
- **Loom Content**: Apply narrative styles, utilities, and retrofits to shape AI output
- **Macro Injection**: Use simple macros in prompts to inject selected content
- **Loom Summarization**: Automatic story summary capture and injection
- **Sovereign Hand**: Co-pilot mode for guided narrative control
- **State Persistence**: Remembers your selections across sessions

## Installation

### Via SillyTavern UI (Recommended)

1. Open SillyTavern in your browser
2. Click the **Extensions** icon (3 stacked cubes) in the top bar
3. Click **Install Extension**
4. Paste the following URL:
   ```
   https://github.com/lumiainjector/LumiaInjectorExtension
   ```
5. Click **Install (for me or for everyone)**
6. Refresh the page

The extension will appear in your Extensions panel, ready to use.

### Manual Installation

1. Navigate to your SillyTavern installation's `data/default-user/extensions/` directory
2. Clone or download this repository into that folder
3. Refresh SillyTavern

## Quick Start

1. Open the **Extensions** panel in SillyTavern
2. Find **Lumia Injector** and expand the settings
3. Add a pack by entering a URL and clicking **Fetch**, upload a local JSON file, or import straight from [Lucid.cards](https://lucid.cards)
4. Select your desired content from each category
5. Add macros to your Character Card or system prompt:
   ```
   {{lumiaDef}}
   {{lumiaPersonality}}
   {{lumiaBehavior}}
   {{loomStyle}}
   ```

## Documentation

- [Pack Naming Guide](docs/PACK_NAMING_GUIDE.md) - How to create and structure content packs
- [Macro Reference](docs/MACRO_REFERENCE.md) - Complete list of available macros

## Basic Macros

| Macro | Description |
|-------|-------------|
| `{{lumiaDef}}` | Selected physical definition |
| `{{lumiaBehavior}}` | All selected behaviors |
| `{{lumiaPersonality}}` | All selected personalities |
| `{{loomStyle}}` | Selected narrative style |
| `{{loomUtils}}` | All selected utilities |
| `{{loomRetrofits}}` | All selected retrofits |

See the [Macro Reference](docs/MACRO_REFERENCE.md) for the complete list including `.len` counters, random Lumia macros, and Loom system macros.

## Creating Packs

Packs are World Book JSON files with specially formatted entries. See the [Pack Naming Guide](docs/PACK_NAMING_GUIDE.md) for details on:

- Pack metadata (cover images, author names)
- Lumia item naming (Definition, Behavior, Personality)
- Loom item naming (Narrative Style, Loom Utilities, Retrofits)

## License

MIT
