import * as ImagePicker from 'expo-image-picker';

/** Sur le web, l'image est gardée telle quelle (adresse fournie par le navigateur). */
export async function pickTrophyPhoto(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: false });
  if (result.canceled || result.assets.length === 0) return undefined;
  return result.assets[0].uri;
}

export function deleteTrophyPhoto(_uri: string | undefined): void {}
