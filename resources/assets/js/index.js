const vscode = acquireVsCodeApi();
function openSearchResult(snippetId, filePath) {
    console.log("opening search snippet in editor", snippetId, filePath);

    vscode.postMessage({
        command: 'openSearchResult',
        snippetId,
        filePath
    });
}