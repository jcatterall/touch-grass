import { ListRenderItemInfo, View, Dimensions, StyleSheet } from 'react-native';
import { spacing } from '../../theme';
import { useCallback, useRef, useState } from 'react';
import { Button, Carousel, CarouselRef, Typography } from '../../components';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';

export interface WhyProps {
  onComplete: () => void;
  onBack?: () => void;
}

interface CarouselItem {
  id: string;
  title: string;
  subTitle: string;
}

const onboardingSlides: CarouselItem[] = [
  {
    id: '1',
    title: 'Everything your mind needs',
    subTitle:
      'Stress less, sleep soundly, and get one-on-one support to feel your best. Explore hundreds of exercises, courses, and guided programs designed to help you live a healthier, happier life.',
  },
  {
    id: '2',
    title: 'Support on your schedule',
    subTitle:
      "Navigate life's ups and downs with a mental health coach, a therapist, or Ebb, your empathetic AI companion.",
  },
  {
    id: '3',
    title: 'Loved by millions. Backed by science.',
    subTitle:
      'Join members around the world who are feeling the benefits. Headspace has been proven to decrease stress and increase happiness in just 10 days.',
  },
];

export const Why = ({ onComplete }: WhyProps) => {
  const carouselRef = useRef<CarouselRef>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number>(
    Dimensions.get('window').width - spacing.xl * 2,
  );

  const continueClicked = useCallback(() => {
    const isLastPage = currentPage === onboardingSlides.length - 1;

    isLastPage
      ? onComplete()
      : carouselRef.current?.scrollToPage(currentPage + 1);
  }, [currentPage, onComplete]);

  const renderOnboardingItem = useCallback(
    ({ item }: ListRenderItemInfo<CarouselItem>) => {
      return (
        <View style={styles.onboardingItem}>
          <Typography variant="heading" center>
            {item.title}
          </Typography>
          <Typography variant="subtitle" color="secondary" center>
            {item.subTitle}
          </Typography>
        </View>
      );
    },
    [],
  );

  return (
    <OnboardingContainer>
      <View
        style={styles.flex}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <Carousel
          itemWidth={containerWidth || Dimensions.get('window').width}
          ref={carouselRef}
          style={styles.flex}
          data={onboardingSlides}
          renderItem={renderOnboardingItem}
          keyExtractor={item => item.id}
          showPagination={true}
          paginationVariant="dots"
          paginationActiveColor="blue"
          onPageChange={setCurrentPage}
          paginationContainerStyle={styles.pagination}
        />
      </View>
      <View>
        <Button size="lg" onPress={continueClicked}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pagination: {
    marginBottom: spacing.xxxxl,
  },
  onboardingItem: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.md,
  },
});
