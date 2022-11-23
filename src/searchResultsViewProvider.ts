import * as vscode from 'vscode';
import { getNonce, WebviewBase } from './sub/webviewBase';
import hljs from 'highlight.js';
import { openSnippetInEditor } from './common';
import { zeroResultsMsg } from './extension';
import { htmlEncode, jsEscape } from './utils';


export class SearchResultsViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
        webviewView.description = "The search term has been processed by the Documatic platform and the results are displayed within VSCode";
        webviewView.title = "Documatic: Search Results";
        webviewView.webview.html = "Hello";
        webviewView.show(true);
    }

}


export class ResultsOverviewPanel extends WebviewBase {
    public static ID: string = "documatic.searchResults";
    
    protected readonly _viewType: string = 'Search results for blah blah';
    public currentPanel?: ResultsOverviewPanel;
	protected _panel: vscode.WebviewPanel;
	protected _scrollPosition = { x: 0, y: 0 };
    public extensionUri: vscode.Uri;
    public searchTerm: string;
    public title: string;
    public column: vscode.ViewColumn;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        column: vscode.ViewColumn,
        title: string,
        searchResults: any
    ) {
        super();

        this.extensionUri = _extensionUri;
        this.column = column;
        this.searchTerm = title;
        this.title = `Search Results for "${title}"`;

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(this._viewType, this.title, this.column, {
			// Enable javascript in the webview
			enableScripts: true,
			retainContextWhenHidden: true,

		});

        this._webview = this._panel.webview;
        super.initialize();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openSearchResult':
                        openSnippetInEditor(message.snippetId, message.filePath);
                        return;
                }
            },
        );

        
		if (this.currentPanel) {
			this.currentPanel._panel.reveal(vscode.window.activeTextEditor?.viewColumn, true);
		} else {
			this.currentPanel = this;
		}

        this.searchTerm = this.searchTerm;
        this.currentPanel!.update(searchResults);


    }

	public async update(searchResults: any): Promise<void> {
		this._postMessage({
			command: 'set-scroll',
			scrollPosition: this._scrollPosition,
		});

		this._panel.webview.html = this.getHtmlForWebview(searchResults);
        return;
	}

    protected getHtmlForWebview(searchResults: any) {
        const nonce = getNonce();
        	// Get resource paths
		const styleUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets', 'css', 'index.css'));
		const scriptsUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets', 'js', 'index.js'));
		const codiconsUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets', 'css', 'codicon.css'));
		const hljsCSS = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'assets', 'css', [1,4].includes(vscode.window.activeColorTheme.kind) ? 'github.css' : 'github-dark.css'));

        // <!-- <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}'; font-src ${this._panel.webview.cspSource}; style-src ${this._panel.webview.cspSource} 'unsafe-inline' http: https: data:;"> -->
        // <meta http-equiv="Content-Security-Policy" content="default-src usnafe-inline; script-src 'nonce-${nonce}'; font-src ${this._panel.webview.cspSource}; style-src ${this._panel.webview.cspSource};">
        const headerHTML = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Search "${htmlEncode(this.searchTerm)}" on Documatic</title>

				<link href="${styleUri}" rel="stylesheet" />
				<link href="${codiconsUri}" rel="stylesheet" />
				<link href="${hljsCSS}" rel="stylesheet" />
				<script src="${scriptsUri.toString()}" nonce="${nonce}" ></script>

                </head>
                <body class="${jsEscape(process.platform)}">
                
                <br/><h3>Search "${htmlEncode(this.searchTerm)}" on Documatic</h3><hr />`;

                const contentHTML = searchResults.length > 0 ? searchResults.map((i: any) => this.getHTMLcontentForSearchResult(i)).join("<hr />") : `<blockquote>${zeroResultsMsg.replaceAll(". ", ".<br />")}</blockquote>`;
        const footerHTML = "</body></html>";
        return headerHTML+contentHTML+footerHTML;
    } 

    protected getHTMLcontentForSearchResult(searchResult: any) {
        
        const lang = jsEscape(normalizeHighlightLang(searchResult.snippet.filePath.split(".").slice(-1).join()));
        const highlightedHTML = getHighlightedString(searchResult.code, lang);


        return `
        <div class="panel-outer">
        <div class="panel">
            <div class="panel-header"><h4><a href="${jsEscape(searchResult.codebase.url)}"><span class="icon"><i class="codicon codicon-github"></i></span> ${htmlEncode(searchResult.codebase.title)}</a></h4> <a href="${jsEscape(codebasePathUrl(searchResult.codebase, searchResult.snippet, searchResult.version))}">${htmlEncode(searchResult.snippet.filePath)}</a>
            <button onclick="openSearchResult(${Number(jsEscape(searchResult.snippet.snippetId))}, '${jsEscape(searchResult.snippet.filePath).toString().replace('"','\"').replace("'","\'")}')" class="viewSnippetBtn">View</button>
            </div>
            <div class="panel-body">
                <blockquote>${searchResult.snippet.summary.length > 5 ? htmlEncode(searchResult.snippet.summary) : "No summary on this object yet."}</blockquote>
                <div class="highlightedCode">${highlightedHTML}</div>
            </div>
        </div>
        </div>
        ` ;
    }
}



export function codebasePathUrl(codebase: {type: string, url: string}, func: {filePath: string, startLine: number, endLine: number}, version: {version: string}) {
    switch (codebase.type) {
        case "GITHUB":
            return `${jsEscape(codebase.url)}/blob/${jsEscape(version.version)}/${jsEscape(func.filePath)}#L${func.startLine}-L${func.endLine}`;
        case "BITBUCKET":
            return `${jsEscape(codebase.url)}/src/${jsEscape(version.version)}/${jsEscape(func.filePath)}#lines-${func.startLine}`;
        default:
            return "#";
    }
}


function normalizeHighlightLang(lang: string) {
	switch (lang && lang.toLowerCase()) {
		case 'tsx':
		case 'typescriptreact':
			// Workaround for highlight not supporting tsx: https://github.com/isagalaev/highlight.js/issues/1155
			return 'jsx';

		case 'json5':
		case 'jsonc':
			return 'json';

		case 'c#':
		case 'csharp':
			return 'cs';

		default:
			return lang;
	}
}

function getHighlightedString(code: string, lang: string) {

    if (lang && hljs.getLanguage(lang)) {
        try {
            return `<pre><code>${hljs.highlight(code.replace(/[^\s]\n[^\s]/g, '\n\n'), {language: lang, ignoreIllegals: true}).value}</code></pre>`;
        } catch (error) {}
    }
    return `<pre><code>${hljs.highlightAuto(code).value}</code></pre>`;
}