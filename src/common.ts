import { execSync } from "child_process";
import { join } from "path";
import * as vscode from "vscode";
import { globalAxios } from "./extension";
import { getExtensionFromPath, getLangFromExt } from "./utils";

export function openSnippetInEditor(snippetId: number, filePath: string) {
    vscode.window.withProgress(
        {
          cancellable: false,
          title: "Documatic: Get snippet code",
          location: vscode.ProgressLocation.Notification,
        },
        async (progress) => {
          const snippetFromBackend = (await globalAxios.get(`/snippet/${snippetId}?full=true`)).data;
          console.log("got the file", snippetFromBackend);
          // console.log(await vscode.commands.executeCommand("workbench.action.gotoSymbol", "a"))

          progress.report({
            message: "Finished fetching the snippet, checking if it's already in the workspace",
          });
          const folders = vscode.workspace.workspaceFolders;
          let isOpened = false;
          const sectionRange = new vscode.Range(new vscode.Position(snippetFromBackend.snippet.startLine, snippetFromBackend.snippet.startColumn), new vscode.Position(snippetFromBackend.snippet.endLine, snippetFromBackend.snippet.endColumn));
          if (folders) {
            for (const folder of folders) {
              try {
              const currentFolderVersion = execSync(`cd ${folder.uri.path} && git rev-parse HEAD`).toString().trim();
              if (snippetFromBackend.version.version === currentFolderVersion) {
                const fileInFolder = await vscode.workspace.openTextDocument(join(folder.uri.path, filePath));
                await vscode.window.showTextDocument(fileInFolder, { preserveFocus: true, selection: sectionRange, });
                console.log("should have opened ", join(folder.uri.path, filePath));
                isOpened = true;
                break;
              } else {
                try {
                  const commitDesc = execSync(`cd ${folder.uri.path} && git show --oneline -s ${snippetFromBackend.version.version}`);
                  if (commitDesc.length > 8) {
                    console.log("git versions are different, but found the version in the history", snippetFromBackend.version.version, currentFolderVersion, join(folder.uri.path, filePath));
                    // TODO: show the file at that version instead of current version  
                    const fileInFolder = await vscode.workspace.openTextDocument(join(folder.uri.path, filePath));
                    await vscode.window.showTextDocument(fileInFolder, { preserveFocus: true, selection: sectionRange, });
                    isOpened = true;
                    break;
                  }
                } catch (error) {
                  // Commit does not exist in the folder, so ignore this
                }
              }
              } catch (error) {
                // Folder was a part of the workspace, but it's deleted from the filesystem, and vscode still assumes that this is a valid folder and hence `cd` into the folder fails. So ignore this as well.
                console.log(error);
              }
            }
          }

          if (!isOpened) {
            vscode.window.showInformationMessage("File not found in workspace! Opening a temporary file with the contents from Documatic");
            const objDoc = await vscode.workspace.openTextDocument({ content: snippetFromBackend.full_file, });
            await vscode.window.showTextDocument(objDoc, { preserveFocus: true, selection: sectionRange, });
            const ext = getExtensionFromPath(filePath);
            const langId = getLangFromExt(ext);
            await vscode.languages.setTextDocumentLanguage(objDoc, langId);
          }
        }
      );
}