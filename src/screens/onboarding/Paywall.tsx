import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
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
import { Button } from '../../components';
import { ListItem } from '../../components/ListItem';
import { colors, spacing, typography, borderRadius } from '../../theme';
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
          <ActivityIndicator size="large" color={colors.primary.blue} />
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
          <X size={24} color={colors.dark.textSecondary} />
        </Pressable>
        <Pressable onPress={handleRestore} disabled={isPurchasing}>
          <Text style={styles.restoreText}>Restore Purchase</Text>
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
                <Text style={styles.bestValueText}>Best Value</Text>
              </View>
              <Text style={styles.packageTitle}>Annual</Text>
              <Text style={styles.packagePrice}>
                {annualPackage.product.priceString} / year{' '}
                {getTrialText(annualPackage)} {getMonthlyPrice(annualPackage)}
              </Text>
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
              <Text style={styles.packageTitleMonthly}>Monthly</Text>
              <Text style={styles.packagePriceMonthly}>
                {monthlyPackage.product.priceString} / month{' '}
                {getTrialText(monthlyPackage)}
              </Text>
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
        <Text style={styles.cancelText}>Cancel anytime in Settings</Text>
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
  restoreText: {
    ...typography.styles.light.link,
    color: colors.dark.textSecondary,
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
    backgroundColor: colors.primary.orange,
  },
  packageCardMonthly: {
    backgroundColor: colors.neutral.white,
    borderColor: colors.neutral.gray200,
  },
  packageCardSelected: {
    borderColor: colors.neutral.white,
  },
  packageCardMonthlySelected: {
    borderColor: colors.primary.blue,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.sm,
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
  },
  bestValueText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.orange,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral.white,
    marginBottom: spacing.xxs,
  },
  packagePrice: {
    fontSize: 14,
    color: colors.neutral.white,
  },
  packageTitleMonthly: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  packagePriceMonthly: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  bottom: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.styles.light.caption,
    color: colors.dark.textSecondary,
  },
});
