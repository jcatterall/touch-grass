import {
  ListRenderItemInfo,
  StyleProp,
  Text,
  View,
  ViewStyle,
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
    title: 'Why Touch Grass?',
    subTitle: 'Because you are not a robot.',
  },
  {
    id: '2',
    title: 'Why Touch Grass?',
    subTitle: 'Because you are not a robot.',
  },
];

function Why() {
  const carouselRef = useRef<CarouselRef>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const isLastSlide = currentPage === onboardingSlides.length - 1;

  const continueClicked = useCallback(() => {
    if (isLastSlide) {
      console.log('Onboarding complete!');
    } else {
      carouselRef.current?.scrollToPage(currentPage + 1);
    }
  }, [currentPage, isLastSlide]);

  const containerStyle: StyleProp<ViewStyle> = {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  const renderOnboardingItem = useCallback(
    ({ item }: ListRenderItemInfo<CarouselItem>) => {
      const textStyle: StyleProp<ViewStyle> = {
        flexDirection: 'column',
        gap: spacing.md,
      };
      return (
        <View style={textStyle}>
          <Text style={{ ...typography.styles.heading }}>{item.title}</Text>
          <Text style={{ ...typography.styles.body }}>{item.subTitle}</Text>
        </View>
      );
    },
    [],
  );

  return (
    <Main style={{ padding: spacing.xl }}>
      <View style={containerStyle}>
        <Carousel
          ref={carouselRef}
          data={onboardingSlides}
          renderItem={renderOnboardingItem}
          keyExtractor={item => item.id}
          height={340}
          showPagination={true}
          paginationVariant="dots"
          paginationActiveColor="blue"
          onPageChange={setCurrentPage}
          // paginationContainerStyle={styles.onboardingPagination}
        />
        <View>
          <Button onPress={continueClicked}>Continue</Button>
        </View>
      </View>
    </Main>
  );
}

export default Why;
