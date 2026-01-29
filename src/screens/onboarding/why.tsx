import { Text, View } from 'react-native';
import Main from '../../layout/main';
import { spacing, typography } from '../../theme';
import { Button } from '../../components';

function Why() {
  return (
    <Main style={{ padding: spacing.xl }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ ...typography.styles.heading }}>
            Everything your mind needs
          </Text>
          <Text style={{ ...typography.styles.body }}>
            Stress less, sleep soundly, and get one-on-one support to feel your
            best. Explore hundreds of exercises, courses, and guided programs
            designs for your mind.
          </Text>
        </View>
        <View>
          <Button>Continue</Button>
        </View>
      </View>
    </Main>
  );
}

export default Why;
