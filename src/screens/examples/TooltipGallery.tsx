/**
 * TooltipGallery - Showcase screen for Tooltip component
 *
 * Displays tooltips attached to different UI elements (icon, button, text link)
 * in various positions and color variants for visual verification.
 */

import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import {
  Colors,
  type ColorMode,
  type TooltipPosition,
  type TooltipVariant,
} from '../../theme/theme';

// =============================================================================
// CONSTANTS
// =============================================================================

const POSITIONS: TooltipPosition[] = ['top', 'bottom', 'left', 'right'];

// =============================================================================
// ICON COMPONENTS
// =============================================================================

// Info icon placeholder
const InfoIcon: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => (
  <View
    style={[
      styles.infoIcon,
      {
        width: size,
        height: size,
        borderColor: color,
      },
    ]}
  >
    <Text style={[styles.infoIconText, { color, fontSize: size * 0.6 }]}>
      i
    </Text>
  </View>
);

// Help icon placeholder
const HelpIcon: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => (
  <View
    style={[
      styles.helpIcon,
      {
        width: size,
        height: size,
        borderColor: color,
      },
    ]}
  >
    <Text style={[styles.helpIconText, { color, fontSize: size * 0.6 }]}>
      ?
    </Text>
  </View>
);

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

interface SectionProps {
  title: string;
  mode: ColorMode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, mode, children }) => (
  <View style={styles.section}>
    <Text
      style={[styles.sectionTitle, mode === 'dark' && styles.sectionTitleDark]}
    >
      {title}
    </Text>
    {children}
  </View>
);

interface ModeContainerProps {
  mode: ColorMode;
  children: React.ReactNode;
}

const ModeContainer: React.FC<ModeContainerProps> = ({ mode, children }) => (
  <View
    style={[
      styles.modeContainer,
      mode === 'dark' ? styles.darkModeContainer : styles.lightModeContainer,
    ]}
  >
    <Text style={[styles.modeTitle, mode === 'dark' && styles.modeTitleDark]}>
      {mode === 'light' ? 'Light Mode' : 'Dark Mode'}
    </Text>
    {children}
  </View>
);

// =============================================================================
// TOOLTIP DEMO COMPONENTS
// =============================================================================

interface PositionShowcaseProps {
  mode: ColorMode;
}

const PositionShowcase: React.FC<PositionShowcaseProps> = ({ mode }) => {
  const [visiblePosition, setVisiblePosition] =
    useState<TooltipPosition | null>(null);

  const handleShow = useCallback((position: TooltipPosition) => {
    setVisiblePosition(position);
  }, []);

  const handleClose = useCallback(() => {
    setVisiblePosition(null);
  }, []);

  return (
    <Section title="Position Variants" mode={mode}>
      <Text
        style={[styles.description, mode === 'dark' && styles.descriptionDark]}
      >
        Tap each button to see the tooltip appear in different positions
      </Text>
      <View style={styles.positionGrid}>
        {POSITIONS.map(position => (
          <Tooltip
            key={position}
            content={`This tooltip appears on ${position}`}
            position={position}
            isVisible={visiblePosition === position}
            onClose={handleClose}
            mode={mode}
            anchorAccessibilityHint={`Shows tooltip above the button`}
          >
            <Button
              variant="primary"
              mode={mode}
              size="md"
              onPress={() => handleShow(position)}
            >
              {position.charAt(0).toUpperCase() + position.slice(1)}
            </Button>
          </Tooltip>
        ))}
      </View>
    </Section>
  );
};

interface VariantShowcaseProps {
  mode: ColorMode;
}

const VariantShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => {
  const [visibleVariant, setVisibleVariant] = useState<TooltipVariant | null>(
    null,
  );

  const handleShow = useCallback((variant: TooltipVariant) => {
    setVisibleVariant(variant);
  }, []);

  const handleClose = useCallback(() => {
    setVisibleVariant(null);
  }, []);

  return (
    <Section title="Color Variants" mode={mode}>
      <View style={styles.variantRow}>
        <Tooltip
          content="Charcoal variant (#2D2E36)"
          position="top"
          variant="charcoal"
          isVisible={visibleVariant === 'charcoal'}
          onClose={handleClose}
          mode={mode}
        >
          <Button
            variant="secondary"
            mode={mode}
            size="md"
            onPress={() => handleShow('charcoal')}
          >
            Charcoal
          </Button>
        </Tooltip>

        <Tooltip
          content="Navy variant (#1F1F33)"
          position="top"
          variant="navy"
          isVisible={visibleVariant === 'navy'}
          onClose={handleClose}
          mode={mode}
        >
          <Button
            variant="secondary"
            mode={mode}
            size="md"
            onPress={() => handleShow('navy')}
          >
            Navy
          </Button>
        </Tooltip>
      </View>
    </Section>
  );
};

interface ElementShowcaseProps {
  mode: ColorMode;
}

const ElementShowcase: React.FC<ElementShowcaseProps> = ({ mode }) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const handleShow = useCallback((id: string) => {
    setActiveTooltip(id);
  }, []);

  const handleClose = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const iconColor = mode === 'dark' ? '#8B9AFF' : Colors.primaryBlue;
  const textColor = mode === 'dark' ? '#8B9AFF' : Colors.primaryBlue;

  return (
    <Section title="Different UI Elements" mode={mode}>
      <Text
        style={[styles.description, mode === 'dark' && styles.descriptionDark]}
      >
        Tooltips can be attached to any UI element
      </Text>

      <View style={styles.elementsContainer}>
        {/* Icon with tooltip */}
        <View style={styles.elementRow}>
          <Text
            style={[
              styles.elementLabel,
              mode === 'dark' && styles.elementLabelDark,
            ]}
          >
            Icon:
          </Text>
          <Tooltip
            content="This is an info icon with helpful information"
            position="right"
            isVisible={activeTooltip === 'icon'}
            onClose={handleClose}
            mode={mode}
            anchorAccessibilityHint="Tap for more information about this feature"
          >
            <Pressable
              onPress={() => handleShow('icon')}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Info"
            >
              <InfoIcon color={iconColor} size={32} />
            </Pressable>
          </Tooltip>
        </View>

        {/* Button with tooltip */}
        <View style={styles.elementRow}>
          <Text
            style={[
              styles.elementLabel,
              mode === 'dark' && styles.elementLabelDark,
            ]}
          >
            Button:
          </Text>
          <Tooltip
            content="Premium feature - Upgrade to unlock all meditation tracks"
            position="top"
            isVisible={activeTooltip === 'button'}
            onClose={handleClose}
            mode={mode}
            variant="navy"
          >
            <Button
              variant="tertiary"
              mode={mode}
              size="sm"
              onPress={() => handleShow('button')}
            >
              Premium
            </Button>
          </Tooltip>
        </View>

        {/* Text link with tooltip */}
        <View style={styles.elementRow}>
          <Text
            style={[
              styles.elementLabel,
              mode === 'dark' && styles.elementLabelDark,
            ]}
          >
            Text Link:
          </Text>
          <Tooltip
            content="Learn more about our privacy policy and data handling"
            position="bottom"
            isVisible={activeTooltip === 'link'}
            onClose={handleClose}
            mode={mode}
          >
            <Pressable
              onPress={() => handleShow('link')}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              accessibilityHint="Tap to see more information"
            >
              <Text style={[styles.textLink, { color: textColor }]}>
                Privacy Policy
              </Text>
            </Pressable>
          </Tooltip>
        </View>

        {/* Help icon with tooltip */}
        <View style={styles.elementRow}>
          <Text
            style={[
              styles.elementLabel,
              mode === 'dark' && styles.elementLabelDark,
            ]}
          >
            Help Icon:
          </Text>
          <Tooltip
            content="Need help? Contact support@headspace.com"
            position="left"
            isVisible={activeTooltip === 'help'}
            onClose={handleClose}
            mode={mode}
            variant="charcoal"
          >
            <Pressable
              onPress={() => handleShow('help')}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Help"
            >
              <HelpIcon color={iconColor} size={32} />
            </Pressable>
          </Tooltip>
        </View>
      </View>
    </Section>
  );
};

