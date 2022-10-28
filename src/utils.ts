import { exts } from "./sub/exts";

export const getExtensionFromPath = (filePath: string) => filePath.split(".").slice(-1).join();

export const getLangFromExt = (ext: string) => exts[ext] ?? "plaintext";

export const encodeText = (text: string) => text.split ? text.split(" ").map(t => encodeURI(t)).join(" "): "Split not a function";