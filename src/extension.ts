// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios, { AxiosInstance } from "axios";
import { OrganisationDataType, OrganisationsTreeDataProvider, ProfileTreeDataProvider, ProfileType, ProjectDataType, ProjectsTreeDataProvider } from './dataProviders';
import { ResultsOverviewPanel, SearchResultsViewProvider } from './searchResultsViewProvider';
import { readFileSync } from 'fs';
import path = require('path');
import { DocumaticHoverProvider, foldersFromDocumatic, objectSummaries } from './hoverProvider';

export let globalContext: vscode.ExtensionContext;
export let globalAxios: AxiosInstance;
const apiURL: string = vscode.workspace.getConfiguration("documatic").get("apiURL") ?? "https://api.documatic.com/";
const platformURL: string = vscode.workspace.getConfiguration("documatic").get("platformURL") ?? "https://app.documatic.com/";
export const zeroResultsMsg = "0 results received for your search. This may be because your codebase has not finished indexing. Please wait a few minutes and try again. If this persists, please contact info@documatic.com";

export let orgDataProvider: any;
export let projectDataProvider: any;
export let profileDataProvider: any;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	globalContext = context;

	orgDataProvider = new OrganisationsTreeDataProvider();
	projectDataProvider = new ProjectsTreeDataProvider();
	profileDataProvider = new ProfileTreeDataProvider();

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when the extension is activated
	console.log('Congratulations, the extension "documatic" is now active!');


	vscode.window.registerTreeDataProvider('documatic:home', projectDataProvider);
	vscode.window.registerTreeDataProvider('documatic:home_organisations', orgDataProvider);
	vscode.window.registerTreeDataProvider('documatic:home_profile', profileDataProvider);

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
		vscode.commands.registerCommand('documatic.refreshDocumaticInfoFromStore', async () => {
			await getDocumaticData();
			refreshProviders();
		}),
		vscode.window.registerUriHandler(loginUriHandler),
		vscode.commands.registerCommand('documatic.showSearchBox', async () => {
			vscode.window.withProgress({ cancellable: false, title: "Documatic: Search", location: vscode.ProgressLocation.Notification }, searchDocumaticHandler); 
		}),

		vscode.languages.registerHoverProvider('*', new DocumaticHoverProvider()),

		vscode.commands.registerCommand('documatic.clear', async () => {
			await globalContext.globalState.update("profile", {});
			await globalContext.globalState.update("projects", {});
			await globalContext.globalState.update("organisations", {});
			await globalContext.globalState.update("objects_lists", {});
			await globalContext.globalState.update("foldersFromDocumatic", {});
			await globalContext.globalState.update("object_summaries", {});
			await globalContext.secrets.delete("token");

			vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', false);
		})

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
		showLoginPopup();
		return;
	}
	globalAxios = axios.create({
		baseURL: apiURL,
		headers: {
			"authorization": `Bearer ${token}`,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
			// "User-Agent": "curl/7.79.1"
			// "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)"
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
		refreshProviders();
		
	} catch (error) {
		console.log(error);
		globalContext.secrets.delete("token");
		showLoginPopup();
	}

});
	
};

let showLoginPopup = () => {
	vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', false);
	vscode.window.showErrorMessage("Unable to fetch data", ...['Login'])
		.then(selection => {
			if (selection === 'Login') 
				{vscode.commands.executeCommand('documatic.login');}
		});
};

const refreshProviders = () => {
	projectDataProvider.refresh();
	orgDataProvider.refresh();
	profileDataProvider.refresh();
};

let searchDocumaticHandler = async (progress: vscode.Progress<{}>) => {
	const searchInputValue = await vscode.window.showInputBox({title:"Search", placeHolder:"Where are we connecting to databases?",prompt:"Enter some text to search in your codebases"});
	if (!searchInputValue) {
		vscode.window.showErrorMessage("You cancelled the search!");
		return;
	}
	const projectList: ProjectDataType[] | undefined = await globalContext.globalState.get("projects");
	if (!projectList) {
		vscode.window.showErrorMessage("You don't have any projects to search from");
		return;
	}
	const organisationsList: OrganisationDataType[] | undefined = await globalContext.globalState.get("organisations");
	const profile: ProfileType | undefined = await globalContext.globalState.get("profile");

	const selectedProject = await vscode.window.showQuickPick([
    {projectID: undefined, label: "$(zap) All projects"},
	...projectList.map((i) => ({
      projectID: i.id,
      label: `$(${i.folder ? "project" : "repo"}) ${i.title}`,
	  description: i.userId === profile?.id ? "Myself" : organisationsList?.find(o => o.id === i.organisationId)?.name,
	  detail: i.folder
        ? `(Open in editor as ${i.folder?.name})`
        : undefined,
		
    }))],
	{canPickMany: false, placeHolder: "Select one or all projects to search. Esc to cancel", title: "Select project to search on", matchOnDescription: true, matchOnDetail: true}
  );
	if (!selectedProject) {
		vscode.window.showErrorMessage("You cancelled the project selection during search!");
		return;
	}


	vscode.window.showInformationMessage(`Searching "${searchInputValue}" on "${selectedProject.label.split(" ").slice(1).join(" ")}"`);
	const searchResults = (await globalAxios.get(`/codesearch/function`, {params: {q: searchInputValue, projectId: selectedProject.projectID}})).data;
	vscode.window.showInformationMessage(`Got ${searchResults.length} results`);
	if (searchResults.length === 0) {
		vscode.window.showErrorMessage(zeroResultsMsg, {modal: true});
	}
	
	const side = vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn
	? vscode.window.activeTextEditor.viewColumn
	: vscode.ViewColumn.One;

	new ResultsOverviewPanel(globalContext.extensionUri, side, searchInputValue, searchResults); 
};


// this method is called when your extension is deactivated
export function deactivate() {}