interface LongContentShowcaseProps {
  mode: ColorMode;
}

const LongContentShowcase: React.FC<LongContentShowcaseProps> = ({ mode }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Section title="Long Content" mode={mode}>
      <Text
        style={[styles.description, mode === 'dark' && styles.descriptionDark]}
      >
        Tooltips automatically wrap text and respect maxWidth
      </Text>
      <View style={styles.centeredContent}>
        <Tooltip
          content="This is a longer tooltip message that demonstrates how the component handles multi-line text content with proper wrapping and padding."
          position="top"
          isVisible={isVisible}
          onClose={() => setIsVisible(false)}
          mode={mode}
        >
          <Button
            variant="primary"
            mode={mode}
            size="lg"
            onPress={() => setIsVisible(true)}
          >
            Show Long Tooltip
          </Button>
        </Tooltip>
      </View>
    </Section>
  );
};

interface CustomContentShowcaseProps {
  mode: ColorMode;
}

const CustomContentShowcase: React.FC<CustomContentShowcaseProps> = ({
  mode,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const customContent = (
    <View style={styles.customTooltipContent}>
      <Text style={styles.customTooltipTitle}>Pro Tip</Text>
      <Text style={styles.customTooltipText}>
        You can pass React nodes as content!
      </Text>
    </View>
  );

  return (
    <Section title="Custom Content" mode={mode}>
      <Text
        style={[styles.description, mode === 'dark' && styles.descriptionDark]}
      >
        Pass React nodes for rich tooltip content
      </Text>
      <View style={styles.centeredContent}>
        <Tooltip
          content={customContent}
          position="top"
          isVisible={isVisible}
          onClose={() => setIsVisible(false)}
          mode={mode}
          variant="navy"
        >
          <Button
            variant="secondary"
            mode={mode}
            size="lg"
            onPress={() => setIsVisible(true)}
          >
            Custom Content
          </Button>
        </Tooltip>
      </View>
    </Section>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TooltipGallery: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Tooltip Gallery</Text>
        <Text style={styles.pageSubtitle}>
          Headspace Design System Tooltip Component
        </Text>

        {/* Light Mode Section */}
        <ModeContainer mode="light">
          <PositionShowcase mode="light" />
          <VariantShowcase mode="light" />
          <ElementShowcase mode="light" />
          <LongContentShowcase mode="light" />
          <CustomContentShowcase mode="light" />
        </ModeContainer>

        {/* Dark Mode Section */}
        <ModeContainer mode="dark">
          <PositionShowcase mode="dark" />
          <VariantShowcase mode="dark" />
          <ElementShowcase mode="dark" />
          <LongContentShowcase mode="dark" />
          <CustomContentShowcase mode="dark" />
        </ModeContainer>
      </ScrollView>
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
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
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
    marginBottom: 24,
  },

  // Mode Container
  modeContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  lightModeContainer: {
    backgroundColor: '#FFFFFF',
  },
  darkModeContainer: {
    backgroundColor: Colors.charcoal,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.charcoal,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modeTitleDark: {
    color: '#FFFFFF',
    borderBottomColor: '#3D3D47',
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.charcoal,
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 16,
  },
  descriptionDark: {
    color: '#B0B0B0',
  },

  // Position Showcase
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },

  // Variant Showcase
  variantRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },

  // Element Showcase
  elementsContainer: {
    gap: 20,
  },
  elementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  elementLabel: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.charcoal,
  },
  elementLabelDark: {
    color: '#E0E0E0',
  },

  // Icon styles
  iconButton: {
    padding: 4,
  },
  infoIcon: {
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontWeight: '700',
    fontStyle: 'italic',
  },
  helpIcon: {
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpIconText: {
    fontWeight: '700',
  },

  // Text link
  textLink: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // Centered content
  centeredContent: {
    alignItems: 'center',
  },

  // Custom tooltip content
  customTooltipContent: {
    alignItems: 'center',
  },
  customTooltipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFC52C',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  customTooltipText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default TooltipGallery;
