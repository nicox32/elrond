import { View } from 'react-native';

import { DEFERRED_DAYS, FEES, type SaleSpeed } from '../logic/fees';
import { Segmented } from './Segmented';
import { Hint, Label } from './ui';

/** Choix du type de virement à la revente : différé (sans écart) ou immédiat (avec écart). */
export function SpeedPicker({ value, onChange }: { value: SaleSpeed; onChange: (speed: SaleSpeed) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Label>Virement</Label>
      <Segmented
        value={value}
        onChange={onChange}
        options={[
          { value: 'deferred', label: `Différé · J+${DEFERRED_DAYS}` },
          { value: 'immediate', label: 'Immédiat' },
        ]}
      />
      <Hint>
        {value === 'deferred'
          ? `Les euros arrivent sous ${DEFERRED_DAYS} jours ouvrés, sans écart de revente.`
          : `Les euros partent tout de suite, avec un écart de ${(FEES.immediateSpread * 100).toLocaleString('fr-FR')}\u00a0%.`}
      </Hint>
    </View>
  );
}
