import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing } from '../../theme';
import Typography from '../Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NestedScreenProps {
  onClose: () => void;
  children: React.ReactNode;
  label?: string;
  header?: () => React.ReactNode;
  footer?: () => React.ReactNode;
}

export const NestedScreen = ({
  onClose,
  children,
  label,
  header,
  footer,
}: NestedScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={24} color={colors.white} />
            </Pressable>
            {label && <Typography variant="subtitle">{label}</Typography>}
          </View>

          {header && header()}
        </View>
        <View style={styles.content}>{children}</View>
        {footer && <View style={styles.footer}>{footer()}</View>}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingVertical: spacing.md,
  },
});
