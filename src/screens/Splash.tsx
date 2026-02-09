import { StyleSheet, Text, View, StatusBar } from 'react-native';
import { colors } from '../theme';

export const Splash = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.emoji}>🔥</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.cardBackground,
  },
  emoji: {
    fontSize: 64,
  },
});
