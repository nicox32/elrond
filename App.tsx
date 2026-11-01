import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { createAccount } from './src/logic/ledger';
import { nextPrices, seedHistory } from './src/logic/prices';
import type { Account, Prices } from './src/logic/types';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { type Action, OperateScreen } from './src/screens/OperateScreen';
import { clearAccount, loadAccount, saveAccount } from './src/storage';
import { colors } from './src/theme';

type Tab = 'home' | 'operate' | 'history';

const TICK_MS = 3000;
const HISTORY_LENGTH = 40;

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Compte', icon: '◆' },
  { key: 'operate', label: 'Opérer', icon: '⇄' },
  { key: 'history', label: 'Historique', icon: '≡' },
];

function useSimulatedPrices() {
  const [history, setHistory] = useState<Prices[]>(() => seedHistory(HISTORY_LENGTH));
  useEffect(() => {
    const id = setInterval(() => {
      setHistory((h) => [...h.slice(1), nextPrices(h[h.length - 1])]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
  return { history, prices: history[history.length - 1] };
}

function Welcome({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const valid = name.trim().length > 0;
  return (
    <View style={styles.welcome}>
      <Text style={styles.logo}>◆</Text>
      <Text style={styles.brand}>Elrond</Text>
      <Text style={styles.tagline}>Le compte dont chaque euro est adossé à l’or et à l’argent.</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Ton prénom"
        placeholderTextColor={colors.textMuted}
        style={styles.welcomeInput}
        onSubmitEditing={() => valid && onCreate(name.trim())}
        returnKeyType="done"
      />
      <Pressable
        disabled={!valid}
        onPress={() => onCreate(name.trim())}
        style={[styles.welcomeButton, !valid && { opacity: 0.4 }]}
      >
        <Text style={styles.welcomeButtonText}>Ouvrir mon compte</Text>
      </Pressable>
      <Text style={styles.disclaimer}>Application de démonstration : aucun argent réel.</Text>
    </View>
  );
}

function Bank() {
  const { history, prices } = useSimulatedPrices();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('home');
  const [action, setAction] = useState<Action>('deposit');
  const loaded = useRef(false);

  useEffect(() => {
    loadAccount().then((a) => {
      setAccount(a);
      setLoading(false);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current && account) saveAccount(account);
  }, [account]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!account) {
    return <Welcome onCreate={(name) => setAccount(createAccount(name))} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && (
          <HomeScreen
            account={account}
            prices={prices}
            history={history}
            onAction={(a) => {
              setAction(a);
              setTab('operate');
            }}
            onSeeHistory={() => setTab('history')}
          />
        )}
        {tab === 'operate' && (
          <OperateScreen
            account={account}
            prices={prices}
            action={action}
            onActionChange={setAction}
            onAccountChange={setAccount}
          />
        )}
        {tab === 'history' && (
          <HistoryScreen
            account={account}
            onReset={() => {
              clearAccount();
              setAccount(null);
              setTab('home');
            }}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabIcon, active && styles.tabActive]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <Bank />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { color: colors.textMuted, fontSize: 18 },
  tabLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  tabActive: { color: colors.gold },
  welcome: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  logo: { color: colors.gold, fontSize: 48, textAlign: 'center' },
  brand: { color: colors.text, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  tagline: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 20 },
  welcomeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  welcomeButton: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  welcomeButtonText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  disclaimer: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
