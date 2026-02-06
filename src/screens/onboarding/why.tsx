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
    title: 'Break free from endless scrolling',
    subTitle:
      'TouchGrass blocks your most distracting apps until you step outside and move. Trade screen time for fresh air and reclaim hours of your day.',
  },
  {
    id: '2',
    title: 'Walk to unlock your apps',
    subTitle:
      "Set a distance or time goal, and your blocked apps stay locked until you've earned them. It's simple — the more you move, the more you unlock.",
  },
  {
    id: '3',
    title: 'Build healthier habits naturally',
    subTitle:
      'Replace mindless scrolling with mindful movement. Users reduce screen time by up to 30% in their first week while getting more steps than ever.',
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
