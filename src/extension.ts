// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios, { AxiosInstance } from "axios";
import { OrganisationsTreeDataProvider, ProjectsTreeDataProvider } from './dataProviders';
import { ResultsOverviewPanel, SearchResultsViewProvider } from './searchResultsViewProvider';
import { readFileSync } from 'fs';
import path = require('path');
import { DocumaticHoverProvider, foldersFromDocumatic, objectSummaries } from './hoverProvider';

export let globalContext: vscode.ExtensionContext;
export let globalAxios: AxiosInstance;
const apiURL: string = vscode.workspace.getConfiguration("documatic").get("apiURL") ?? "https://api.documatic.com/";
const platformURL: string = vscode.workspace.getConfiguration("documatic").get("platformURL") ?? "https://app.documatic.com/";
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	globalContext = context;
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when the extension is activated
	console.log('Congratulations, the extension "documatic" is now active!');


	const orgDataProvider = new OrganisationsTreeDataProvider();
	const projectDataProvider = new ProjectsTreeDataProvider();
	vscode.window.registerTreeDataProvider('documatic:home', projectDataProvider);
	vscode.window.registerTreeDataProvider('documatic:home_organisations', orgDataProvider);

	getDocumaticData();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposables = [
		vscode.commands.registerCommand('documatic.helloWorld', () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('Hello World from Documatic!');
		}),
		vscode.commands.registerCommand('documatic.login', () => {
			vscode.window.showInformationMessage('Opening Documatic in your browser!');
			// vscode.env.openExternal(vscode.Uri.parse("https://app.documatic.com/vscode/login"))
			vscode.env.openExternal(vscode.Uri.parse(`${platformURL}/vscode/login`));
		}),
		vscode.commands.registerCommand('documatic.refreshDocumaticInfoFromStore', () => {
			projectDataProvider.refresh();
			orgDataProvider.refresh();
		}),
		vscode.window.registerUriHandler(loginUriHandler),
		vscode.commands.registerCommand('documatic.showSearchBox', async () => {
			vscode.window.withProgress({ cancellable: false, title: "Documatic: Search", location: vscode.ProgressLocation.Notification }, searchDocumaticHandler); 
		}),

		vscode.languages.registerHoverProvider('*', new DocumaticHoverProvider())

		// new DocumaticAuthenticationProvider(context)
	];

	context.subscriptions.push(...disposables);
	vscode.workspace.onDidChangeWorkspaceFolders(() => getDocumaticData());
}

let loginUriHandler = {
	handleUri(uri:vscode.Uri) {
		vscode.window.showInformationMessage(`Recieved the URL from the browser`);
		const searchParams = new URLSearchParams(uri.query);
		const tokenB64 = searchParams.get("token");
		if (tokenB64) {
			const token = decodeURIComponent(Buffer.from(tokenB64, "base64").toString("ascii"));
			globalContext.secrets.store("token", token).then(() => {
				getDocumaticData();
			});
		}
	}
};

let getDocumaticData = async () => {
	vscode.window.withProgress({ cancellable: false, title: "Documatic: Fetch Data from the platform", location: vscode.ProgressLocation.Notification}, async () => {
	
	const token = await globalContext.secrets.get("token");
	if (!token) {
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', false);
		return;
	}
	globalAxios = axios.create({
		baseURL: apiURL,
		headers: {
			"authorization": `Bearer ${token}`,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			"User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)"
		}
	});
	try {
		await Promise.all([
			globalContext.globalState.update("profile", (await globalAxios.get("/profile")).data),
			globalContext.globalState.update("projects", (await globalAxios.get("/project?codebases=true")).data),
			globalContext.globalState.update("organisations", (await globalAxios.get("/organisation")).data)
		]);

		let projectsFromBackend: any[] = (await globalContext.globalState.get("projects")) ?? [];

		// console.log("from backend", projectsFromBackend);
		vscode.workspace.workspaceFolders?.map( async folder => {
			const gitConfig = readFileSync(path.join(folder.uri.path, ".git/config")).toString().trim();
			const projectForFolder = projectsFromBackend.find(proj => gitConfig.includes(proj.codebase?.url));
			if (projectForFolder) {
				foldersFromDocumatic.push(folder);
				projectForFolder.folder = folder;
				objectSummaries[folder.uri.path] = (await globalAxios.get(`/project/${projectForFolder.id}/object/summary`)).data;
			}
		});
		await globalContext.globalState.update("projects", projectsFromBackend);
		await globalContext.globalState.update("foldersFromDocumatic", foldersFromDocumatic);
		await globalContext.globalState.update("objects_lists", {});
		// await globalContext.globalState.update("object_summaries", objectSummaries);
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', true);
		
	} catch (error) {
		console.log(error);
		vscode.window.showErrorMessage("Error occured while fetching data from Documatic. Please login again");
		globalContext.secrets.delete("token");
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', false);
	}

});
	
};

let searchDocumaticHandler = async (progress: vscode.Progress<{}>) => {
	const searchInputValue = await vscode.window.showInputBox({title:"Search", placeHolder:"Where are we connecting to databases?",prompt:"Enter some text to search in your codebases"});
	if (!searchInputValue) {
		vscode.window.showErrorMessage("You cancelled the search!");
		return;
	}
	vscode.window.showInformationMessage(`Got the search term - ${searchInputValue}`);
	const searchResults = (await globalAxios.get(`/codesearch/function`, {params: {q: searchInputValue}})).data;
	vscode.window.showInformationMessage(`Got ${searchResults.length} results`);
	
	await ResultsOverviewPanel.createOrShow(globalContext.extensionUri, false, searchResults);
};


// this method is called when your extension is deactivated
export function deactivate() {}
