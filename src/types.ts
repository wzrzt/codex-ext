/** A Codex session discovered from local Codex state. */
export interface CodexSession {
  readonly sessionId: string;
  readonly title: string;
  /** Local last-activity timestamp when Codex exposes it. */
  readonly updatedAt?: number;
  /** True when Codex stores the session under its local archived_sessions directory. */
  readonly archived?: boolean;
  /**
   * Local workspace folders read from Codex's session metadata. This is not
   * persisted by this extension; it lets existing sessions appear in the
   * workspace that originally created them.
   */
  readonly workspacePaths?: readonly string[];
}

/** A single account-allowance window reported by the official Codex app-server. */
export interface CodexUsageWindow {
  readonly id: string;
  readonly label: string;
  /** Percentage remaining; omitted when Codex does not expose a valid value. */
  readonly remainingPercent?: number;
  /** Unix epoch milliseconds, when Codex supplies a reset time. */
  readonly resetsAt?: number;
}

/** Latest usage snapshot for the signed-in Codex account. */
export interface CodexUsage {
  readonly windows: readonly CodexUsageWindow[];
  readonly fetchedAt: number;
  readonly usageBlocked: boolean;
  /** Signed-in account identity when the official app-server exposes it. */
  readonly accountEmail?: string;
  readonly planType?: string;
}

/** Persisted session-to-workspace association stored in ExtensionContext.workspaceState. */
export interface SessionWorkspaceBindings {
  readonly [sessionId: string]: string;
}

/** User-defined group assignment held independently for each VS Code workspace. */
export interface SessionGroups {
  readonly [sessionId: string]: string;
}
