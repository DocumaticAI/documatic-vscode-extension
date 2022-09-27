import * as vscode from 'vscode';
import { getNonce, WebviewBase } from './sub/webviewBase';

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

        const headerHTML = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}'; style-src vscode-resource: 'unsafe-inline' http: https: data:;">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Search so and so on Documatic</title>

				<link href="${styleUri}" rel="stylesheet" />
				<link href="${codiconsUri}" rel="stylesheet" />
            </head>
            <body class="${process.platform}">
            <div class="icon"><i class="codicon codicon-account"></i> account</div>
            <div class="icon"><i class="codicon codicon-activate-breakpoints"></i> activate-breakpoints</div>
            <div class="icon"><i class="codicon codicon-add"></i> add</div>
            <div class="icon"><i class="codicon codicon-archive"></i> archive</div>
            <div class="icon"><i class="codicon codicon-arrow-both"></i> arrow-both</div>
            <div class="icon"><i class="codicon codicon-arrow-down"></i> arrow-down</div>
            
        Hello 123<br/><h3>Search so and so on Documatic</h3><hr />`;
        const contentHTML = searchResults.map((i: any) => this.getHTMLcontentForSearchResult(i)).join("<hr />")
        const footerHTML = "</body></html>";
        return headerHTML+contentHTML+footerHTML;
    } 

    protected getHTMLcontentForSearchResult(searchResult: any) {
        return `
        <div class="panel-outer">
        <div class="panel">
            <div class="panel-header"><h4><a href="${searchResult.codebase.url}">$(github) ${searchResult.codebase.title}</a></h4> ${searchResult.snippet.filePath}</div>
            <div class="panel-body">
                <blockquote>${searchResult.snippet.summary}</blockquote>
                <code>${searchResult.code} </code>
            </div>
        </div>
        </div>
        ` ;
    }
}