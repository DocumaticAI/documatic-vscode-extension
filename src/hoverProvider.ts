import * as vscode from "vscode";

export let objectSummaries : {[key: string]: {[key: string]: {title: string, summary: string, startLine: number, endLine: number, startColumn: number, endColumn: number, ownerName: string, ownerEmail: string}[]}} = {};
export let foldersFromDocumatic: vscode.WorkspaceFolder[] = [];

export class DocumaticHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const projectFolderPath = Object.keys(objectSummaries).find(folderPath => document.fileName.startsWith(folderPath));
        if (!projectFolderPath) {return {contents: []};}
        let fileName = document.fileName.slice(document.fileName.indexOf(projectFolderPath)+projectFolderPath.length);
        if (fileName.startsWith("/")) {fileName = fileName.slice(1);}
        const summaryItem = objectSummaries[projectFolderPath][fileName].find(i => i.startLine < position.line + 2 && i.startLine > position.line - 2 && document.lineAt(position.line).text.includes((i.title.split(".").slice(-1).join())));
        // const summaryItem = objectSummaries[projectFolderPath][fileName].find(i => position.isAfterOrEqual(new vscode.Position(i.startLine, i.startColumn)));
        if (summaryItem) {
            return {
                contents: [
                    `### From Documatic  `,
                    `**Title**: ${summaryItem.title}  `,
                    summaryItem.ownerName && summaryItem.ownerEmail ? `Owner: ${summaryItem.ownerName}<${summaryItem.ownerEmail}>`: "",
                    `**Summary**: ${summaryItem.summary}  `
                    ]
            };
        }
        return {
            contents: []
        };
    }
};