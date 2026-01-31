import { CircleCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface ListItemProps {
  value: string;
}

export const ListItem = ({ value }: ListItemProps) => {
  return (
    <View style={styles.container}>
      <CircleCheck
        size={28}
        color={colors.neutral.white}
        fill={colors.primary.orange}
        strokeWidth={2}
      />
      <Text style={typography.styles.light.body}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    gap: spacing.sm,
    alignContent: 'center',
    alignItems: 'center',
  },
});
