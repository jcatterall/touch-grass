import {
  ListRenderItemInfo,
  StyleProp,
  Text,
  View,
  ViewStyle,
  Dimensions,
} from 'react-native';
import Main from '../../layout/main';
import { spacing, typography } from '../../theme';
import { useCallback, useRef, useState } from 'react';
import { Button, Carousel, CarouselRef } from '../../components';

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

const containerStyle: StyleProp<ViewStyle> = {
  flex: 1,
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const paginationStyle: StyleProp<ViewStyle> = {
  marginBottom: spacing.xxxxl,
};

function Why() {
  const carouselRef = useRef<CarouselRef>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number>(
    Dimensions.get('window').width - spacing.xl * 2,
  );
  const isLastSlide = currentPage === onboardingSlides.length - 1;

  const continueClicked = useCallback(() => {
    if (isLastSlide) {
      console.log('Onboarding complete!');
    } else {
      carouselRef.current?.scrollToPage(currentPage + 1);
    }
  }, [currentPage, isLastSlide]);

  const renderOnboardingItem = useCallback(
    ({ item }: ListRenderItemInfo<CarouselItem>) => {
      const onboardingItemStyle: StyleProp<ViewStyle> = {
        flex: 1,
        flexDirection: 'column',
        gap: spacing.md,
      };
      return (
        <View style={onboardingItemStyle}>
          <Text style={{ ...typography.styles.light.title }}>{item.title}</Text>
          <Text style={{ ...typography.styles.light.body }}>
            {item.subTitle}
          </Text>
        </View>
      );
    },
    [],
  );

  return (
    <Main style={{ padding: spacing.xl }}>
      <View style={containerStyle}>
        <View
          style={{ flex: 1 }}
          onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <Carousel
            itemWidth={containerWidth || Dimensions.get('window').width}
            ref={carouselRef}
            style={{ flex: 1 }}
            data={onboardingSlides}
            renderItem={renderOnboardingItem}
            keyExtractor={item => item.id}
            showPagination={true}
            paginationVariant="dots"
            paginationActiveColor="blue"
            onPageChange={setCurrentPage}
            paginationContainerStyle={paginationStyle}
          />
        </View>
        <View>
          <Button size="lg" onPress={continueClicked}>
            Continue
          </Button>
        </View>
      </View>
    </Main>
  );
}

export default Why;
