import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatEur } from '../logic/format';
import {
  allowanceUsed,
  childGifts,
  type GiftPeriod,
  giftPeriodRange,
  giftRecapHtml,
  quarterKey,
  quarterLabel,
} from '../logic/giftRecap';
import { replaceChildAccount } from '../logic/ledger';
import type { ChildAccount } from '../logic/types';
import { exportPdf } from '../pdf';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Button, Card, Hint, Message } from './ui';

/** Dons à l'enfant : récapitulatif pour le formulaire 2735, abattement, et trimestres déclarés. */
export function GiftRecapCard({ child }: { child: ChildAccount }) {
  const account = useAccount();
  const { updateAccount } = useBank();
  const [period, setPeriod] = useState<GiftPeriod>('lastQuarter');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now] = useState(() => new Date());
  const range = giftPeriodRange(period, now);
  const gifts = childGifts(child, range.from, range.to);
  const total = gifts.reduce((s, g) => s + g.value, 0);
  const allowance = allowanceUsed(child, now);
  const lastQ = quarterKey(giftPeriodRange('lastQuarter', now).from);
  const lastQGifts = childGifts(
    child,
    giftPeriodRange('lastQuarter', now).from,
    giftPeriodRange('lastQuarter', now).to,
  );
  const declared = child.declaredQuarters?.includes(lastQ);

  async function download() {
    try {
      await exportPdf(giftRecapHtml(account, child, period, now), `Dons à ${child.name} — ${range.label}`);
    } catch {
      setMsg({ ok: false, text: 'Le récapitulatif n’a pas pu être créé.' });
    }
  }

  function toggleDeclared() {
    const list = new Set(child.declaredQuarters ?? []);
    if (declared) list.delete(lastQ);
    else list.add(lastQ);
    updateAccount((a) => replaceChildAccount(a, { ...child, declaredQuarters: [...list].sort() }));
    setMsg({ ok: true, text: declared ? 'Marqué comme non déclaré.' : `${quarterLabel(lastQ)} marqué comme déclaré.` });
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Déclaration des dons (formulaire 2735)</Text>
      <View style={styles.allowance}>
        <Text style={styles.allowanceText}>
          Abattement sur 15 ans : {formatEur(allowance.used)} utilisés sur {formatEur(100_000)}
        </Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${Math.min(100, (allowance.used / 100_000) * 100)}%` }]} />
        </View>
        <Text style={styles.allowanceSub}>Reste {formatEur(allowance.left)} sans aucun droit de donation.</Text>
      </View>
      <Segmented
        value={period}
        onChange={setPeriod}
        options={(['lastQuarter', 'quarter', 'lastYear', 'year'] as GiftPeriod[]).map((p) => ({
          value: p,
          label:
            p === 'lastQuarter'
              ? 'Trim. préc.'
              : p === 'quarter'
                ? 'Ce trim.'
                : String(now.getFullYear() - (p === 'lastYear' ? 1 : 0)),
        }))}
      />
      <Hint>
        {range.label} : {gifts.length} don{gifts.length > 1 ? 's' : ''}, {formatEur(total)} (valeur au jour de chaque
        don).
      </Hint>
      <Button title="Télécharger le récapitulatif (PDF)" variant="ghost" onPress={download} disabled={!gifts.length} />
      {lastQGifts.length > 0 && (
        <>
          <Hint>
            {quarterLabel(lastQ)} :{' '}
            {declared ? 'dons déclarés ✓' : 'dons à déclarer. Un rappel arrive au début de chaque trimestre.'}
          </Hint>
          <Button
            title={declared ? 'Marquer comme non déclaré' : `J’ai déclaré les dons du ${quarterLabel(lastQ)}`}
            variant={declared ? 'ghost' : 'primary'}
            onPress={toggleDeclared}
          />
        </>
      )}
      {msg && <Message {...msg} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  allowance: { gap: 4 },
  allowanceText: { color: colors.text, fontSize: 13 },
  allowanceSub: { color: colors.textMuted, fontSize: 12 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.gold },
});
