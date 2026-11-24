import type { Contact } from '../data/world.ts';

/** Minuscules, sans accents ni apostrophes, pour comparer les mots clés. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .trim();
}

/** Choisit un élément d’une liste avec un nombre entre 0 et 1 (Math.random par défaut). */
export function pick<T>(list: readonly T[], r: number = Math.random()): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}

/** Réponse d’un contact : un mot clé reconnu l’emporte, sinon une réponse générique. */
export function replyFor(contact: Contact, userText: string, r: number = Math.random()): string {
  const text = normalize(userText);
  const words = new Set(text.split(/[^a-z0-9$❤]+/).filter(Boolean));
  for (const t of contact.triggers) {
    const hit = t.words.some((w) => {
      const nw = normalize(w);
      return nw.includes(' ') || !/^[a-z0-9]+$/.test(nw) ? text.includes(nw) : words.has(nw);
    });
    if (hit) return pick(t.replies, r);
  }
  return pick(contact.generic, r);
}

/** Délai de réponse réaliste : plus le message est long, plus il faut de temps pour l’écrire. */
export function typingDelay(reply: string, r: number = Math.random()): number {
  return Math.min(4500, 900 + reply.length * 35 + Math.floor(r * 600));
}
