import {
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { globalAxios, globalContext } from "./extension";

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
  constructor(
    name: string, 
    tree: RecursiveItem,
    public readonly collapsibleState: TreeItemCollapsibleState
    ) {
      super(name, collapsibleState);
      this.tree = tree;
      this.iconPath = ThemeIcon.Folder;
    }
}

class FileItem extends TreeItem {
  childObjects: string[];
  constructor(
    name: string, 
    childObjects: string[],
    public readonly collapsibleState: TreeItemCollapsibleState
    ) {
      super(name, collapsibleState);
      this.childObjects = childObjects;
      this.iconPath = ThemeIcon.File;
    }
}

class ObjectItem extends TreeItem {
  constructor(
    name: string, 
    public readonly collapsibleState: TreeItemCollapsibleState
    ) {
      super(name, collapsibleState);
      this.iconPath = ThemeIcon.File;
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

  async getChildren(
    element?: Organisation | Project | FolderItem | FileItem | ObjectItem
  ): Promise<Organisation[] | Project[] | FolderItem[] | FileItem[] | ObjectItem[] | null | undefined> {
    if (element) {
      
      if (element instanceof FolderItem) {
        return Promise.resolve(this.generateTreeFromObjects(element.tree))
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
        
        return Promise.resolve(this.generateTreeFromObjects(objects));
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

  generateTreeFromObjects(objects: {[key:string]: string[] | RecursiveItem}) {
    const fileNames = Object.keys(objects);
    const treeStructure: any = {};
    fileNames.map(f => { f.split("/").reduce((r,e) => r[e] || (r[e] = f.endsWith(e) ? objects[f] : {}), treeStructure) });

    const treekeys = Object.keys(treeStructure);
    return treekeys.sort().map(treekey => {
      if (Array.isArray(treeStructure[treekey]))
        return new FileItem(treekey, treeStructure[treekey], TreeItemCollapsibleState.Collapsed)
      else return new FolderItem(treekey, treeStructure[treekey], TreeItemCollapsibleState.Collapsed)
    })
    
  }

}

