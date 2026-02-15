import { EllipsisVertical } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { OverlayMenu, OverlayMenuItem } from './OverlayMenu';
import { useState } from 'react';
import { colors, spacing } from '../theme';

interface MenuProps {
  items: OverlayMenuItem[];
}

export const Menu = ({ items }: MenuProps) => {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View>
      <Pressable style={styles.button} onPress={() => setMenuVisible(true)}>
        <EllipsisVertical size={18} color={colors.white} />
      </Pressable>
      <OverlayMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={items}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: spacing.xs,
  },
});
