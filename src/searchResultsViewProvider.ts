import * as vscode from 'vscode';
import { getNonce, WebviewBase } from './sub/webviewBase';
import hljs from 'highlight.js';


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
    
    protected static readonly _viewType: string = 'Search results on blah blah';
    public static currentPanel?: ResultsOverviewPanel;
	protected readonly _panel: vscode.WebviewPanel;
	protected _scrollPosition = { x: 0, y: 0 };
    public extensionUri: vscode.Uri;

    public static async createOrShow(
        extensionUri: vscode.Uri,
        toTheSide: Boolean = false,
        searchResults: any
    ) {
        // If we already have a panel, show it.
		// Otherwise, create a new panel.

        let activeColumn = toTheSide
        ? vscode.ViewColumn.Beside
        : vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        activeColumn = activeColumn ?? vscode.ViewColumn.One;

		if (ResultsOverviewPanel.currentPanel) {
			ResultsOverviewPanel.currentPanel._panel.reveal(vscode.window.activeTextEditor?.viewColumn, true);
		} else {
			ResultsOverviewPanel.currentPanel = new ResultsOverviewPanel(
				extensionUri,
                activeColumn,
                "Search Results on so and so",
                []
			);
		}

        await ResultsOverviewPanel.currentPanel!.update(searchResults);

    }

    protected constructor(
        private readonly _extensionUri: vscode.Uri,
        column: vscode.ViewColumn,
        title: string,
        searchResults: any
    ) {
        super();

        this.extensionUri = _extensionUri;

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ResultsOverviewPanel._viewType, title, column, {
			// Enable javascript in the webview
			enableScripts: true,
			retainContextWhenHidden: true,

		});

        this._webview = this._panel.webview;
        super.initialize();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

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
		const styleUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'assets', 'css', 'index.css'));
		const codiconsUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
		const hljsCSS = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'highlight.js', 'styles', [1,4].includes(vscode.window.activeColorTheme.kind) ? 'github.css' : 'github-dark.css'));

        const headerHTML = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!-- <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}'; font-src ${this._panel.webview.cspSource}; style-src ${this._panel.webview.cspSource} 'unsafe-inline' http: https: data:;"> -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${this._panel.webview.cspSource}; style-src ${this._panel.webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Search so and so on Documatic</title>

				<link href="${styleUri}" rel="stylesheet" />
				<link href="${codiconsUri}" rel="stylesheet" />
				<link href="${hljsCSS}" rel="stylesheet" />
                
                </head>
                <body class="${process.platform}">
                
                Hello 123<br/><h3>Search so and so on Documatic</h3><hr />`;

                const contentHTML = searchResults.map((i: any) => this.getHTMLcontentForSearchResult(i)).join("<hr />")
        const footerHTML = "</body></html>";
        return headerHTML+contentHTML+footerHTML;
    } 

    protected getHTMLcontentForSearchResult(searchResult: any) {
        
        const lang = normalizeHighlightLang(searchResult.snippet.filePath.split(".").slice(-1).join());
        const highlightedHTML = getHighlightedString(searchResult.code, lang);


        return `
        <div class="panel-outer">
        <div class="panel">
            <div class="panel-header"><h4><a href="${searchResult.codebase.url}"><span class="icon"><i class="codicon codicon-github"></i></span> ${searchResult.codebase.title}</a></h4> <a href="${codebasePathUrl(searchResult.codebase, searchResult.snippet, searchResult.version)}">${searchResult.snippet.filePath}</a></div>
            <div class="panel-body">
                <blockquote>${searchResult.snippet.summary}</blockquote>
                <div>${highlightedHTML}</div>
            </div>
        </div>
        </div>
        ` ;
    }
}


export function CodebaseLink(codebase: {type: string, url: string, title: string} ) {
    return `<a href="${codebase.url}" target="_blank" className="codebasePathLink">
        <span class="icon"><i class="codicon codicon-${codebase.type.toLowerCase()}"/></span>
        ${codebase.title}
    </a>`;
}


export function codebasePathUrl(codebase: {type: string, url: string}, func: {filePath: string, startLine: number, endLine: number}, version: {version: string}) {
    switch (codebase.type) {
        case "GITHUB":
            return `${codebase.url}/blob/${version.version}/${func.filePath}#L${func.startLine}-L${func.endLine}`;
        case "BITBUCKET":
            return `${codebase.url}/src/${version.version}/${func.filePath}#lines-${func.startLine}`;
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
            return `<div>${hljs.highlight(code.replace(/[^\s]\n[^\s]/g, '\n\n'), {language: lang, ignoreIllegals: true}).value}</div>`;
        } catch (error) {}
    }
    return `<pre>${hljs.highlightAuto(code).value}</pre>`
}