import { Image } from 'react-native';

/** Logo du coffre sécurisé : un coffre-fort doré (fond transparent). */
export function VaultLogo({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/vault.png')}
      style={{ width: size, height: size * (290 / 320) }}
      resizeMode="contain"
      accessibilityLabel="Coffre sécurisé"
    />
  );
}
