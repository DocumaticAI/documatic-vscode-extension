import path = require("path");
import * as vscode from "vscode";
import { globalContext } from "./extension";

export let objectSummaries : {[key: string]: {[key: string]: {[key: string]: string}}} = {};
export let foldersFromDocumatic: vscode.WorkspaceFolder[] = [];

export class DocumaticHoverProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const projectFolderPath = Object.keys(objectSummaries).find(folderPath => document.fileName.startsWith(folderPath));
        if (!projectFolderPath) {return {contents: []};}
        const fileName = document.fileName.slice(document.fileName.indexOf(projectFolderPath)+projectFolderPath.length);
        
        return {
            contents: ['Hover content']
        };
    }
};