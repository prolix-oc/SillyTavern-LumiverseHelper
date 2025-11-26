# Lumia Injector Extension

An extension for SillyTavern that allows fetching "world books" and dynamically injecting character definitions, personalities, and behaviors into prompts using macros.

## Features

- **World Book Fetching**: Load a World Book JSON file from a URL.
- **Dynamic Selection**:
  - Select one **Physical Definition** (e.g., Chillweaver).
  - Select multiple **Behaviors** (mix and match).
  - Select multiple **Personalities** (mix and match).
- **Macro Injection**: Use macros in your prompts or character cards to inject the selected content.
  - `{{lumiaDef}}`: The selected definition.
  - `{{lumiaBehavior}}`: All selected behaviors fused together.
  - `{{lumiaPersonality}}`: All selected personalities fused together.
- **State Persistence**: Remembers your selections and loaded World Book across sessions.

## Installation

1. Navigate to your SillyTavern `public/scripts/extensions` directory.
2. Create a folder named `lumia-injector` (or similar).
3. Copy the files (`index.js`, `settings.html`, `style.css`) into that folder.
4. Refresh SillyTavern.

## Usage

1. Open the Extensions Settings panel in SillyTavern.
2. Locate **Lumia Injector Settings**.
3. Enter the URL of a compatible World Book JSON file (e.g., raw GitHub link) and click **Fetch**.
4. Once loaded, you will see lists for Definitions, Behaviors, and Personalities.
5. Select the desired options.
6. In your Character Card or Prompt format, add the macros:
   ```
   {{lumiaDef}}
   {{lumiaPersonality}}
   {{lumiaBehavior}}
   ```
7. The extension will automatically replace these macros with the content of your selections when generating a prompt.

## Compatibility

This extension looks for specific keys in the World Book entries to categorize them:
- **Definitions**: `outletName` = "Lumia_Description" (or comment contains "Definition")
- **Behaviors**: `outletName` = "Lumia_Behavior" (or comment contains "Behavior")
- **Personalities**: `outletName` = "Lumia_Personality" (or comment contains "Personality")
