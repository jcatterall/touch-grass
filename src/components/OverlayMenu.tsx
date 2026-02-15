import { useCallback, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Typography } from './Typography';
import { borderRadius, colors, spacing } from '../theme';

export interface OverlayMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface OverlayMenuProps {
  visible: boolean;
  onClose: () => void;
  items: OverlayMenuItem[];
}

const FADE_DURATION = 300;

export const OverlayMenu = ({ visible, onClose, items }: OverlayMenuProps) => {
  const pendingAction = useRef<(() => void) | null>(null);

  const flushPendingAction = useCallback(() => {
    if (pendingAction.current) {
      pendingAction.current();
      pendingAction.current = null;
    }
  }, []);

  const selectItem = useCallback(
    (onPress: () => void) => {
      pendingAction.current = onPress;
      onClose();
      if (Platform.OS === 'android') {
        setTimeout(flushPendingAction, FADE_DURATION);
      }
    },
    [onClose, flushPendingAction],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={flushPendingAction}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.menu}>
          {items.map((item, index) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                index < items.length - 1 && styles.menuItemBorder,
                pressed && styles.menuItemPressed,
              ]}
              onPress={() => selectItem(item.onPress)}
            >
              <Typography
                variant="subtitle"
                color={item.destructive ? 'error' : 'primary'}
                style={{ textAlign: 'center' }}
              >
                {item.label}
              </Typography>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    width: '75%',
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItemPressed: {
    opacity: 0.6,
  },
});
