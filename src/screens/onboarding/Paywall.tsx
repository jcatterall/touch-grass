import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Purchases, {
  PurchasesPackage,
  PurchasesOffering,
} from 'react-native-purchases';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, Typography } from '../../components';
import { ListItem } from '../../components/ListItem';
import { colors, spacing, borderRadius } from '../../theme';
import { X } from 'lucide-react-native';

export interface PaywallProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const Paywall = ({ onComplete }: PaywallProps) => {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);

  useEffect(() => {
    const fetchOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current) {
          setOffering(offerings.current);

          const metadataFeatures = offerings.current.metadata?.features;
          if (Array.isArray(metadataFeatures)) {
            setFeatures(metadataFeatures);
          }

          const annual = offerings.current.annual;
          const monthly = offerings.current.monthly;
          setSelectedPackage(annual || monthly || null);
        }
      } catch (error) {
        console.error('Error fetching offerings:', error);
        Alert.alert('Error', 'Failed to load subscription options');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOfferings();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      if (
        customerInfo.entitlements.active.premium ||
        Object.keys(customerInfo.entitlements.active).length > 0
      ) {
        onComplete();
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (Object.keys(customerInfo.entitlements.active).length > 0) {
        Alert.alert('Success', 'Your purchase has been restored!');
        onComplete();
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Something went wrong');
    } finally {
      setIsPurchasing(false);
    }
  };

  const skipClicked = () => {
    onComplete();
  };

  const getTrialText = (pkg: PurchasesPackage) => {
    const intro = pkg.product.introPrice;
    if (intro && intro.periodNumberOfUnits > 0) {
      return `after ${intro.periodNumberOfUnits} day trial`;
    }
    return '';
  };

  const getMonthlyPrice = (pkg: PurchasesPackage) => {
    if (pkg.packageType === 'ANNUAL' && pkg.product.pricePerMonthString) {
      return `(${pkg.product.pricePerMonthString}/month)`;
    }
    return '';
  };

  if (isLoading) {
    return (
      <OnboardingContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.secondary60} />
        </View>
      </OnboardingContainer>
    );
  }

  const annualPackage = offering?.annual;
  const monthlyPackage = offering?.monthly;

  return (
    <OnboardingContainer>
      <View style={styles.header}>
        <Pressable onPress={skipClicked} hitSlop={8}>
          <X size={24} color={colors.dark20} />
        </Pressable>
        <Pressable onPress={handleRestore} disabled={isPurchasing}>
          <Typography variant="link" color="secondary">
            Restore Purchase
          </Typography>
        </Pressable>
      </View>

      <View style={styles.content}>
        {features.length > 0 && (
          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <ListItem key={index} value={feature} />
            ))}
          </View>
        )}

        <View style={styles.packagesContainer}>
          {annualPackage && (
            <Pressable
              style={[
                styles.packageCard,
                styles.packageCardAnnual,
                selectedPackage?.identifier === annualPackage.identifier &&
                  styles.packageCardSelected,
              ]}
              onPress={() => setSelectedPackage(annualPackage)}
            >
              <View style={styles.bestValueBadge}>
                <Typography variant="body" style={styles.bestValueText}>
                  Best Value
                </Typography>
              </View>
              <Typography variant="subtitle" color="inverse">
                Annual
              </Typography>
              <Typography variant="body" color="inverse">
                {annualPackage.product.priceString} / year{' '}
                {getTrialText(annualPackage)} {getMonthlyPrice(annualPackage)}
              </Typography>
            </Pressable>
          )}

          {monthlyPackage && (
            <Pressable
              style={[
                styles.packageCard,
                styles.packageCardMonthly,
                selectedPackage?.identifier === monthlyPackage.identifier &&
                  styles.packageCardMonthlySelected,
              ]}
              onPress={() => setSelectedPackage(monthlyPackage)}
            >
              <Typography variant="subtitle">Monthly</Typography>
              <Typography variant="body" color="secondary">
                {monthlyPackage.product.priceString} / month{' '}
                {getTrialText(monthlyPackage)}
              </Typography>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          size="lg"
          onPress={handlePurchase}
          disabled={!selectedPackage || isPurchasing}
        >
          {isPurchasing ? 'Processing...' : 'Try free and subscribe'}
        </Button>
        <Typography variant="body" color="tertiary">
          Cancel anytime in Settings
        </Typography>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  featuresList: {
    marginBottom: spacing.lg,
  },
  packagesContainer: {
    gap: spacing.sm,
  },
  packageCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardAnnual: {
    backgroundColor: colors.primary60,
  },
  packageCardMonthly: {
    backgroundColor: colors.white,
    borderColor: colors.neutral20,
  },
  packageCardSelected: {
    borderColor: colors.white,
  },
  packageCardMonthlySelected: {
    borderColor: colors.secondary60,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
  },
  bestValueText: {
    color: colors.primary60,
  },
  bottom: {
    gap: spacing.sm,
    alignItems: 'center',
  },
});
