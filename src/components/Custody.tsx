import { router } from 'expo-router';

import { Banner } from './ui';

/** Rappel court : métal gardé par Orvia en port franc, mais propriété du client. Lien vers l'explication. */
export function CustodyNote() {
  return (
    <Banner icon="🔒" title="Votre métal vous appartient" onPress={() => router.push('/or-fractionne')}>
      Gardé par Orvia en coffre-fort, en port franc, assuré et audité. Il est inscrit à votre nom et ne fait pas partie
      des biens d’Orvia.
    </Banner>
  );
}
