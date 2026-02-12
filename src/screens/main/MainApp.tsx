import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, LockOpen, Notebook, User, X } from 'lucide-react-native';
import { colors, spacing } from '../../theme';
import { HomeScreen } from './HomeScreen';
import { UnblockScreen } from './UnblockScreen';
import { YouScreen } from './YouScreen';
import { Plan } from '../onboarding/Plan';
import { Typography } from '../../components';

type Tab = 'plan' | 'unblock' | 'you';

const TABS: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: 'plan', label: 'Plan', icon: Notebook },
  { key: 'unblock', label: 'Unblock', icon: LockOpen },
  { key: 'you', label: 'You', icon: User },
];

export const MainApp = () => {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (activeTab === null) return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveTab(null);
      return true;
    });

    return () => handler.remove();
  }, [activeTab]);

  const renderOverlay = () => {
    switch (activeTab) {
      case 'plan':
        return <Plan onComplete={() => setActiveTab(null)} plan={null} />;
      case 'unblock':
        return <UnblockScreen />;
      case 'you':
        return <YouScreen />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <HomeScreen />
      </View>

      <View
        style={[styles.tabBar, { paddingBottom: insets.bottom || spacing.xs }]}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
            >
              <View style={styles.tabContent}>
                <Icon size={24} color={colors.white} />
                <Typography
                  variant="link"
                  color={isActive ? 'primary' : 'disabled'}
                >
                  {tab.label}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>

      {activeTab !== null && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <View
            style={[
              styles.overlayHeader,
              { paddingTop: insets.top + spacing.xs },
            ]}
          >
            <Pressable onPress={() => setActiveTab(null)} hitSlop={8}>
              <X size={24} color={colors.white} />
            </Pressable>
            <Typography variant="subtitle">
              {TABS.find(t => t.key === activeTab)?.label}
            </Typography>
          </View>
          <View style={styles.overlayContent}>{renderOverlay()}</View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  tabContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  overlay: {
    zIndex: 10,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  overlayContent: {
    flex: 1,
  },
});
