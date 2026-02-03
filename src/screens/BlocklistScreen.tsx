import { useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Search, Square, CheckSquare } from 'lucide-react-native';
import { Main } from '../layout/Main';
import { Button } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import { getAllInstalledApps } from '../native/AppListModule';

export interface AppItem {
  id: string;
  name: string;
  icon?: string;
}

export interface BlocklistScreenProps {
  selectedAppIds?: string[];
  onSave: (selectedAppIds: string[]) => void;
  onClose: () => void;
}

// Generate a consistent color from app name for fallback
function getAppColor(name: string): string {
  const colors = [
    '#E4405F', '#1877F2', '#25D366', '#FF0000', '#1DB954',
    '#5865F2', '#FF4500', '#0088CC', '#E50914', '#9146FF',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const BlocklistScreen = ({
  selectedAppIds: initialSelectedIds = [],
  onSave,
  onClose,
}: BlocklistScreenProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(
    new Set(initialSelectedIds)
  );
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load installed apps on mount
  useEffect(() => {
    async function loadApps() {
      try {
        const installedApps = await getAllInstalledApps();
        setApps(
          installedApps.map(app => ({
            id: app.id,
            name: app.name,
            icon: app.icon,
          }))
        );
      } catch (error) {
        console.error('Failed to load installed apps:', error);
      } finally {
        setLoading(false);
      }
    }
    loadApps();
  }, []);

  // Filter apps based on search query
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
    onSave(Array.from(selectedAppIds));
  };

  const renderAppItem = ({ item: app }: { item: AppItem }) => {
    const isSelected = selectedAppIds.has(app.id);

    return (
      <Pressable
        style={styles.appRow}
        onPress={() => toggleAppSelection(app.id)}
      >
        <View style={styles.appLeft}>
          {app.icon ? (
            <Image
              source={{ uri: app.icon }}
              style={styles.appIconImage}
            />
          ) : (
            <View style={[styles.appIcon, { backgroundColor: getAppColor(app.name) }]}>
              <Text style={styles.appIconText}>
                {app.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.appName} numberOfLines={1}>
            {app.name}
          </Text>
        </View>
        {isSelected ? (
          <CheckSquare size={24} color={colors.primary.blue} fill={colors.primary.blue} />
        ) : (
          <Square size={24} color={colors.dark.textTertiary} />
        )}
      </Pressable>
    );
  };

  return (
    <Main style={styles.main}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={24} color={colors.primary.blue} />
          </Pressable>
          {isSearchVisible ? (
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search apps..."
              placeholderTextColor={colors.dark.textTertiary}
              autoFocus
              onBlur={() => {
                if (!searchQuery) setIsSearchVisible(false);
              }}
            />
          ) : (
            <Text style={styles.title}>Blocklist</Text>
          )}
          <Pressable
            onPress={() => setIsSearchVisible(!isSearchVisible)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Search size={24} color={colors.primary.blue} />
          </Pressable>
        </View>

        {/* App List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.blue} />
            <Text style={styles.loadingText}>Loading apps...</Text>
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
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No apps found' : 'No apps available'}
                </Text>
              </View>
            }
          />
        )}

        {/* Save Button */}
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
    backgroundColor: colors.dark.background,
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
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark.textPrimary,
    marginLeft: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: colors.dark.textPrimary,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary.blue,
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
  },
  appLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconImage: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
  },
  appIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.white,
  },
  appName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: colors.dark.textPrimary,
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
  loadingText: {
    fontSize: 16,
    color: colors.dark.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: colors.dark.textTertiary,
  },
});

export default BlocklistScreen;
