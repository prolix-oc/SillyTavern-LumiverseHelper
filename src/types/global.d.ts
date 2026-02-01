import 'jquery';
import 'toastr';

declare global {
    interface Window {
        LumiverseUI: any;
        LumiverseBridge: any;
        lumiverseAppReady: boolean;
        oai_settings: any;
        debugLumiverseData: () => void;
        debugLumiversePackCache: () => void;
        lumiverseHelperGenInterceptor: (chat: any[], contextSize: number, abort: boolean, type: string) => Promise<{ chat: any[], contextSize: number, abort: boolean }>;
    }

    const toastr: Toastr;
    const jQuery: JQueryStatic;
    const $: JQueryStatic;
}
