import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button } from '../../components';
import { ListItem } from '../../components/ListItem';
import { spacing, typography } from '../../theme';
import { Flame, X } from 'lucide-react-native';

export interface PaywallProps {
  onComplete: () => void;
}

export const Paywall = ({ onComplete }: PaywallProps) => {
  const continueClicked = () => {
    console.log('Subscription logic'); //TODO: trigger subscription logic
  };

  const skipClicked = () => {
    onComplete();
  };

  return (
    <OnboardingContainer>
      <View style={styles.outer}>
        <X onPress={skipClicked} />
        <Text style={typography.styles.light.link}>Restore Purchase</Text>
      </View>

      <View style={styles.top}>
        <View style={styles.image}>
          <Flame size={126} />
        </View>
        <View>
          <ListItem value="Enjoy the full experience" />
          <ListItem value="Cancel anytime from the app or Google Play" />
          <ListItem value="Be better everyday" />
          <ListItem value="No ads, no watermarks" />
          <ListItem value="Enjoy the full experience" />
          <ListItem value="Only £5/month, billed annually" />
        </View>
      </View>
      <View style={styles.bottom}>
        <Text
          style={{ ...typography.styles.light.body, ...styles.textCentered }}
        >
          Just £5/month
        </Text>
        <Button size="lg" onPress={continueClicked}>
          Continue
        </Button>
        <View style={styles.splitContainer}>
          <Text style={typography.styles.light.link}>Terms & Conditions</Text>
          <Text style={typography.styles.light.link}>Privacy Policy</Text>
        </View>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  top: {
    flex: 1,
    gap: spacing.md,
  },
  image: {
    display: 'flex',
    alignItems: 'center',
  },
  bottom: {
    gap: spacing.sm,
  },
  splitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  textCentered: {
    textAlign: 'center',
  },
});
