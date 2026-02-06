import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { ReactNode } from 'react';
import { Main } from '../layout/Main';

export const OnboardingContainer = ({ children }: { children: ReactNode }) => {
  return (
    <Main style={{ padding: spacing.xl }}>
      <View style={styles.containerStyle}>{children}</View>
    </Main>
  );
};

const styles = StyleSheet.create({
  containerStyle: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: colors.dark.cardBackground,
  },
});
