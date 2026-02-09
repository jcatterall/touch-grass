import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, LockOpen, User } from 'lucide-react-native';
import { Typography } from '../../components';
import { colors, spacing } from '../../theme';
import { HomeScreen } from './HomeScreen';
import { UnblockScreen } from './UnblockScreen';
import { YouScreen } from './YouScreen';

type Tab = 'home' | 'unblock' | 'you';

const TABS: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'unblock', label: 'Unblock', icon: LockOpen },
  { key: 'you', label: 'You', icon: User },
];

export const MainApp = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const insets = useSafeAreaInsets();

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'unblock':
        return <UnblockScreen />;
      case 'you':
        return <YouScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      <View style={[styles.tabBar, { paddingBottom: insets.bottom || spacing.xs }]}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          const color = isActive ? colors.white : colors.dark30;

          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon size={24} color={color} />
              <Typography
                mode="dark"
                variant="body"
                color={isActive ? 'primary' : 'disabled'}
                style={styles.tabLabel}
              >
                {tab.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>
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
    backgroundColor: colors.dark80,
    borderTopWidth: 1,
    borderTopColor: colors.dark60,
    paddingTop: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  tabLabel: {
    fontSize: 11,
  },
});
