import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn, Crown, Home, Notebook } from 'lucide-react-native';
import { colors, spacing } from '../../theme';
import { HomeScreen } from './HomeScreen';
import { MetricsScreen } from './MetricsScreen';
import { PaywallScreen } from './PaywallScreen';
import { PlanList } from './PlanList';

type Overlay = 'plan' | 'metrics' | 'paywall';

const TABS: { key: Overlay; icon: typeof Home }[] = [
  { key: 'plan', icon: Notebook },
  { key: 'metrics', icon: ChartNoAxesColumn },
];

export const MainApp = () => {
  const [activeOverlay, setActiveOverlay] = useState<Overlay | null>(null);
  const insets = useSafeAreaInsets();
  const close = () => setActiveOverlay(null);

  useEffect(() => {
    if (!activeOverlay) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [activeOverlay]);

  const renderOverlay = () => {
    switch (activeOverlay) {
      case 'plan':
        return <PlanList onClose={close} />;
      case 'metrics':
        return <MetricsScreen onClose={close} />;
      case 'paywall':
        return <PaywallScreen onClose={close} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <HomeScreen />

      <Pressable
        style={[styles.crownButton, { top: insets.top + spacing.md }]}
        onPress={() => setActiveOverlay('paywall')}
        hitSlop={8}
      >
        <Crown size={24} color={colors.white} />
      </Pressable>

      <View
        style={[styles.tabBar, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        {TABS.map(({ key, icon: Icon }) => (
          <Pressable
            key={key}
            style={styles.tab}
            onPress={() => setActiveOverlay(key)}
            hitSlop={8}
          >
            <Icon size={24} color={colors.white} />
          </Pressable>
        ))}
      </View>

      {activeOverlay && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <View style={[styles.overlayContent]}>{renderOverlay()}</View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  crownButton: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 5,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  tab: {
    padding: spacing.sm,
  },
  overlay: {
    zIndex: 10,
    backgroundColor: colors.background,
  },

  overlayContent: {
    flex: 1,
  },
});
