import { StyleSheet, View } from 'react-native';
import { Typography } from '../../components';
import { colors, spacing } from '../../theme';

export const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Typography mode="dark" variant="heading">
        Home
      </Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.cardBackground,
    padding: spacing.lg,
  },
});
