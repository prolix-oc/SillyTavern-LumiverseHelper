/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/css-loader/dist/cjs.js!./src/style.css"
/*!*************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/style.css ***!
  \*************************************************************/
(module, __webpack_exports__, __webpack_require__) {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/noSourceMaps.js */ \"./node_modules/css-loader/dist/runtime/noSourceMaps.js\");\n/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/api.js */ \"./node_modules/css-loader/dist/runtime/api.js\");\n/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);\n// Imports\n\n\nvar ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));\n// Module\n___CSS_LOADER_EXPORT___.push([module.id, `.webpack_settings_container {\n    padding: 10px;\n    background: rgba(0,0,0,0.1);\n    border-radius: 5px;\n}\n`, \"\"]);\n// Exports\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);\n\n\n//# sourceURL=webpack://webpack-extension-template/./src/style.css?./node_modules/css-loader/dist/cjs.js\n}");

/***/ },

/***/ "./node_modules/css-loader/dist/runtime/api.js"
/*!*****************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/api.js ***!
  \*****************************************************/
(module) {

eval("{\n\n/*\n  MIT License http://www.opensource.org/licenses/mit-license.php\n  Author Tobias Koppers @sokra\n*/\nmodule.exports = function (cssWithMappingToString) {\n  var list = [];\n\n  // return the list of modules as css string\n  list.toString = function toString() {\n    return this.map(function (item) {\n      var content = \"\";\n      var needLayer = typeof item[5] !== \"undefined\";\n      if (item[4]) {\n        content += \"@supports (\".concat(item[4], \") {\");\n      }\n      if (item[2]) {\n        content += \"@media \".concat(item[2], \" {\");\n      }\n      if (needLayer) {\n        content += \"@layer\".concat(item[5].length > 0 ? \" \".concat(item[5]) : \"\", \" {\");\n      }\n      content += cssWithMappingToString(item);\n      if (needLayer) {\n        content += \"}\";\n      }\n      if (item[2]) {\n        content += \"}\";\n      }\n      if (item[4]) {\n        content += \"}\";\n      }\n      return content;\n    }).join(\"\");\n  };\n\n  // import a list of modules into the list\n  list.i = function i(modules, media, dedupe, supports, layer) {\n    if (typeof modules === \"string\") {\n      modules = [[null, modules, undefined]];\n    }\n    var alreadyImportedModules = {};\n    if (dedupe) {\n      for (var k = 0; k < this.length; k++) {\n        var id = this[k][0];\n        if (id != null) {\n          alreadyImportedModules[id] = true;\n        }\n      }\n    }\n    for (var _k = 0; _k < modules.length; _k++) {\n      var item = [].concat(modules[_k]);\n      if (dedupe && alreadyImportedModules[item[0]]) {\n        continue;\n      }\n      if (typeof layer !== \"undefined\") {\n        if (typeof item[5] === \"undefined\") {\n          item[5] = layer;\n        } else {\n          item[1] = \"@layer\".concat(item[5].length > 0 ? \" \".concat(item[5]) : \"\", \" {\").concat(item[1], \"}\");\n          item[5] = layer;\n        }\n      }\n      if (media) {\n        if (!item[2]) {\n          item[2] = media;\n        } else {\n          item[1] = \"@media \".concat(item[2], \" {\").concat(item[1], \"}\");\n          item[2] = media;\n        }\n      }\n      if (supports) {\n        if (!item[4]) {\n          item[4] = \"\".concat(supports);\n        } else {\n          item[1] = \"@supports (\".concat(item[4], \") {\").concat(item[1], \"}\");\n          item[4] = supports;\n        }\n      }\n      list.push(item);\n    }\n  };\n  return list;\n};\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/css-loader/dist/runtime/api.js?\n}");

/***/ },

/***/ "./node_modules/css-loader/dist/runtime/noSourceMaps.js"
/*!**************************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/noSourceMaps.js ***!
  \**************************************************************/
