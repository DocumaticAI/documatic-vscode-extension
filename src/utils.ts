import { exts } from "./sub/exts";

export const getExtensionFromPath = (filePath: string) => filePath.split(".").slice(-1).join();

export const getLangFromExt = (ext: string) => exts[ext] ?? "plaintext";

export function htmlEncode(str: string){
    return String(str).replace(/[^\w. ]/gi, function(c){
        return '&#'+c.charCodeAt(0)+';';
    });
}

export function jsEscape(str: string){
    return String(str).replace(/[^\w. ]/gi, function(c){
        return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
    });
}