import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Écrit la sauvegarde puis ouvre le partage du téléphone (Google Drive, e-mail, Fichiers…). */
export async function shareBackup(text: string, name: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Enregistrer la sauvegarde Orvia',
  });
}

/** Écrit un fichier texte (CSV…) puis ouvre le partage du téléphone. */
export async function shareTextFile(text: string, name: string, mimeType: string, title: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: 'public.comma-separated-values-text', dialogTitle: title });
}

/** Ouvre le sélecteur de fichiers ; rend le contenu choisi, ou null si vous annulez. */
export async function pickBackup(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  return new File(res.assets[0].uri).text();
}
