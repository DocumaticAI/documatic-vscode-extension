import {
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  workspace,
  window,
  CancellationToken,
  ProviderResult,
  languages
} from "vscode";
import { globalAxios, globalContext } from "./extension";

import * as vscode from "vscode";
import { type } from "os";
import { getExtensionFromPath, getLangFromExt } from "./utils";
import { execSync } from "child_process";
import { join } from "path";

class Dependency extends TreeItem {
  constructor(
    public readonly label: string,
    private version: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.version}`;
    this.description = this.version;
  }
}

class Project extends TreeItem {
  objId: number;
  constructor(
    id: number,
    title: string,
    description: string,
    owner: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(title, collapsibleState);
    this.objId = id
    this.tooltip = description;
    this.description = owner;
    this.iconPath = new ThemeIcon("repo")
  }
}

type ProjectDataType = {
  id: number;
  title: string;
  description: string;
  userId?: string;
  organisationId?: number;
};

type OrganisationDataType = {
  id: number;
  name: string;
};

type ProfileType = {
  id: string;
};

class Organisation extends TreeItem {
  objId: string;
  constructor(
    id: string,
    name: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(name, collapsibleState);
    this.objId = id;
    this.tooltip = name;
    this.iconPath = new ThemeIcon("organization");
  }
}

interface RecursiveItem {
  [key: string]: RecursiveItem | Array<string>;
}

class FolderItem extends TreeItem {
  tree: RecursiveItem;
  projectId: number;
  path: string;
  constructor(
    name: string, 
    tree: RecursiveItem,
    public readonly collapsibleState: TreeItemCollapsibleState,
    projectId: number,
    path: string
    
    ) {
      super(name, collapsibleState);
      this.tree = tree;
      this.iconPath = ThemeIcon.Folder;
      this.projectId= projectId;
      this.path= path;
    }
}

class FileItem extends TreeItem {
  childObjects: string[];
  projectId: number;
  path: string;
  constructor(
    name: string, 
    childObjects: string[],
    public readonly collapsibleState: TreeItemCollapsibleState,
    projectId: number,
    path: string
    
    ) {
      super(name, collapsibleState);
      this.childObjects = childObjects;
      this.iconPath = ThemeIcon.File;
      this.projectId= projectId;
      this.path= path;
    }
}

class ObjectItem extends TreeItem {
  projectId: number;
  path: string;
  constructor(
    name: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    projectId?: number,
    path?: string
    ) {
      super(name, collapsibleState);
      this.iconPath = new ThemeIcon("symbol-object");
      this.tooltip = `${projectId}-${path}`;
      this.label = name ?? "";
      this.projectId = projectId?? 0;
      this.path = path?? "";
    }
}

export class ProjectsTreeDataProvider implements TreeDataProvider<Project> {
  orgs: any;
  projects: any;
  profile: any;

  constructor() {
    this.getInitialData();
  }

  async getInitialData() {
    this.profile = await globalContext.globalState.get("profile");
    const orgs: { id: number; name: string }[] | undefined =
      await globalContext.globalState.get("organisations");
    this.orgs = orgs;
    const projects: ProjectDataType[] | undefined =
      await globalContext.globalState.get("projects");
    this.projects = projects;
  }

  getTreeItem(element: Project): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element?: Project): Promise<Project[] | null | undefined> {
    if (element) {
      return Promise.resolve(
        []
        // change this to folder list later
      );
    } else {
      if (this.projects)
        return Promise.resolve(this.getProjectsListFromProjects(this.projects));
      return Promise.resolve([]);
    }
  }

  private _onDidChangeTreeData: EventEmitter<
    Project | undefined | null | void
  > = new EventEmitter<Project | undefined | null | void>();
  readonly onDidChangeTreeData: Event<Project | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getProjectsListFromProjects(projects: ProjectDataType[]): Project[] {
    return projects.map(
      (j: ProjectDataType) =>
        new Project(
          j.id,
          j.title,
          j.description,
          j.userId
            ? j.userId == this.profile.id
              ? "Myself"
              : j.userId
            : j.organisationId
            ? this.orgs?.find((o: { id: number }) => o.id == j.organisationId)
                ?.name ?? "Different Organisation"
            : "Different Organisation",
          TreeItemCollapsibleState.None
        )
    );
  }
}

export class OrganisationsTreeDataProvider
  implements TreeDataProvider<Organisation | Project | FolderItem | FileItem | ObjectItem> 
{
  orgs: any;
  projects: any;
  profile: any;

  constructor() {
    this.getInitialData();
  }

  async getInitialData() {
    this.profile = await globalContext.globalState.get("profile");
    const orgs: { id: number; name: string }[] | undefined =
      await globalContext.globalState.get("organisations");
    this.orgs = orgs;
    const projects: ProjectDataType[] | undefined =
      await globalContext.globalState.get("projects");
    this.projects = projects;
  }

  getTreeItem(element: Organisation): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async resolveTreeItem(item: TreeItem, element: Project | Organisation | FolderItem | FileItem | ObjectItem, token: CancellationToken): Promise<undefined> {
    
    if (element instanceof ObjectItem) {
      
      const snippetFromBackend = (await globalAxios.get(`/project/${element.projectId}/snippet?file=${encodeURIComponent(element.path)}&name=${encodeURIComponent(typeof(element.label) === "string" ? element.label : "")}`)).data;
      // console.log(await vscode.commands.executeCommand("workbench.action.gotoSymbol", "a"))
      
      vscode.workspace.workspaceFolders?.map( async folder => {
        const currentFolderVersion = execSync(`cd ${folder.uri.path} && git rev-parse HEAD`).toString().trim();
        const allVersionsFromFolder = execSync(`cd ${folder.uri.path} && git --no-pager log --pretty=format:"%H"`).toString().trim();
        console.log("git commit hash for", folder.name, currentFolderVersion, snippetFromBackend.version.version)
        console.log("git history", allVersionsFromFolder)
        const sectionRange = new vscode.Range(new vscode.Position(snippetFromBackend.snippet.startLine, snippetFromBackend.snippet.startColumn), new vscode.Position(snippetFromBackend.snippet.endLine, snippetFromBackend.snippet.endColumn))
        if (snippetFromBackend.version.version === currentFolderVersion)
        {
          const fileInFolder = await workspace.openTextDocument(join(folder.uri.path, element.path))
          await window.showTextDocument(fileInFolder, { preserveFocus: true, selection: sectionRange})
          console.log("should have opened ", join(folder.uri.path, element.path))
        }
        else if (allVersionsFromFolder.indexOf(snippetFromBackend.version.version) > -1)
        {
          console.log("git versions are different, but found the version in the history", snippetFromBackend.version.version, currentFolderVersion, join(folder.uri.path, element.path))
          // TODO: show the file at that version instead of current version
          const fileInFolder = await workspace.openTextDocument(join(folder.uri.path, element.path))
          await window.showTextDocument(fileInFolder, { preserveFocus: true, selection: sectionRange})
        } 
        else {
          vscode.window.showInformationMessage('File not found in workspace! Opening a temporary file with the contents from Documatic');
          const objDoc = await workspace.openTextDocument({content: snippetFromBackend.full_file});
          await window.showTextDocument(objDoc, { preserveFocus: true, selection: sectionRange});
          const ext = getExtensionFromPath(element.path);
          const langId = getLangFromExt(ext);
          await languages.setTextDocumentLanguage(objDoc, langId);

        }
      })


    }
    return ;
    
  }

  async getChildren(
    element?: Organisation | Project | FolderItem | FileItem | ObjectItem
  ): Promise<(Organisation | Project | FolderItem | FileItem | ObjectItem)[] | null | undefined> {
    if (element) {
      
      if (element instanceof FolderItem) {
        return Promise.resolve(this.generateTreeFromObjects(element.tree, element.projectId, element.path+"/"+element.label))
      }

      else if (element instanceof FileItem) {
        return Promise.resolve(this.getListfromObjects(element.childObjects, element.projectId, element.path+"/"+element.label));
      }

      else if (element instanceof Project) {
        let existing_object_list: {[key: number]: { [key: string]: string[] }} | undefined = await globalContext.globalState.get("objects_lists");
        
        let objects;
        if (existing_object_list && existing_object_list[element.objId]) objects = existing_object_list[element.objId];
        else objects = (await globalAxios.get(`/project/${element.objId}/objects`)).data
        
        if (!existing_object_list) 
          existing_object_list = {}
        existing_object_list[element.objId] = objects

        await globalContext.globalState.update("objects_lists", existing_object_list)
        
        return Promise.resolve(this.generateTreeFromObjects(objects, element.objId, ""));
      }

      else if (element instanceof Organisation) {
      if (this.projects) {
        if (element.label === "Myself")
          return Promise.resolve(
            this.getProjectsListFromProjects(
              this.projects.filter(
                (p: ProjectDataType) => p.userId === this.profile.id
              )
            )
          );
        const orgProjects = this.projects?.filter(
          (p: ProjectDataType) => p.organisationId === Number(element.objId)
        );
        if (orgProjects)
          return Promise.resolve(this.getProjectsListFromProjects(orgProjects));
      }
    }

      return Promise.resolve([]);
    } else {
      return Promise.resolve([
        new Organisation("0", "Myself", TreeItemCollapsibleState.Expanded),
        ...this.getListfromOrgs(this.orgs),
      ]);
    }
  }

  private _onDidChangeTreeData: EventEmitter<
    Project | undefined | null | void
  > = new EventEmitter<Project | undefined | null | void>();
  readonly onDidChangeTreeData: Event<Project | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getListfromOrgs(orgs: any[]): Organisation[] {
    if (!orgs) return [];
    return orgs.map(
      (j) =>
        new Organisation(
          String(j.id),
          j.name,
          TreeItemCollapsibleState.Expanded
        )
    );
  }

  getProjectsListFromProjects(projects: ProjectDataType[]): Project[] {
    return projects.map(
      (j: ProjectDataType) =>
        new Project(
          j.id,
          j.title,
          j.description,
          j.userId
            ? j.userId == this.profile.id
              ? "Myself"
              : j.userId
            : j.organisationId
            ? this.orgs?.find((o: { id: number }) => o.id == j.organisationId)
                ?.name ?? "Different Organisation"
            : "Different Organisation",
          TreeItemCollapsibleState.Collapsed
        )
    );
  }

  generateTreeFromObjects(objects: {[key:string]: string[] | RecursiveItem}, projectId: number, path: string) {
    const fileNames = Object.keys(objects);
    const treeStructure: any = {};
    fileNames.map(f => { f.split("/").reduce((r,e) => r[e] || (r[e] = f.endsWith(e) ? objects[f] : {}), treeStructure) });

    const treekeys = Object.keys(treeStructure);
    return treekeys.sort().map(treekey => {
      if (Array.isArray(treeStructure[treekey]))
        return new FileItem(treekey, treeStructure[treekey], TreeItemCollapsibleState.Collapsed, projectId, path)
      else return new FolderItem(treekey, treeStructure[treekey], TreeItemCollapsibleState.Collapsed, projectId, path)
    })
    
  }

  getListfromObjects(objects: string[], projectId: number, path: string) {
    return objects.map(obj => new ObjectItem(obj, TreeItemCollapsibleState.None, projectId, path))
  }
}

