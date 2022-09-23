import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { globalContext } from "./extension";

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
  constructor(
    id: number,
    title: string,
    description: string,
    owner: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(title, collapsibleState);
    this.tooltip = description;
    this.description = owner;
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
  constructor(
    id: string,
    name: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(name, collapsibleState);
    this.id = id;
    this.tooltip = name;
  }
}

export class ProjectsDataProvider implements TreeDataProvider<Project> {
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

export class OrganisationsDataProvider
  implements TreeDataProvider<Organisation>
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
    element?: Organisation
  ): Promise<Organisation[] | Project[] | null | undefined> {
    if (element) {
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
          (p: ProjectDataType) => p.organisationId === Number(element.id)
        );
        if (orgProjects)
          return Promise.resolve(this.getProjectsListFromProjects(orgProjects));
      }
      return Promise.resolve([]);
    } else {
      return Promise.resolve([
        new Organisation("0", "Myself", TreeItemCollapsibleState.Collapsed),
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
          TreeItemCollapsibleState.Collapsed
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
          TreeItemCollapsibleState.None
        )
    );
  }
}
