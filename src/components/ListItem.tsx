import { CircleCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Typography } from './Typography';

interface ListItemProps {
  value: string;
}

export const ListItem = ({ value }: ListItemProps) => {
  return (
    <View style={styles.container}>
      <CircleCheck
        size={24}
        color={colors.white}
        fill={colors.terracotta}
        strokeWidth={2}
      />
      <Typography variant="subtitle">
        {value}
      </Typography>
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
