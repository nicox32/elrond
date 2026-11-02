/** Navigateur : ouvre le relevé et la fenêtre d'impression, avec « Enregistrer au format PDF ». */
export async function exportPdf(html: string, title: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) {
    // Fenêtres bloquées : impression depuis un cadre invisible.
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    frame.contentDocument?.open();
    frame.contentDocument?.write(html);
    frame.contentDocument?.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  w.focus();
  setTimeout(() => w.print(), 300);
}
