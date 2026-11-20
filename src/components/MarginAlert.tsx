import { Text } from 'react-native';

import { formatEur } from '../logic/format';
import { lotMargin, MARGIN_ALERT_PT, physicalFeesOf, productOf } from '../logic/physical';
import { useAccount } from '../state/BankProvider';
import { colors } from '../theme';

/** Alerte sur la marge d'un lot : sous 0,5 point de la valeur de l'or, ou à perte, au prix client verrouillé. */
export function MarginAlert({
  productId,
  unitCost,
  qty,
  gold,
}: {
  productId: string;
  unitCost: number;
  qty: number;
  gold: number;
}) {
  const account = useAccount();
  if (!(unitCost > 0) || !(qty > 0) || !(gold > 0)) return null;
  const m = lotMargin(productId, unitCost, qty, gold, physicalFeesOf(account.settings));
  const name = productOf(productId).coin ? 'pièce' : 'lingotin';
  const pt = m.pt.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const text =
    m.level === 'loss'
      ? `⚠ Vente à perte : ${formatEur(Math.abs(m.eur))} perdus par ${name} (${pt} pt) au prix client de ${formatEur(m.client)}. Négociez ce lot ou commandez ailleurs.`
      : m.level === 'low'
        ? `⚠ Marge faible : ${formatEur(m.eur)} par ${name} (${pt} pt), sous le minimum de ${String(MARGIN_ALERT_PT).replace('.', ',')} point.`
        : `Marge de ce lot : ${formatEur(m.eur)} par ${name} (${pt} pt) au prix client de ${formatEur(m.client)}.`;
  return (
    <Text
      testID="margin-alert"
      style={{ color: m.level === 'ok' ? colors.up : m.level === 'low' ? colors.warning : colors.down, fontSize: 12.5 }}
    >
      {text}
    </Text>
  );
}
