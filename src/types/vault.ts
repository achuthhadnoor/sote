export interface VaultNode {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: VaultNode[];
}
