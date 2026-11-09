import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEur } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { exemptionCalendar, taxYearHtml } from '../logic/taxYear';
import { METALS } from '../logic/types';
import { exportPdf } from '../pdf';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';
import { Segmented } from './Segmented';
import { Button, Card, Hint, Message } from './ui';

/** Calendrier d'exonération : le métal détenu, par année d'achat, et quand il ne sera plus imposé. */
export function ExemptionCalendar() {
  const account = useAccount();
  const { quote } = useBank();
  const rows = exemptionCalendar(account, quote.prices);
  if (!rows.length) return null;
  return (
    <Card style={{ paddingVertical: 4 }}>
      {rows.map((r, i) => (
        <View key={r.year} style={[styles.row, i > 0 && styles.border]}>
          <Text style={styles.year}>{r.year}</Text>
          <View style={{ flex: 1 }}>
            {METALS.filter((m) => r.grams[m] > 1e-6).map((m) => (
              <Text key={m} style={[styles.grams, { color: metalColor[m] }]}>
                {r.grams[m].toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g {METAL_LABEL[m].toLowerCase()}
              </Text>
            ))}
            <Text style={styles.muted}>
              Abattement aujourd’hui {Math.round(r.allowance * 100)} % · {formatEur(r.value)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.free, r.exempt && { color: colors.up }]}>
              {r.exempt ? 'Exonéré' : new Date(r.exemptFrom).getFullYear()}
            </Text>
            {!r.exempt && <Text style={styles.muted}>dès le {formatDate(r.exemptFrom)}</Text>}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** Récapitulatif fiscal annuel en PDF (ventes imposées, impôt retenu, frais, dons, calendrier). */
export function TaxYearCard() {
  const account = useAccount();
  const { quote } = useBank();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear - 1));
  const [error, setError] = useState<string | null>(null);
  return (
    <Card style={{ gap: 8 }}>
      <Segmented
        value={year}
        onChange={setYear}
        options={[
          { value: String(thisYear - 1), label: String(thisYear - 1) },
          { value: String(thisYear), label: `${thisYear} (en cours)` },
        ]}
      />
      <Button
        title={`Récapitulatif fiscal ${year} (PDF)`}
        onPress={async () => {
          setError(null);
          try {
            await exportPdf(taxYearHtml(account, Number(year), quote.prices), `Récapitulatif fiscal ${year}`);
          } catch {
            setError('Le PDF n’a pas pu être créé.');
          }
        }}
      />
      {error && <Message ok={false} text={error} />}
      <Hint>
        Ventes imposées et impôt retenu par Orvia, frais de l’année, dons aux enfants et calendrier d’exonération : à
        garder avec vos papiers.
      </Hint>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  year: { color: colors.text, fontSize: 16, fontWeight: '800', width: 48 },
  grams: { fontSize: 13, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  free: { color: colors.gold, fontSize: 16, fontWeight: '800' },
});
