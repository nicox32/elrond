/**
 * Sauvegarde du compte dans un fichier (à garder dans Google Drive, un e-mail…), pour le retrouver sur un nouveau
 * téléphone. Le code d'accès n'y figure jamais : il reste sur le téléphone.
 */
import { migrateAccount } from './ledger.ts';
import type { Account } from './types.ts';

export const BACKUP_APP = 'orvia';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  account: Account;
}

export function backupFileName(now = new Date()): string {
  return `orvia-sauvegarde-${now.toISOString().slice(0, 10)}.json`;
}

export function makeBackup(account: Account, now = new Date()): string {
  const backup: Backup = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), account };
  return JSON.stringify(backup);
}

export class BackupError extends Error {}

/** Lit un fichier de sauvegarde et rend le compte, vérifié et mis à jour. */
export function readBackup(text: string): { account: Account; exportedAt: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Ce fichier n’est pas une sauvegarde Orvia.');
  }
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== BACKUP_APP || typeof b.version !== 'number') {
    throw new BackupError('Ce fichier n’est pas une sauvegarde Orvia.');
  }
  if (b.version > BACKUP_VERSION) {
    throw new BackupError('Cette sauvegarde vient d’une version plus récente d’Orvia : mettez l’appli à jour.');
  }
  const account = migrateAccount(b.account);
  if (!account) throw new BackupError('La sauvegarde est abîmée : le compte n’a pas pu être lu.');
  return { account, exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '' };
}
