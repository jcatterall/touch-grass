import { useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Search, Square, CheckSquare, X } from 'lucide-react-native';
import { Main } from '../components/layout/Main';
import { Button, Typography } from '../components';
import { colors, spacing, borderRadius, textStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import { getAllInstalledApps } from '../native/AppListModule';

export interface AppItem {
  id: string;
  name: string;
  icon?: string;
}

export interface BlocklistScreenProps {
  selectedApps?: AppItem[];
  onSave: (selectedApps: AppItem[]) => void;
  onClose: () => void;
}

export const BlocklistScreen = ({
  selectedApps: initialSelectedApps = [],
  onSave,
  onClose,
}: BlocklistScreenProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(
    new Set(initialSelectedApps.map(app => app.id)),
  );
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApps() {
      try {
        const installedApps = await getAllInstalledApps();
        setApps(
          installedApps.map(app => ({
            id: app.id,
            name: app.name,
            icon: app.icon,
          })),
        );
      } catch (error) {
        console.error('Failed to load installed apps:', error);
      } finally {
        setLoading(false);
      }
    }

    loadApps();
  }, []);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;
    const query = searchQuery.toLowerCase();
    return apps.filter(app => app.name.toLowerCase().includes(query));
  }, [searchQuery, apps]);

  const toggleAppSelection = (appId: string) => {
    triggerHaptic('selection');
    setSelectedAppIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const handleSave = () => {
    triggerHaptic('impactMedium');
    const selectedApps = apps.filter(app => selectedAppIds.has(app.id));
    onSave(selectedApps);
  };

  const renderAppItem = ({ item: app }: { item: AppItem }) => {
    const isSelected = selectedAppIds.has(app.id);

    return (
      <Pressable
        style={styles.appRow}
        onPress={() => toggleAppSelection(app.id)}
      >
        <View style={styles.appLeft}>
          <Image source={{ uri: app.icon }} style={styles.appIconImage} />
          <Typography
            variant="subtitle"
            style={styles.appName}
            numberOfLines={1}
          >
            {app.name}
          </Typography>
        </View>
        {isSelected ? (
          <CheckSquare size={24} color={colors.white} />
        ) : (
          <Square size={24} color={colors.oatmeal} />
        )}
      </Pressable>
    );
  };

  return (
    <Main style={styles.main}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={24} color={colors.white} />
          </Pressable>
          {isSearchVisible ? (
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search apps..."
              placeholderTextColor={colors.white}
              autoFocus
              onBlur={() => {
                if (!searchQuery) setIsSearchVisible(false);
              }}
            />
          ) : (
            <Typography variant="title" style={styles.title}>
              Blocklist
            </Typography>
          )}
          {isSearchVisible && searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={24} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setIsSearchVisible(!isSearchVisible)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Search size={24} color={colors.white} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.skyBlue} />
            <Typography variant="body">Loading apps...</Typography>
          </View>
        ) : (
          <FlatList
            data={filteredApps}
            renderItem={renderAppItem}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Typography variant="subtitle">
                  {searchQuery ? 'No apps found' : 'No apps available'}
                </Typography>
              </View>
            }
          />
        )}

        <View style={styles.footer}>
          <Button size="lg" onPress={handleSave}>
            Save
          </Button>
        </View>
      </View>
    </Main>
  );
};

const styles = StyleSheet.create({
  main: {
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  title: {
    flex: 1,
    marginLeft: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.white,
    color: colors.white,
    ...textStyles.body,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.white,
  },
  appLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appIconImage: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
  },
  appName: {
    flex: 1,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
});

export default BlocklistScreen;