(module) {

eval("{\n\nmodule.exports = function (i) {\n  return i[1];\n};\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/css-loader/dist/runtime/noSourceMaps.js?\n}");

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js"
/*!****************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \****************************************************************************/
(module) {

eval("{\n\nvar stylesInDOM = [];\nfunction getIndexByIdentifier(identifier) {\n  var result = -1;\n  for (var i = 0; i < stylesInDOM.length; i++) {\n    if (stylesInDOM[i].identifier === identifier) {\n      result = i;\n      break;\n    }\n  }\n  return result;\n}\nfunction modulesToDom(list, options) {\n  var idCountMap = {};\n  var identifiers = [];\n  for (var i = 0; i < list.length; i++) {\n    var item = list[i];\n    var id = options.base ? item[0] + options.base : item[0];\n    var count = idCountMap[id] || 0;\n    var identifier = \"\".concat(id, \" \").concat(count);\n    idCountMap[id] = count + 1;\n    var indexByIdentifier = getIndexByIdentifier(identifier);\n    var obj = {\n      css: item[1],\n      media: item[2],\n      sourceMap: item[3],\n      supports: item[4],\n      layer: item[5]\n    };\n    if (indexByIdentifier !== -1) {\n      stylesInDOM[indexByIdentifier].references++;\n      stylesInDOM[indexByIdentifier].updater(obj);\n    } else {\n      var updater = addElementStyle(obj, options);\n      options.byIndex = i;\n      stylesInDOM.splice(i, 0, {\n        identifier: identifier,\n        updater: updater,\n        references: 1\n      });\n    }\n    identifiers.push(identifier);\n  }\n  return identifiers;\n}\nfunction addElementStyle(obj, options) {\n  var api = options.domAPI(options);\n  api.update(obj);\n  var updater = function updater(newObj) {\n    if (newObj) {\n      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap && newObj.supports === obj.supports && newObj.layer === obj.layer) {\n        return;\n      }\n      api.update(obj = newObj);\n    } else {\n      api.remove();\n    }\n  };\n  return updater;\n}\nmodule.exports = function (list, options) {\n  options = options || {};\n  list = list || [];\n  var lastIdentifiers = modulesToDom(list, options);\n  return function update(newList) {\n    newList = newList || [];\n    for (var i = 0; i < lastIdentifiers.length; i++) {\n      var identifier = lastIdentifiers[i];\n      var index = getIndexByIdentifier(identifier);\n      stylesInDOM[index].references--;\n    }\n    var newLastIdentifiers = modulesToDom(newList, options);\n    for (var _i = 0; _i < lastIdentifiers.length; _i++) {\n      var _identifier = lastIdentifiers[_i];\n      var _index = getIndexByIdentifier(_identifier);\n      if (stylesInDOM[_index].references === 0) {\n        stylesInDOM[_index].updater();\n        stylesInDOM.splice(_index, 1);\n      }\n    }\n    lastIdentifiers = newLastIdentifiers;\n  };\n};\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js?\n}");

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/insertBySelector.js"
/*!********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertBySelector.js ***!
  \********************************************************************/
(module) {

eval("{\n\nvar memo = {};\n\n/* istanbul ignore next  */\nfunction getTarget(target) {\n  if (typeof memo[target] === \"undefined\") {\n    var styleTarget = document.querySelector(target);\n\n    // Special case to return head of iframe instead of iframe itself\n    if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {\n      try {\n        // This will throw an exception if access to iframe is blocked\n        // due to cross-origin restrictions\n        styleTarget = styleTarget.contentDocument.head;\n      } catch (e) {\n        // istanbul ignore next\n        styleTarget = null;\n      }\n    }\n    memo[target] = styleTarget;\n  }\n  return memo[target];\n}\n\n/* istanbul ignore next  */\nfunction insertBySelector(insert, style) {\n  var target = getTarget(insert);\n  if (!target) {\n    throw new Error(\"Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.\");\n  }\n  target.appendChild(style);\n}\nmodule.exports = insertBySelector;\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/style-loader/dist/runtime/insertBySelector.js?\n}");

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/insertStyleElement.js"
/*!**********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertStyleElement.js ***!
  \**********************************************************************/
(module) {

eval("{\n\n/* istanbul ignore next  */\nfunction insertStyleElement(options) {\n  var element = document.createElement(\"style\");\n  options.setAttributes(element, options.attributes);\n  options.insert(element, options.options);\n  return element;\n}\nmodule.exports = insertStyleElement;\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/style-loader/dist/runtime/insertStyleElement.js?\n}");

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js"
/*!**********************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js ***!
  \**********************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {

eval("{\n\n/* istanbul ignore next  */\nfunction setAttributesWithoutAttributes(styleElement) {\n  var nonce =  true ? __webpack_require__.nc : 0;\n  if (nonce) {\n    styleElement.setAttribute(\"nonce\", nonce);\n  }\n}\nmodule.exports = setAttributesWithoutAttributes;\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js?\n}");

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/styleDomAPI.js"
/*!***************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleDomAPI.js ***!
  \***************************************************************/
(module) {

eval("{\n\n/* istanbul ignore next  */\nfunction apply(styleElement, options, obj) {\n  var css = \"\";\n  if (obj.supports) {\n    css += \"@supports (\".concat(obj.supports, \") {\");\n  }\n  if (obj.media) {\n    css += \"@media \".concat(obj.media, \" {\");\n  }\n  var needLayer = typeof obj.layer !== \"undefined\";\n  if (needLayer) {\n    css += \"@layer\".concat(obj.layer.length > 0 ? \" \".concat(obj.layer) : \"\", \" {\");\n  }\n  css += obj.css;\n  if (needLayer) {\n    css += \"}\";\n  }\n  if (obj.media) {\n    css += \"}\";\n  }\n  if (obj.supports) {\n    css += \"}\";\n  }\n  var sourceMap = obj.sourceMap;\n  if (sourceMap && typeof btoa !== \"undefined\") {\n    css += \"\\n/*# sourceMappingURL=data:application/json;base64,\".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), \" */\");\n  }\n\n  // For old IE\n  /* istanbul ignore if  */\n  options.styleTagTransform(css, styleElement, options.options);\n}\nfunction removeStyleElement(styleElement) {\n  // istanbul ignore if\n  if (styleElement.parentNode === null) {\n    return false;\n  }\n  styleElement.parentNode.removeChild(styleElement);\n}\n\n/* istanbul ignore next  */\nfunction domAPI(options) {\n  if (typeof document === \"undefined\") {\n    return {\n      update: function update() {},\n      remove: function remove() {}\n    };\n  }\n  var styleElement = options.insertStyleElement(options);\n  return {\n    update: function update(obj) {\n      apply(styleElement, options, obj);\n    },\n    remove: function remove() {\n      removeStyleElement(styleElement);\n    }\n  };\n}\nmodule.exports = domAPI;\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/style-loader/dist/runtime/styleDomAPI.js?\n}");

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/styleTagTransform.js"
/*!*********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleTagTransform.js ***!
  \*********************************************************************/
(module) {

eval("{\n\n/* istanbul ignore next  */\nfunction styleTagTransform(css, styleElement) {\n  if (styleElement.styleSheet) {\n    styleElement.styleSheet.cssText = css;\n  } else {\n    while (styleElement.firstChild) {\n      styleElement.removeChild(styleElement.firstChild);\n    }\n    styleElement.appendChild(document.createTextNode(css));\n  }\n}\nmodule.exports = styleTagTransform;\n\n//# sourceURL=webpack://webpack-extension-template/./node_modules/style-loader/dist/runtime/styleTagTransform.js?\n}");

/***/ },

/***/ "./src/index.ts"
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _style_css__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./style.css */ \"./src/style.css\");\n/* harmony import */ var _settings_html__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./settings.html */ \"./src/settings.html\");\n// src/index.ts\n\n\n// Explicitly declare SillyTavern global access\nconst context = window.SillyTavern.getContext();\nconst EXTENSION_NAME = \"WebpackSettingsManager\";\nconsole.log(`${EXTENSION_NAME}: Loading...`);\n// --- UI INJECTION LOGIC ---\nfunction injectSettings() {\n    // 1. Find the extensions settings container\n    const settingsContainer = document.getElementById('extensions_settings');\n    if (!settingsContainer) {\n        console.warn(`${EXTENSION_NAME}: Settings container not found.`);\n        return;\n    }\n    // 2. Check if we already injected\n    if (document.getElementById('webpack_settings_manager_panel')) {\n        return;\n    }\n    // 3. Create a wrapper\n    const wrapper = document.createElement('div');\n    wrapper.id = 'webpack_settings_manager_panel';\n    wrapper.innerHTML = _settings_html__WEBPACK_IMPORTED_MODULE_1__[\"default\"];\n    // 4. Append to container\n    settingsContainer.appendChild(wrapper);\n    console.log(`${EXTENSION_NAME}: Settings injected.`);\n    // 5. Bind Events immediately after injection\n    bindEvents(wrapper);\n}\nfunction bindEvents(container) {\n    const $ = window.jQuery;\n    $(container).find('#btn_apply_chat').on('click', () => {\n        const presetName = $('#demo_chat_preset_name').val();\n        applyChatSettings(presetName);\n    });\n    $(container).find('#btn_apply_instruct').on('click', () => {\n        applyInstructSettings();\n    });\n    $(container).find('#btn_apply_reasoning').on('click', () => {\n        applyReasoningSettings();\n    });\n    $(container).find('#demo_import_file').on('change', (e) => {\n        const input = e.target;\n        if (input.files && input.files.length > 0) {\n            handlePresetImport(input.files[0]);\n            input.value = ''; // Reset input\n        }\n    });\n}\n// --- CORE LOGIC (Ported from Simple Example) ---\nfunction logStatus(msg) {\n    const $ = window.jQuery;\n    const $log = $('#demo_status_log');\n    const timestamp = new Date().toLocaleTimeString();\n    if ($log.length) {\n        $log.val($log.val() + `[${timestamp}] ${msg}\\n`);\n        $log.scrollTop($log[0].scrollHeight);\n    }\n    console.log(`[${EXTENSION_NAME}] ${msg}`);\n}\nasync function applyChatSettings(presetName) {\n    logStatus(\"Creating Chat Completion preset...\");\n    const manager = context.getPresetManager('openai');\n    const name = presetName || \"Example API Preset\";\n    const data = {\n        \"temp_openai\": 1.2,\n        \"top_p_openai\": 0.9,\n        \"openai_model\": \"gpt-4-turbo\",\n        \"context_window\": 32000,\n        \"freq_pen_openai\": 0.1,\n        \"pres_pen_openai\": 0.1,\n        \"mistralai_model\": \"\" // Added to prevent potential undefined error in ST core\n    };\n    try {\n        await manager.savePreset(name, data);\n        await manager.selectPreset(name);\n        context.saveSettingsDebounced();\n        window.toastr.success(\"Chat Preset Applied Successfully\");\n        logStatus(\"Done: Chat Preset Applied.\");\n    }\n    catch (err) {\n        console.error(err);\n        logStatus(\"Error: \" + err.message);\n        window.toastr.error(\"Failed to apply Chat Preset\");\n    }\n}\nasync function applyInstructSettings() {\n    logStatus(\"Creating Instruct Mode preset...\");\n    const manager = context.getPresetManager('instruct');\n    const name = \"Example Instruct Preset\";\n    const data = {\n        \"user_alignment_message\": \"\\nUser: \",\n        \"output_sequence\": \"\\nAssistant: \",\n        \"system_sequence\": \"\\nSystem: \",\n        \"names_behavior\": \"force\",\n        \"wrap\": true,\n        \"macro\": true\n    };\n    try {\n        await manager.savePreset(name, data);\n        await manager.selectPreset(name);\n        // Access global objects properly in TS\n        context.powerUserSettings.instruct.enabled = true;\n        context.saveSettingsDebounced();\n        window.toastr.success(\"Instruct Preset Applied\");\n        logStatus(\"Done: Instruct Mode Enabled.\");\n    }\n    catch (err) {\n        console.error(err);\n        logStatus(\"Error: \" + err.message);\n    }\n}\nfunction applyReasoningSettings() {\n    logStatus(\"Configuring Reasoning & Bias...\");\n    try {\n        const power_user = context.powerUserSettings;\n        power_user.reasoning.auto_parse = true;\n        power_user.reasoning.prefix = \"<think>\";\n        power_user.reasoning.suffix = \"</think>\";\n        power_user.reasoning.show_hidden = true;\n        const biasText = \"<think>\\nHere is my step-by-step analysis:\";\n        power_user.user_prompt_bias = biasText;\n        power_user.show_user_prompt_bias = true;\n        const $ = window.jQuery;\n        $('#start_reply_with').val(biasText);\n        context.saveSettingsDebounced();\n        window.toastr.success(\"Reasoning Settings Applied\");\n        logStatus(\"Done: Reasoning & Bias configured.\");\n    }\n    catch (err) {\n        console.error(err);\n        logStatus(\"Error: \" + err.message);\n    }\n}\n// --- IMPORT LOGIC ---\nasync function handlePresetImport(file) {\n    logStatus(`Reading file: ${file.name}...`);\n    const reader = new FileReader();\n    reader.onload = async (e) => {\n        try {\n            const content = e.target?.result;\n            const data = JSON.parse(content);\n            const fileName = file.name.replace('.json', '');\n            logStatus(\"File parsed. Attempting to import...\");\n            // We use the same logic as SillyTavern's PresetManager.performMasterImport\n            // But since we can't access the static method easily, we reimplement the checks\n            // 1. Instruct Template\n            if (isPossiblyInstructData(data)) {\n                logStatus(\"Detected Instruct Template.\");\n                await context.getPresetManager('instruct').savePreset(data.name || fileName, data);\n                window.toastr.success(\"Imported Instruct Preset\");\n            }\n            // 2. Context Template\n            else if (isPossiblyContextData(data)) {\n                logStatus(\"Detected Context Template.\");\n                await context.getPresetManager('context').savePreset(data.name || fileName, data);\n                window.toastr.success(\"Imported Context Preset\");\n            }\n            // 3. Text Completion (Chat/API) settings\n            else if (isPossiblyTextCompletionData(data)) {\n                logStatus(\"Detected API Preset.\");\n                // Fix: Ensure mistralai_model exists to prevent ST core crashes\n                if (typeof data.mistralai_model === 'undefined') {\n                    data.mistralai_model = \"\";\n                }\n                await context.getPresetManager('openai').savePreset(fileName, data);\n                window.toastr.success(\"Imported API Preset\");\n            }\n            // 4. Reasoning Template\n            else if (isPossiblyReasoningData(data)) {\n                logStatus(\"Detected Reasoning Template.\");\n                await context.getPresetManager('reasoning').savePreset(data.name || fileName, data);\n                window.toastr.success(\"Imported Reasoning Preset\");\n            }\n            // 5. Master Import (multiple sections)\n            else {\n                logStatus(\"Attempting Master Import...\");\n                // Since we can't easily replicate the complex master import logic without the class static method,\n                // we will try to find the class if exposed, or warn.\n                // NOTE: In SillyTavern codebase, PresetManager is not globally exposed.\n                // We will implement a basic version that checks for known keys.\n                let importedCount = 0;\n                if (data.instruct && isPossiblyInstructData(data.instruct)) {\n                    await context.getPresetManager('instruct').savePreset(data.instruct.name, data.instruct);\n                    importedCount++;\n                }\n                if (data.context && isPossiblyContextData(data.context)) {\n                    await context.getPresetManager('context').savePreset(data.context.name, data.context);\n                    importedCount++;\n                }\n                if (data.reasoning && isPossiblyReasoningData(data.reasoning)) {\n                    await context.getPresetManager('reasoning').savePreset(data.reasoning.name, data.reasoning);\n                    importedCount++;\n                }\n                // 'preset' key usually holds text completion settings in master export\n                if (data.preset && isPossiblyTextCompletionData(data.preset)) {\n                    await context.getPresetManager('openai').savePreset(data.preset.name || fileName, data.preset);\n                    importedCount++;\n                }\n                if (importedCount > 0) {\n                    window.toastr.success(`Imported ${importedCount} sections.`);\n                    logStatus(`Master Import: ${importedCount} sections processed.`);\n                }\n                else {\n                    logStatus(\"Error: Unknown file format or no valid sections found.\");\n                    window.toastr.error(\"Unknown preset format\");\n                }\n            }\n            context.saveSettingsDebounced();\n        }\n        catch (err) {\n            console.error(err);\n            logStatus(\"Import Error: \" + err.message);\n            window.toastr.error(\"Failed to import preset\");\n        }\n    };\n    reader.readAsText(file);\n}\n// Helper functions based on SillyTavern's detection logic\nfunction isPossiblyInstructData(data) {\n    const instructProps = ['input_sequence', 'output_sequence'];\n    return data && instructProps.every(prop => Object.keys(data).includes(prop));\n}\nfunction isPossiblyContextData(data) {\n    const contextProps = ['story_string']; // Name might be missing in file\n    return data && contextProps.every(prop => Object.keys(data).includes(prop));\n}\nfunction isPossiblyTextCompletionData(data) {\n    if (!data)\n        return false;\n    const keys = Object.keys(data);\n    // Check for 'temp' OR 'temperature'\n    const hasTemp = keys.includes('temp') || keys.includes('temperature');\n    // Check for other key markers (one of these should exist to confirm it's a preset)\n    const otherMarkers = ['top_p', 'top_k', 'rep_pen', 'repetition_penalty', 'frequency_penalty', 'openai_model'];\n    const hasOtherMarker = otherMarkers.some(marker => keys.includes(marker));\n    return hasTemp && hasOtherMarker;\n}\nfunction isPossiblyReasoningData(data) {\n    const reasoningProps = ['prefix', 'suffix', 'separator'];\n    return data && reasoningProps.every(prop => Object.keys(data).includes(prop));\n}\n// --- INITIALIZATION ---\nwindow.jQuery(async () => {\n    console.log(`${EXTENSION_NAME}: Ready.`);\n    // Inject immediately if container exists\n    injectSettings();\n    // Also set up a mutation observer because #extensions_settings might be created later\n    // or cleared/recreated by SillyTavern\n    const observer = new MutationObserver(() => {\n        injectSettings();\n    });\n    observer.observe(document.body, { childList: true, subtree: true });\n});\n\n\n//# sourceURL=webpack://webpack-extension-template/./src/index.ts?\n}");

/***/ },

/***/ "./src/settings.html"
/*!***************************!*\
  !*** ./src/settings.html ***!
  \***************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n// Module\nvar code = `<div class=\"settings_manager_container\">\n    <h3>Webpack Settings Manager Demo</h3>\n    <p>This panel is injected via Webpack bundle.</p>\n    \n    <div class=\"settings_section\">\n        <label for=\"demo_chat_preset_name\">Chat Preset Name:</label>\n        <input type=\"text\" id=\"demo_chat_preset_name\" value=\"Demo API Preset\" class=\"text_pole\" style=\"width: 100%; margin-bottom: 10px;\">\n        \n        <div class=\"setting_item\">\n            <button id=\"btn_apply_chat\" class=\"menu_button\">Apply Custom Chat Preset</button>\n            <small>Applies Temperature 1.2, Top P 0.9, GPT-4</small>\n        </div>\n    </div>\n\n    <hr>\n\n    <div class=\"settings_section\">\n        <h4>JSON Preset Import</h4>\n        <div class=\"setting_item\">\n            <label for=\"demo_import_file\" class=\"menu_button\">Select JSON File to Import</label>\n            <input type=\"file\" id=\"demo_import_file\" accept=\".json\" style=\"display: none;\">\n            <small>Supports Master Import format (Context, Instruct, System, API)</small>\n        </div>\n    </div>\n\n    <hr>\n\n    <div class=\"settings_section\">\n        <div class=\"setting_item\">\n            <button id=\"btn_apply_instruct\" class=\"menu_button\">Apply Instruct Mode</button>\n            <small>Configures User/Assistant/System prefixes & enables Instruct Mode</small>\n        </div>\n    </div>\n\n    <hr>\n\n    <div class=\"settings_section\">\n        <div class=\"setting_item\">\n            <button id=\"btn_apply_reasoning\" class=\"menu_button\">Apply Reasoning (CoT)</button>\n            <small>Configures &lt;think&gt; block parsing and sets \"Start Reply With\"</small>\n        </div>\n    </div>\n\n    <hr>\n\n    <div class=\"settings_section\">\n        <h4>Status Log</h4>\n        <textarea id=\"demo_status_log\" readonly class=\"text_pole\" rows=\"5\" style=\"width: 100%;\"></textarea>\n    </div>\n</div>\n`;\n// Exports\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (code);\n\n//# sourceURL=webpack://webpack-extension-template/./src/settings.html?\n}");

/***/ },

/***/ "./src/style.css"
/*!***********************!*\
  !*** ./src/style.css ***!
  \***********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ \"./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js\");\n/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleDomAPI.js */ \"./node_modules/style-loader/dist/runtime/styleDomAPI.js\");\n/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertBySelector.js */ \"./node_modules/style-loader/dist/runtime/insertBySelector.js\");\n/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js */ \"./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js\");\n/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertStyleElement.js */ \"./node_modules/style-loader/dist/runtime/insertStyleElement.js\");\n/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleTagTransform.js */ \"./node_modules/style-loader/dist/runtime/styleTagTransform.js\");\n/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);\n/* harmony import */ var _node_modules_css_loader_dist_cjs_js_style_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../node_modules/css-loader/dist/cjs.js!./style.css */ \"./node_modules/css-loader/dist/cjs.js!./src/style.css\");\n\n      \n      \n      \n      \n      \n      \n      \n      \n      \n\nvar options = {};\n\noptions.styleTagTransform = (_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());\noptions.setAttributes = (_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());\noptions.insert = _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, \"head\");\noptions.domAPI = (_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());\noptions.insertStyleElement = (_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());\n\nvar update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_node_modules_css_loader_dist_cjs_js_style_css__WEBPACK_IMPORTED_MODULE_6__[\"default\"], options);\n\n\n\n\n       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_node_modules_css_loader_dist_cjs_js_style_css__WEBPACK_IMPORTED_MODULE_6__[\"default\"] && _node_modules_css_loader_dist_cjs_js_style_css__WEBPACK_IMPORTED_MODULE_6__[\"default\"].locals ? _node_modules_css_loader_dist_cjs_js_style_css__WEBPACK_IMPORTED_MODULE_6__[\"default\"].locals : undefined);\n\n\n//# sourceURL=webpack://webpack-extension-template/./src/style.css?\n}");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/nonce */
/******/ 	(() => {
/******/ 		__webpack_require__.nc = undefined;
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.ts");
/******/ 	
/******/ })()
;