import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Crée le PDF puis ouvre le partage du téléphone (enregistrer dans Fichiers, envoyer par e-mail…). */
export async function exportPdf(html: string, title: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
  } else {
    await Print.printAsync({ uri });
  }
}
