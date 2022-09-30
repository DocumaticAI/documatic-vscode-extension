import { exts } from "./sub/exts";

export const getExtensionFromPath = (filePath: string) => filePath.split(".").slice(-1).join();

export const getLangFromExt = (ext: string) => exts[ext] ?? "plaintext";
