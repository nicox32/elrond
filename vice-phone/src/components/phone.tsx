import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clock } from '../logic/format';
import { useNow, usePhone } from '../state/PhoneProvider';
import { colors, wallpapers } from '../theme';

/** Fond d’écran choisi dans les réglages, en plein écran. */
export function Wallpaper({ children, dim = 0 }: { children?: ReactNode; dim?: number }) {
  const { state } = usePhone();
  return (
    <LinearGradient colors={wallpapers[state.wallpaper].colors} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}>
      {dim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />}
      {children}
    </LinearGradient>
  );
}

/** Barre d’état du téléphone fictif : heure, réseau, batterie. */
export function PhoneStatusBar({ tint = colors.text }: { tint?: string }) {
  const now = useNow(10_000);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.status, { paddingTop: insets.top + 6 }]}>
      <Text style={[styles.statusText, { color: tint }]}>{clock(now)}</Text>
      <View style={styles.statusRight}>
        <View style={styles.signal}>
          {[5, 8, 11, 14].map((h) => (
            <View key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: tint }} />
          ))}
        </View>
        <Text style={[styles.statusText, { color: tint }]}>CorailTel 5G</Text>
        <View style={[styles.battery, { borderColor: tint }]}>
          <View style={{ width: '78%', height: '100%', borderRadius: 1.5, backgroundColor: tint }} />
        </View>
      </View>
    </View>
  );
}

/** Cadre d’une appli : barre d’état, en-tête coloré avec retour, contenu, barre de navigation. */
export function AppScreen({
  title,
  color,
  children,
  right,
  back = 'home',
}: {
  title: string;
  color: string;
  children: ReactNode;
  right?: ReactNode;
  back?: 'home' | 'pop';
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PhoneStatusBar />
      <View style={styles.header}>
        <Pressable
          hitSlop={12}
          onPress={() => (back === 'pop' && router.canGoBack() ? router.back() : router.navigate('/home'))}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Text style={[styles.back, { color }]}>‹</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ minWidth: 28, alignItems: 'flex-end' }}>{right}</View>
      </View>
      <View style={[styles.accent, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>{children}</View>
      <HomeIndicator bottom={insets.bottom} />
    </View>
  );
}

/** Barre en bas de l’écran : un appui ramène à l’accueil, comme un vrai téléphone. */
export function HomeIndicator({ bottom }: { bottom: number }) {
  return (
    <Pressable
      onPress={() => router.navigate('/home')}
      style={{ paddingBottom: Math.max(bottom, 8), paddingTop: 8, alignItems: 'center' }}
      accessibilityRole="button"
      accessibilityLabel="Accueil"
    >
      <View style={styles.indicator} />
    </Pressable>
  );
}

export function Avatar({ emoji, color, size = 44 }: { emoji: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}33`, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

export function Badge({ count, style }: { count: number; style?: ViewStyle }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export function Button({ label, onPress, color = colors.pink, disabled, outline }: { label: string; onPress: () => void; color?: string; disabled?: boolean; outline?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        outline ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color },
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, outline && { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Notification qui glisse depuis le haut ; un appui ouvre l’appli concernée. */
export function NotificationBanner() {
  const { banner, dismissBanner, unlocked } = usePhone();
  const insets = useSafeAreaInsets();
  const [y] = useState(() => new Animated.Value(-160));

  useEffect(() => {
    if (!banner) return;
    y.setValue(-160);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: -160, duration: 250, useNativeDriver: true }).start(() => dismissBanner());
    }, 4500);
    return () => clearTimeout(t);
  }, [banner, y, dismissBanner]);

  // Sur l’écran verrouillé, les notifications s’affichent dans la liste de l’écran de verrouillage.
  if (!banner || !unlocked) return null;
  return (
    <Animated.View style={[styles.bannerWrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <Pressable
        style={styles.banner}
        onPress={() => {
          dismissBanner();
          router.navigate(banner.route as never);
        }}
      >
        <View style={[styles.bannerIcon, { backgroundColor: banner.color }]}>
          <Text style={{ fontSize: 18 }}>{banner.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerApp}>{banner.app.toUpperCase()} · maintenant</Text>
          <Text style={styles.bannerTitle} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.bannerBody} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const styles = StyleSheet.create({
  status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 6 },
  statusText: { fontSize: 13, fontWeight: '600' },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signal: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  battery: { width: 24, height: 12, borderWidth: 1.5, borderRadius: 3, padding: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 12 },
  back: { fontSize: 38, lineHeight: 40, fontWeight: '300', width: 28 },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800' },
  accent: { height: 2, opacity: 0.8 },
  indicator: { width: 128, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  button: { paddingVertical: 13, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bannerWrap: { position: 'absolute', left: 10, right: 10, zIndex: 100 },
  banner: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 20, backgroundColor: 'rgba(30,22,50,0.97)', borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  bannerIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bannerApp: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  bannerTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 1 },
  bannerBody: { color: colors.text, fontSize: 14, opacity: 0.85 },
});
