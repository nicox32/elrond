import { router } from 'expo-router';

import { Banner } from './ui';
import { VaultLogo } from './VaultLogo';

/**
 * Rappel court : métal gardé par Orvia en port franc, mais propriété du client. Lien vers l'explication.
 * Pour un compte enfant, `name` adapte le texte : le métal appartient à l'enfant.
 */
export function CustodyNote({ name }: { name?: string }) {
  return (
    <Banner
      icon={<VaultLogo size={58} />}
      title={name ? `Le métal de ${name} lui appartient` : 'Votre métal vous appartient'}
      onPress={() => router.push('/or-fractionne')}
      testID="custody-note"
    >
      {name
        ? `Gardé par Orvia en coffre sécurisé, en port franc, assuré et audité. Il est inscrit au nom de ${name} et ne fait pas partie des biens d’Orvia.`
        : 'Gardé par Orvia en coffre-fort, en port franc, assuré et audité. Il est inscrit à votre nom et ne fait pas partie des biens d’Orvia.'}
    </Banner>
  );
}
