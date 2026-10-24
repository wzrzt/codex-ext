import * as vscode from 'vscode';
import { CodexSession } from './types';
import { WorkspaceBindingStore } from './workspaceBindingStore';

type GroupKind = 'active' | 'archived';
export type SessionTreeNode = SessionGroupTreeItem | SessionTreeItem | ErrorTreeItem;

/** A user-defined active-session group or the Codex-backed Archived group. */
export class SessionGroupTreeItem extends vscode.TreeItem {
  public constructor(
    public readonly kind: GroupKind,
    public readonly groupName: string | undefined,
    count: number
  ) {
    super(kind === 'archived'
      ? vscode.l10n.t('Archived')
      : groupName ?? vscode.l10n.t('Ungrouped'),
    kind === 'archived' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
    this.id = kind === 'archived'
      ? 'codex-workspace-sessions-archived'
      : `codex-workspace-sessions-group-${groupName ?? 'ungrouped'}`;
    this.description = String(count);
    this.tooltip = kind === 'archived'
      ? vscode.l10n.t('Archived sessions stored by Codex locally')
      : groupName
        ? vscode.l10n.t('Session group: {0}', groupName)
        : vscode.l10n.t('Sessions without a group');
    this.iconPath = new vscode.ThemeIcon(kind === 'archived' ? 'archive' : groupName ? 'folder' : 'comment-discussion');
    this.contextValue = kind === 'archived'
      ? 'codexWorkspaceSessions.archivedGroup'
      : groupName ? 'codexWorkspaceSessions.customGroup' : 'codexWorkspaceSessions.ungroupedGroup';
  }
}

export class SessionTreeItem extends vscode.TreeItem {
  public constructor(public readonly session: CodexSession) {
    super(session.title || vscode.l10n.t('Untitled session'), vscode.TreeItemCollapsibleState.None);
    this.id = session.sessionId;
    this.tooltip = `${session.title}\n${session.sessionId}`;
    this.iconPath = new vscode.ThemeIcon(session.archived ? 'archive' : 'comment-discussion');
    this.contextValue = session.archived
      ? 'codexWorkspaceSessions.archivedSession'
      : 'codexWorkspaceSessions.session';
    this.command = session.archived
      ? {
          command: 'codexWorkspaceSessions.restoreArchivedSession',
          title: vscode.l10n.t('Restore Archived Session'),
          arguments: [this]
        }
      : {
          command: 'codexWorkspaceSessions.openSession',
          title: vscode.l10n.t('Open Session'),
          arguments: [this]
        };
  }
}

/** Tree data source for scoped sessions, user groups, search, and archived conversations. */
export class SessionsTreeDataProvider implements vscode.TreeDataProvider<SessionTreeNode> {
  private readonly changeEmitter = new vscode.EventEmitter<SessionTreeNode | undefined>();
  private sessions: readonly CodexSession[] = [];
  private query = '';
  private loadError: Error | undefined;

  public readonly onDidChangeTreeData = this.changeEmitter.event;

  public constructor(
    private readonly bindings: WorkspaceBindingStore,
    private readonly getShowAll: () => boolean
  ) {}

  public getTreeItem(element: SessionTreeNode): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: SessionTreeNode): SessionTreeNode[] {
    if (!element) {
      if (this.loadError) {
        return [new ErrorTreeItem(this.loadError.message)];
      }
      const scoped = this.getScopedSessions();
      const active = scoped.filter((session) => !session.archived);
      const groupNames = this.bindings.getGroupNames();
      const groupItems = [undefined, ...groupNames].map((groupName) =>
        new SessionGroupTreeItem('active', groupName, active.filter((session) => this.bindings.getGroup(session.sessionId) === groupName).length));
      return [
        ...groupItems,
        new SessionGroupTreeItem('archived', undefined, scoped.filter((session) => session.archived).length)
      ];
    }

    if (!(element instanceof SessionGroupTreeItem)) {
      return [];
    }

    return this.getScopedSessions()
      .filter((session) => element.kind === 'archived' ? session.archived : !session.archived)
      .filter((session) => element.kind === 'archived' || this.bindings.getGroup(session.sessionId) === element.groupName)
      .map((session) => new SessionTreeItem(session));
  }

  public setSessions(sessions: readonly CodexSession[]): void {
    this.sessions = sessions;
    this.loadError = undefined;
    this.refresh();
  }

  public setError(error: unknown): void {
    this.loadError = error instanceof Error ? error : new Error(String(error));
    this.refresh();
  }

  public setQuery(query: string): void {
    this.query = query;
    this.refresh();
  }

  public getQuery(): string {
    return this.query;
  }

  public refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  public dispose(): void {
    this.changeEmitter.dispose();
  }

  private getScopedSessions(): readonly CodexSession[] {
    const normalizedQuery = this.query.trim().toLocaleLowerCase();
    return this.sessions
      .filter((session) => this.getShowAll() || this.bindings.belongsToCurrentWorkspace(session))
      .filter((session) => !normalizedQuery || session.title.toLocaleLowerCase().includes(normalizedQuery));
  }
}

class ErrorTreeItem extends vscode.TreeItem {
  public constructor(message: string) {
    super(vscode.l10n.t('Unable to load sessions'), vscode.TreeItemCollapsibleState.None);
    this.id = 'codex-workspace-sessions-error';
    this.description = vscode.l10n.t('Check the OpenAI Codex connection');
    this.tooltip = message;
    this.iconPath = new vscode.ThemeIcon('warning');
  }
}
