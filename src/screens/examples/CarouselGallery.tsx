/**
 * CarouselGallery - Showcase screen for Carousel and Pagination components
 *
 * Displays various carousel configurations including a Welcome Onboarding demo
 * with expanding pill-shaped indicators following Headspace design patterns.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Carousel, type CarouselRef } from '../../components/Carousel';
import { Colors, Spacing } from '../../theme/theme';

// =============================================================================
// TYPES
// =============================================================================

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
  emoji: string;
}

interface FeatureSlide {
  id: string;
  title: string;
  description: string;
  color: string;
}

// =============================================================================
// DATA
// =============================================================================

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to Mindfulness',
    subtitle: 'Start your journey to a calmer, more focused you.',
    backgroundColor: '#E8EBFF',
    emoji: '🧘',
  },
  {
    id: '2',
    title: 'Daily Meditation',
    subtitle: 'Build a habit with just 10 minutes a day.',
    backgroundColor: '#FFF0E8',
    emoji: '☀️',
  },
  {
    id: '3',
    title: 'Sleep Better',
    subtitle: 'Drift off with soothing sounds and guided sleep.',
    backgroundColor: '#E8F4FF',
    emoji: '🌙',
  },
  {
    id: '4',
    title: 'Track Progress',
    subtitle: 'See your mindfulness journey unfold over time.',
    backgroundColor: '#E8FFE8',
    emoji: '📊',
  },
  {
    id: '5',
    title: "Let's Begin",
    subtitle: 'Your path to inner peace starts now.',
    backgroundColor: '#FFF8E8',
    emoji: '🚀',
  },
];

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: '1',
    title: 'Meditation',
    description: 'Guided sessions',
    color: Colors.primaryBlue,
  },
  { id: '2', title: 'Sleep', description: 'Restful nights', color: '#6B7FFF' },
  {
    id: '3',
    title: 'Focus',
    description: 'Deep work mode',
    color: Colors.orange,
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// =============================================================================
// ONBOARDING CAROUSEL DEMO
// =============================================================================

const OnboardingDemo: React.FC = () => {
  const carouselRef = useRef<CarouselRef>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const isLastSlide = currentPage === ONBOARDING_SLIDES.length - 1;

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      console.log('Onboarding complete!');
    } else {
      carouselRef.current?.scrollToPage(currentPage + 1);
    }
  }, [currentPage, isLastSlide]);

  const renderOnboardingItem = useCallback(
    ({ item }: ListRenderItemInfo<OnboardingSlide>) => (
      <View
        style={[
          styles.onboardingSlide,
          { backgroundColor: item.backgroundColor },
        ]}
      >
        <Text style={styles.onboardingEmoji}>{item.emoji}</Text>
        <Text style={styles.onboardingTitle}>{item.title}</Text>
        <Text style={styles.onboardingSubtitle}>{item.subtitle}</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>Welcome Onboarding</Text>
      <Text style={styles.demoSubtitle}>
        Expanding pill indicators (dots variant)
      </Text>

      <View style={styles.onboardingContainer}>
        <Carousel
          ref={carouselRef}
          data={ONBOARDING_SLIDES}
          renderItem={renderOnboardingItem}
          keyExtractor={item => item.id}
          height={340}
          showPagination={true}
          paginationVariant="dots"
          paginationActiveColor="blue"
          onPageChange={setCurrentPage}
          paginationContainerStyle={styles.onboardingPagination}
        />

        <View style={styles.onboardingActions}>
          <Button
            variant="primary"
            size="lg"
            shape="pill"
            onPress={handleNext}
            style={styles.onboardingButton}
          >
            {isLastSlide ? 'Get Started' : 'Continue'}
          </Button>
        </View>
      </View>
    </View>
  );
};

// =============================================================================
// BARS VARIANT DEMO
// =============================================================================

const BarsVariantDemo: React.FC = () => {
  const renderFeatureItem = useCallback(
    ({ item }: ListRenderItemInfo<FeatureSlide>) => (
      <View style={[styles.featureSlide, { backgroundColor: item.color }]}>
        <Text style={styles.featureTitle}>{item.title}</Text>
        <Text style={styles.featureDescription}>{item.description}</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>Feature Highlights</Text>
      <Text style={styles.demoSubtitle}>Bars variant with orange accent</Text>

      <View style={styles.featureContainer}>
        <Carousel
          data={FEATURE_SLIDES}
          renderItem={renderFeatureItem}
          keyExtractor={item => item.id}
          height={160}
          showPagination={true}
          paginationVariant="bars"
          paginationActiveColor="orange"
          paginationContainerStyle={styles.featurePagination}
        />
      </View>
    </View>
  );
};

// =============================================================================
// DARK MODE DEMO
// =============================================================================

interface DarkSlide {
  id: string;
  label: string;
}

const DARK_SLIDES: DarkSlide[] = [
  { id: '1', label: 'Night Mode 1' },
  { id: '2', label: 'Night Mode 2' },
  { id: '3', label: 'Night Mode 3' },
  { id: '4', label: 'Night Mode 4' },
];

const DarkModeDemo: React.FC = () => {
  const renderDarkItem = useCallback(
    ({ item }: ListRenderItemInfo<DarkSlide>) => (
      <View style={styles.darkSlide}>
        <Text style={styles.darkSlideText}>{item.label}</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={[styles.demoContainer, styles.darkDemoContainer]}>
      <Text style={[styles.demoTitle, styles.darkText]}>Dark Mode</Text>
      <Text style={[styles.demoSubtitle, styles.darkSubtext]}>
        Pagination adapts to dark theme
      </Text>

      <View style={styles.darkCarouselContainer}>
        <Carousel
          data={DARK_SLIDES}
          renderItem={renderDarkItem}
          keyExtractor={item => item.id}
          height={120}
          showPagination={true}
          paginationVariant="dots"
          paginationActiveColor="blue"
          mode="dark"
          paginationContainerStyle={styles.darkPagination}
        />
      </View>
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CarouselGallery: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.scrollView}>
        <Text style={styles.pageTitle}>Carousel Gallery</Text>
        <Text style={styles.pageSubtitle}>
          Headspace Design System Carousel & Pagination
        </Text>

        <OnboardingDemo />
        <BarsVariantDemo />
        <DarkModeDemo />
      </View>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
    padding: Spacing.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.charcoal,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: Spacing.xl,
  },

  // Demo Container
  demoContainer: {
    marginBottom: Spacing.xxl,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.charcoal,
    marginBottom: 4,
  },
  demoSubtitle: {
    fontSize: 13,
    color: '#888888',
    marginBottom: Spacing.md,
  },

  // Onboarding Demo
  onboardingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  onboardingSlide: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  onboardingEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.charcoal,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  onboardingSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  onboardingPagination: {
    bottom: 100,
  },
  onboardingActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: 'transparent',
  },
  onboardingButton: {
    width: '100%',
  },

  // Feature Demo
  featureContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureSlide: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  featurePagination: {
    bottom: 16,
  },

  // Dark Mode Demo
  darkDemoContainer: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  darkText: {
    color: '#FFFFFF',
  },
  darkSubtext: {
    color: '#B0B0B0',
  },
  darkCarouselContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  darkSlide: {
    width: SCREEN_WIDTH - Spacing.lg * 4,
    height: 120,
    backgroundColor: '#3D3D47',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  darkSlideText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E0E0E0',
  },
  darkPagination: {
    bottom: 12,
  },
});

export default CarouselGallery;
