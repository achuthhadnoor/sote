export interface SessionState {
  lastVaultPath: string | null;
  activeFilePath: string | null;
  openTabs?: string[] | null;
}
