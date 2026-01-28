// src/index.ts
import './style.css';
import settingsHtml from './settings.html';

// Explicitly declare SillyTavern global access
const context = (window as any).SillyTavern.getContext();
const EXTENSION_NAME = "WebpackSettingsManager";

console.log(`${EXTENSION_NAME}: Loading...`);

// --- UI INJECTION LOGIC ---

function injectSettings() {
    // 1. Find the extensions settings container
    const settingsContainer = document.getElementById('extensions_settings');
    if (!settingsContainer) {
        console.warn(`${EXTENSION_NAME}: Settings container not found.`);
        return;
    }

    // 2. Check if we already injected
    if (document.getElementById('webpack_settings_manager_panel')) {
        return;
    }

    // 3. Create a wrapper
    const wrapper = document.createElement('div');
    wrapper.id = 'webpack_settings_manager_panel';
    wrapper.innerHTML = settingsHtml;

    // 4. Append to container
    settingsContainer.appendChild(wrapper);
    console.log(`${EXTENSION_NAME}: Settings injected.`);
    
    // 5. Bind Events immediately after injection
    bindEvents(wrapper);
}

function bindEvents(container: HTMLElement) {
    const $ = (window as any).jQuery;
    
    $(container).find('#btn_apply_chat').on('click', () => {
        const presetName = $('#demo_chat_preset_name').val();
        applyChatSettings(presetName);
    });

    $(container).find('#btn_apply_instruct').on('click', () => {
        applyInstructSettings();
    });

    $(container).find('#btn_apply_reasoning').on('click', () => {
        applyReasoningSettings();
    });

    $(container).find('#demo_import_file').on('change', (e: Event) => {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            handlePresetImport(input.files[0]);
            input.value = ''; // Reset input
        }
    });
}

// --- CORE LOGIC (Ported from Simple Example) ---

function logStatus(msg: string) {
    const $ = (window as any).jQuery;
    const $log = $('#demo_status_log');
    const timestamp = new Date().toLocaleTimeString();
    if ($log.length) {
        $log.val($log.val() + `[${timestamp}] ${msg}\n`);
        $log.scrollTop($log[0].scrollHeight);
    }
    console.log(`[${EXTENSION_NAME}] ${msg}`);
}

async function applyChatSettings(presetName: string) {
    logStatus("Creating Chat Completion preset...");
    const manager = context.getPresetManager('openai');
    const name = presetName || "Example API Preset";
    
    const data = {
        "temp_openai": 1.2,
        "top_p_openai": 0.9,
        "openai_model": "gpt-4-turbo", 
        "context_window": 32000,
        "freq_pen_openai": 0.1,
        "pres_pen_openai": 0.1,
        "mistralai_model": "" // Added to prevent potential undefined error in ST core
    };

    try {
        await manager.savePreset(name, data);
        await manager.selectPreset(name);
        context.saveSettingsDebounced();
        (window as any).toastr.success("Chat Preset Applied Successfully");
        logStatus("Done: Chat Preset Applied.");
    } catch (err: any) {
        console.error(err);
        logStatus("Error: " + err.message);
        (window as any).toastr.error("Failed to apply Chat Preset");
    }
}

async function applyInstructSettings() {
    logStatus("Creating Instruct Mode preset...");
    const manager = context.getPresetManager('instruct');
    const name = "Example Instruct Preset";

    const data = {
        "user_alignment_message": "\nUser: ",
        "output_sequence": "\nAssistant: ",
        "system_sequence": "\nSystem: ",
        "names_behavior": "force",
        "wrap": true,
        "macro": true
    };

    try {
        await manager.savePreset(name, data);
        await manager.selectPreset(name);
        
        // Access global objects properly in TS
        context.powerUserSettings.instruct.enabled = true;
        
        context.saveSettingsDebounced();
        (window as any).toastr.success("Instruct Preset Applied");
        logStatus("Done: Instruct Mode Enabled.");
    } catch (err: any) {
        console.error(err);
        logStatus("Error: " + err.message);
    }
}

function applyReasoningSettings() {
    logStatus("Configuring Reasoning & Bias...");
    try {
        const power_user = context.powerUserSettings;
        power_user.reasoning.auto_parse = true;
        power_user.reasoning.prefix = "<think>";
        power_user.reasoning.suffix = "</think>";
        power_user.reasoning.show_hidden = true;
        
        const biasText = "<think>\nHere is my step-by-step analysis:";
        power_user.user_prompt_bias = biasText;
        power_user.show_user_prompt_bias = true;
        
        const $ = (window as any).jQuery;
        $('#start_reply_with').val(biasText);
        
        context.saveSettingsDebounced();
        (window as any).toastr.success("Reasoning Settings Applied");
        logStatus("Done: Reasoning & Bias configured.");
    } catch (err: any) {
        console.error(err);
        logStatus("Error: " + err.message);
    }
}

// --- IMPORT LOGIC ---

