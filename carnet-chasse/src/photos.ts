import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** Ouvre la galerie et copie l'image choisie dans le dossier de l'appli (la copie du sélecteur peut être effacée). */
export async function pickTrophyPhoto(prefix = 'trophee'): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || result.assets.length === 0) return undefined;
  const picked = result.assets[0].uri;
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create();
    const ext = picked.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
    const dest = new File(dir, `${prefix}-${Date.now()}.${ext}`);
    await new File(picked).copy(dest);
    return dest.uri;
  } catch {
    return picked;
  }
}

/** Supprime une photo copiée par l'appli (sans effet sur les autres fichiers). */
export function deleteTrophyPhoto(uri: string | undefined): void {
  if (!uri || !uri.includes('/photos/')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Photo déjà supprimée.
  }
}
