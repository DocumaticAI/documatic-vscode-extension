// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from "axios";

let globalContext: vscode.ExtensionContext;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	globalContext = context;
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when the extension is activated
	console.log('Congratulations, the extension "documatic" is now active!');

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
		vscode.window.registerUriHandler(loginUriHandler),
		// new DocumaticAuthenticationProvider(context)
	];

	context.subscriptions.push(...disposables);
}

let loginUriHandler = {
	handleUri(uri:vscode.Uri) {
		console.log("12344 ### got the URI", uri)
		vscode.window.showInformationMessage(`got the URI ${uri.toString()}`)
		const searchParams = new URLSearchParams(uri.query)
		const tokenB64 = searchParams.get("token");
		console.log("#### just after getting the token")
		if (tokenB64) {
			const token = decodeURIComponent(Buffer.from(tokenB64, "base64").toString("ascii"))
			console.log("#### just before storing the token")
			vscode.window.showInformationMessage(`token is ${token}`)
			globalContext.secrets.store("token", token).then(() => {

				console.log("#### just after saving the token")
				getDocumaticData()
			});
		}
	}
}

let getDocumaticData = async () => {
	console.log("#### just before creating custom axios instance")
	console.log("$$$$ the token is", await globalContext.secrets.get("token"))
	const customAxios = axios.create({
		baseURL: "http://localhost:8180/",
		headers: {
			"Authorization": `Bearer ${await globalContext.secrets.get("token")}`
		}
	})
	console.log("#### just after creating custom axios instance")
	try {
		await Promise.all([
			globalContext.globalState.update("profile", (await customAxios.get("/profile")).data),
			globalContext.globalState.update("projects", (await customAxios.get("/project")).data),
			globalContext.globalState.update("organisations", (await customAxios.get("/organisation")).data)
		])
		console.log("#### promises are fulfilled")
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', true)
		
	} catch (error) {
		vscode.window.showErrorMessage("Error occured while fetching data from Documatic. Please login again")
		globalContext.secrets.delete("token")
		vscode.commands.executeCommand('setContext', 'documatic.isLoggedIn', false)
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
