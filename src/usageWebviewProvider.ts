import * as vscode from 'vscode';
import { CodexUsage, CodexUsageWindow } from './types';

/**
 * Claude Code-inspired account summary for the top of the Codex Ext sidebar.
 * Sessions remain a native TreeView below it, retaining VS Code's standard
 * keyboard navigation and context menus.
 */
export class UsageWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private usage: CodexUsage | undefined;
  private error: Error | undefined;

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: false };
    this.render();
  }

  public setUsage(usage: CodexUsage): void {
    this.usage = usage;
    this.error = undefined;
    this.render();
  }

  public setError(error: unknown): void {
    this.error = error instanceof Error ? error : new Error(String(error));
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = renderUsage(this.usage, this.error);
  }
}

function renderUsage(usage: CodexUsage | undefined, error: Error | undefined): string {
  const account = usage?.accountEmail
    ? `<div class="heading">${escapeHtml(vscode.l10n.t('ACCOUNT'))}</div>
       <div class="account"><span>${escapeHtml(vscode.l10n.t('Email'))}</span><strong>${escapeHtml(usage.accountEmail)}</strong></div>
       ${usage.planType ? `<div class="account"><span>${escapeHtml(vscode.l10n.t('Plan'))}</span><strong>${escapeHtml(usage.planType)}</strong></div>` : ''}`
    : '';
  const content = usage?.windows.length
    ? usage.windows.map((window) => renderWindow(window)).join('')
    : `<p class="empty">${escapeHtml(error ? vscode.l10n.t('Usage unavailable') : vscode.l10n.t('Loading usage…'))}</p>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(vscode.env.language)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  :root { color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
  body { margin: 0; padding: 8px 12px 28px; background: var(--vscode-sideBar-background); }
  .heading { color: var(--vscode-descriptionForeground); font-size: 12px; font-weight: 700; letter-spacing: .08em; margin: 0 0 12px; }
  .account { display: flex; gap: 12px; justify-content: space-between; margin: 0 0 7px; }
  .account strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .usage { margin: 0 0 20px; }
  .usage:last-child { margin-bottom: 0; }
  .line { display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px; }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
  .amount { font-size: 15px; font-weight: 600; white-space: nowrap; }
  .track { height: 9px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent); }
  .bar { height: 100%; border-radius: inherit; background: var(--vscode-charts-green); min-width: 2px; }
  .bar.low { background: var(--vscode-charts-yellow); }
  .reset { color: var(--vscode-descriptionForeground); margin-top: 5px; font-size: 13px; }
  .empty { color: var(--vscode-descriptionForeground); margin: 0; }
</style>
</head>
<body>
  ${account}
  <div class="heading">${escapeHtml(vscode.l10n.t('USAGE'))}</div>
  ${content}
</body>
</html>`;
}

function renderWindow(window: CodexUsageWindow): string {
  const remaining = window.remainingPercent;
  const percentage = remaining === undefined ? 0 : Math.max(0, Math.min(100, remaining));
  const label = remaining === undefined ? vscode.l10n.t('Unknown') : vscode.l10n.t('{0}% remaining', remaining);
  const reset = window.resetsAt === undefined
    ? vscode.l10n.t('Unknown')
    : new Date(window.resetsAt).toLocaleString();
  return `<section class="usage">
    <div class="line"><span class="name">${escapeHtml(window.label)}</span><span class="amount">${escapeHtml(label)}</span></div>
    <div class="track"><div class="bar${percentage <= 20 ? ' low' : ''}" style="width:${percentage}%"></div></div>
    <div class="reset">${escapeHtml(vscode.l10n.t('Resets'))}: ${escapeHtml(reset)}</div>
  </section>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}
