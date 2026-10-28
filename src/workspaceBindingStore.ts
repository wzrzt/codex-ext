import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import * as vscode from 'vscode';
import { CodexSession, SessionGroups, SessionWorkspaceBindings } from './types';

const BINDINGS_KEY = 'sessionWorkspaceBindings';
const GROUPS_KEY = 'sessionGroups';
const GROUP_NAMES_KEY = 'sessionGroupNames';

/**
 * Persists bindings in workspaceState, which VS Code scopes to the currently
 * opened workspace. The hash remains useful if a state store is migrated or
 * inspected and prevents raw workspace paths from becoming identifiers.
 */
export class WorkspaceBindingStore {
  public constructor(private readonly workspaceState: vscode.Memento) {}

  public getCurrentWorkspaceHash(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }

    const identity = folders
      .map((folder) => folder.uri.toString())
      .sort()
      .join('\n');
    return createHash('sha256').update(identity).digest('hex');
  }

  /** Absolute folder paths captured when a new-session draft is opened. */
  public getCurrentWorkspacePaths(): readonly string[] {
    return (vscode.workspace.workspaceFolders ?? [])
      .map((folder) => resolve(folder.uri.fsPath))
      .sort();
  }

  public isBoundToCurrentWorkspace(sessionId: string): boolean {
    const workspaceHash = this.getCurrentWorkspaceHash();
    return workspaceHash !== undefined && this.read()[sessionId] === workspaceHash;
  }

  /**
   * A session belongs to this workspace when it was explicitly bound here or
   * when Codex's own immutable session metadata names one of its folders.
   * The latter makes the first install useful for existing conversations.
   */
  public belongsToCurrentWorkspace(session: CodexSession): boolean {
    if (this.isBoundToCurrentWorkspace(session.sessionId)) {
      return true;
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0 || !session.workspacePaths?.length) {
      return false;
    }

    const workspacePaths = new Set(folders.map((folder) => resolve(folder.uri.fsPath)));
    return session.workspacePaths.some((path) => workspacePaths.has(resolve(path)));
  }

  public async bindToCurrentWorkspace(sessionId: string): Promise<boolean> {
    const workspaceHash = this.getCurrentWorkspaceHash();
    if (!workspaceHash) {
      return false;
    }

    await this.workspaceState.update(BINDINGS_KEY, {
      ...this.read(),
      [sessionId]: workspaceHash
    } satisfies SessionWorkspaceBindings);
    return true;
  }

  public getGroup(sessionId: string): string | undefined {
    return this.readGroups()[sessionId];
  }

  public getGroupNames(): readonly string[] {
    return [...new Set([...this.readGroupNames(), ...Object.values(this.readGroups())])]
      .sort((left, right) => left.localeCompare(right));
  }

  public async createGroup(name: string): Promise<void> {
    const names = new Set(this.readGroupNames());
    names.add(name);
    await this.workspaceState.update(GROUP_NAMES_KEY, [...names].sort((left, right) => left.localeCompare(right)));
  }

  public async assignGroup(sessionId: string, group: string | undefined): Promise<void> {
    const next = { ...this.readGroups() } as Record<string, string>;
    if (group) {
      next[sessionId] = group;
      await this.createGroup(group);
    } else {
      delete next[sessionId];
    }
    await this.workspaceState.update(GROUPS_KEY, next satisfies SessionGroups);
  }

  public async renameGroup(from: string, to: string): Promise<void> {
    const next = Object.fromEntries(Object.entries(this.readGroups()).map(([sessionId, group]) =>
      [sessionId, group === from ? to : group])) as SessionGroups;
    const names = this.readGroupNames().map((name) => name === from ? to : name);
    await Promise.all([
      this.workspaceState.update(GROUPS_KEY, next),
      this.workspaceState.update(GROUP_NAMES_KEY, [...new Set(names)].sort((left, right) => left.localeCompare(right)))
    ]);
  }

  public async removeGroup(name: string): Promise<void> {
    const next = Object.fromEntries(Object.entries(this.readGroups()).filter(([, group]) => group !== name)) as SessionGroups;
    await Promise.all([
      this.workspaceState.update(GROUPS_KEY, next),
      this.workspaceState.update(GROUP_NAMES_KEY, this.readGroupNames().filter((group) => group !== name))
    ]);
  }

  private read(): SessionWorkspaceBindings {
    return this.workspaceState.get<SessionWorkspaceBindings>(BINDINGS_KEY, {});
  }

  private readGroups(): SessionGroups {
    return this.workspaceState.get<SessionGroups>(GROUPS_KEY, {});
  }

  private readGroupNames(): readonly string[] {
    return this.workspaceState.get<readonly string[]>(GROUP_NAMES_KEY, []);
  }
}
