import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { Typography } from './Typography';
import { Button } from './Button';
import { borderRadius, colors, spacing } from '../theme';

type ConfirmModalAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'link';
};

export interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  actions?: ConfirmModalAction[];
  customActions?: ReactNode;
}

export const ConfirmModal = ({
  visible,
  onClose,
  title,
  subtitle,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  actions,
  customActions,
}: ConfirmModalProps) => {
  const hasCustomActions =
    !!customActions || (Array.isArray(actions) && actions.length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Typography variant="title" color="primary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body" style={{ marginTop: spacing.xs }}>
              {subtitle}
            </Typography>
          )}
          {hasCustomActions ? (
            <View style={styles.customActionsContainer}>
              {customActions}
              {actions?.map(action => (
                <Button
                  key={action.label}
                  variant={action.variant ?? 'secondary'}
                  size="sm"
                  onPress={() => {
                    action.onPress();
                    onClose();
                  }}
                >
                  {action.label}
                </Button>
              ))}
              <Button variant="secondary" size="sm" onPress={onClose}>
                {cancelLabel}
              </Button>
            </View>
          ) : (
            <View style={styles.actions}>
              <View style={styles.buttonWrapper}>
                <Button variant="secondary" size="sm" onPress={onClose}>
                  {cancelLabel}
                </Button>
              </View>
              <View style={styles.buttonWrapper}>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    onConfirm?.();
                    onClose();
                  }}
                >
                  {confirmLabel}
                </Button>
              </View>
            </View>
          )}
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
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    width: '75%',
    padding: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  buttonWrapper: {
    flex: 1,
  },
  customActionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
