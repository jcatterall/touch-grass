import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MainProps {
  children: ReactNode;
  style?: ViewStyle;
}

function Main({ children, style }: MainProps) {
  const insets = useSafeAreaInsets();

  const mainStyle = {
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  const containerStyle = {
    flex: 1,
    ...style,
  };

  return (
    <View style={mainStyle}>
      <View style={containerStyle}>{children}</View>
    </View>
  );
}

export default Main;
