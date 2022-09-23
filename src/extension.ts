// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from "axios";
import { OrganisationsTreeDataProvider, ProjectsTreeDataProvider } from './dataProviders';

export let globalContext: vscode.ExtensionContext;

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
			vscode.env.openExternal(vscode.Uri.parse("http://localhost:3000/vscode/login"))
		}),
		vscode.commands.registerCommand('documatic.refreshDocumaticInfoFromStore', () => {
			projectDataProvider.refresh();
			orgDataProvider.refresh();
		}),
		vscode.window.registerUriHandler(loginUriHandler),
		// new DocumaticAuthenticationProvider(context)
	];

	context.subscriptions.push(...disposables);
}

let loginUriHandler = {
	handleUri(uri:vscode.Uri) {
		vscode.window.showInformationMessage(`Recieved the URL from the browser`)
		const searchParams = new URLSearchParams(uri.query)
		const tokenB64 = searchParams.get("token");
		if (tokenB64) {
			const token = decodeURIComponent(Buffer.from(tokenB64, "base64").toString("ascii"))
			globalContext.secrets.store("token", token).then(() => {
				getDocumaticData()
			});
		}
	}
}

let getDocumaticData = async () => {
	const customAxios = axios.create({
		baseURL: "http://localhost:8180/",
		headers: {
			"Authorization": `Bearer ${await globalContext.secrets.get("token")}`
		}
	})
	try {
		await Promise.all([
			globalContext.globalState.update("profile", (await customAxios.get("/profile")).data),
			globalContext.globalState.update("projects", (await customAxios.get("/project")).data),
			globalContext.globalState.update("organisations", (await customAxios.get("/organisation")).data)
		])
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', true)
		
	} catch (error) {
		vscode.window.showErrorMessage("Error occured while fetching data from Documatic. Please login again")
		globalContext.secrets.delete("token")
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', false)
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
