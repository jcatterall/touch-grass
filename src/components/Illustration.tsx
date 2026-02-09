import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
} from 'react-native';

export type IllustrationSource =
  | 'breaking'
  | 'calendar'
  | 'clock'
  | 'leaping'
  | 'lock'
  | 'map'
  | 'meditate'
  | 'notification'
  | 'plan'
  | 'prize'
  | 'progress'
  | 'runner'
  | 'shield'
  | 'wave'
  | 'flag'
  | 'goals'
  | 'chest';

export type ImageSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const images: Record<IllustrationSource, ImageSourcePropType> = {
  breaking: require('../../assets/illustrations/breaking.png'),
  calendar: require('../../assets/illustrations/calendar.png'),
  clock: require('../../assets/illustrations/clock.png'),
  leaping: require('../../assets/illustrations/leaping.png'),
  lock: require('../../assets/illustrations/lock.png'),
  map: require('../../assets/illustrations/map.png'),
  meditate: require('../../assets/illustrations/meditate.png'),
  notification: require('../../assets/illustrations/notification.png'),
  plan: require('../../assets/illustrations/plan.png'),
  prize: require('../../assets/illustrations/prize.png'),
  progress: require('../../assets/illustrations/progress.png'),
  runner: require('../../assets/illustrations/runner.png'),
  shield: require('../../assets/illustrations/shield.png'),
  wave: require('../../assets/illustrations/wave.png'),
  flag: require('../../assets/illustrations/flag.png'),
  goals: require('../../assets/illustrations/goals.png'),
  chest: require('../../assets/illustrations/chest.png'),
};

interface ImageProps {
  source: IllustrationSource;
  size: ImageSize;
}

export const Illustration = (props: ImageProps) => {
  const getHeight = () => {
    if (props.size === 'xxs') return 100;
    if (props.size === 'xs') return 150;
    if (props.size === 'sm') return 275;
    if (props.size === 'md') return 300;
    if (props.size === 'lg') return 415;
    if (props.size === 'xl') return 450;
    return 415;
  };

  const style = {
    width: '100%',
    height: getHeight(),
  } satisfies StyleProp<ImageStyle>;

  return (
    <Image source={images[props.source]} style={style} resizeMode="contain" />
  );
};
