import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/** Photos produit des lingotins (emballage PAMP Suisse). Photo du Napoléon : coq de Chaplain. */
const IMAGES: Record<string, ImageSourcePropType> = {
  g5: require('../../assets/bars/g5.jpg'),
  g10: require('../../assets/bars/g10.jpg'),
  g20: require('../../assets/bars/g20.jpg'),
  oz1: require('../../assets/bars/oz1.jpg'),
  nap20: require('../../assets/bars/nap20.jpg'),
};

/** Vignette d'un produit : sa photo sur fond blanc (l'emballage est blanc), ou le repère de la pièce. */
export function BarImage({ product, size = 56 }: { product: string; size?: number }) {
  const src = IMAGES[product];
  const box = { width: size, height: size, borderRadius: Math.max(6, size / 7) };
  if (!src) {
    return (
      <View style={[styles.coin, box]} accessibilityLabel="Napoléon 20 francs">
        <Text style={[styles.coinText, { fontSize: size / 4 }]}>20 F</Text>
      </View>
    );
  }
  return <Image source={src} style={[styles.img, box]} resizeMode="contain" accessibilityLabel="Photo du produit" />;
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#fff' },
  coin: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { color: colors.gold, fontWeight: '800' },
});
