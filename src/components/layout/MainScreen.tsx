import { Pressable, StyleSheet, View } from 'react-native';
import Typography from '../Typography';
import { X } from 'lucide-react-native';
import { colors, spacing } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MainScreenProps {
  onClose: () => void;
  label: string;
  children?: React.ReactNode;
  header?: React.ReactNode;
}

export const MainScreen = ({
  onClose,
  label,
  children,
  header,
}: MainScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
      <View style={[styles.overlayHeader]}>
        <View style={styles.navigationContainer}>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={24} color={colors.white} />
          </Pressable>
          <Typography variant="subtitle">{label}</Typography>
        </View>
        {header && header}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