async function handlePresetImport(file: File) {
    logStatus(`Reading file: ${file.name}...`);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            const data = JSON.parse(content);
            const fileName = file.name.replace('.json', '');
            
            logStatus("File parsed. Attempting to import...");
            
            // We use the same logic as SillyTavern's PresetManager.performMasterImport
            // But since we can't access the static method easily, we reimplement the checks
            
            // 1. Instruct Template
            if (isPossiblyInstructData(data)) {
                logStatus("Detected Instruct Template.");
                await context.getPresetManager('instruct').savePreset(data.name || fileName, data);
                (window as any).toastr.success("Imported Instruct Preset");
            }
            // 2. Context Template
            else if (isPossiblyContextData(data)) {
                logStatus("Detected Context Template.");
                await context.getPresetManager('context').savePreset(data.name || fileName, data);
                (window as any).toastr.success("Imported Context Preset");
            }
            // 3. Text Completion (Chat/API) settings
            else if (isPossiblyTextCompletionData(data)) {
                logStatus("Detected API Preset.");
                // Fix: Ensure mistralai_model exists to prevent ST core crashes
                if (typeof data.mistralai_model === 'undefined') {
                    data.mistralai_model = "";
                }
                await context.getPresetManager('openai').savePreset(fileName, data);
                (window as any).toastr.success("Imported API Preset");
            }
            // 4. Reasoning Template
            else if (isPossiblyReasoningData(data)) {
                logStatus("Detected Reasoning Template.");
                await context.getPresetManager('reasoning').savePreset(data.name || fileName, data);
                (window as any).toastr.success("Imported Reasoning Preset");
            }
            // 5. Master Import (multiple sections)
            else {
                logStatus("Attempting Master Import...");
                // Since we can't easily replicate the complex master import logic without the class static method,
                // we will try to find the class if exposed, or warn.
                // NOTE: In SillyTavern codebase, PresetManager is not globally exposed.
                // We will implement a basic version that checks for known keys.
                
                let importedCount = 0;
                
                if (data.instruct && isPossiblyInstructData(data.instruct)) {
                    await context.getPresetManager('instruct').savePreset(data.instruct.name, data.instruct);
                    importedCount++;
                }
                if (data.context && isPossiblyContextData(data.context)) {
                    await context.getPresetManager('context').savePreset(data.context.name, data.context);
                    importedCount++;
                }
                if (data.reasoning && isPossiblyReasoningData(data.reasoning)) {
                    await context.getPresetManager('reasoning').savePreset(data.reasoning.name, data.reasoning);
                    importedCount++;
                }
                // 'preset' key usually holds text completion settings in master export
                if (data.preset && isPossiblyTextCompletionData(data.preset)) {
                    await context.getPresetManager('openai').savePreset(data.preset.name || fileName, data.preset);
                    importedCount++;
                }

                if (importedCount > 0) {
                    (window as any).toastr.success(`Imported ${importedCount} sections.`);
                    logStatus(`Master Import: ${importedCount} sections processed.`);
                } else {
                    logStatus("Error: Unknown file format or no valid sections found.");
                    (window as any).toastr.error("Unknown preset format");
                }
            }
            
            context.saveSettingsDebounced();
            
        } catch (err: any) {
            console.error(err);
            logStatus("Import Error: " + err.message);
            (window as any).toastr.error("Failed to import preset");
        }
    };
    reader.readAsText(file);
}

// Helper functions based on SillyTavern's detection logic
function isPossiblyInstructData(data: any) {
    const instructProps = ['input_sequence', 'output_sequence'];
    return data && instructProps.every(prop => Object.keys(data).includes(prop));
}

function isPossiblyContextData(data: any) {
    const contextProps = ['story_string']; // Name might be missing in file
    return data && contextProps.every(prop => Object.keys(data).includes(prop));
}

function isPossiblyTextCompletionData(data: any) {
    if (!data) return false;
    const keys = Object.keys(data);
    
    // Check for 'temp' OR 'temperature'
    const hasTemp = keys.includes('temp') || keys.includes('temperature');
    
    // Check for other key markers (one of these should exist to confirm it's a preset)
    const otherMarkers = ['top_p', 'top_k', 'rep_pen', 'repetition_penalty', 'frequency_penalty', 'openai_model'];
    const hasOtherMarker = otherMarkers.some(marker => keys.includes(marker));
    
    return hasTemp && hasOtherMarker;
}

function isPossiblyReasoningData(data: any) {
    const reasoningProps = ['prefix', 'suffix', 'separator'];
    return data && reasoningProps.every(prop => Object.keys(data).includes(prop));
}

// --- INITIALIZATION ---

(window as any).jQuery(async () => {
    console.log(`${EXTENSION_NAME}: Ready.`);
    
    // Inject immediately if container exists
    injectSettings();
    
    // Also set up a mutation observer because #extensions_settings might be created later
    // or cleared/recreated by SillyTavern
    const observer = new MutationObserver(() => {
        injectSettings();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});
