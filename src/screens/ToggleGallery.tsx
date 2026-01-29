/**
 * ToggleGallery - Showcase screen for Toggle component
 *
 * Displays the Toggle component in a realistic "Settings" screen layout,
 * demonstrating various states and both light/dark modes.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Toggle } from '../components/Toggle';
import { HSColors, type HSColorMode } from '../theme/theme';

// =============================================================================
// SETTINGS STATE TYPE
// =============================================================================

interface SettingsState {
  dailyNotifications: boolean;
  soundEffects: boolean;
  darkMode: boolean;
  autoPlay: boolean;
  downloadOnWifi: boolean;
  shareActivity: boolean;
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

interface SectionHeaderProps {
  title: string;
  mode: HSColorMode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, mode }) => (
  <Text style={[styles.sectionHeader, mode === 'dark' && styles.sectionHeaderDark]}>
    {title}
  </Text>
);

interface SettingsGroupProps {
  mode: HSColorMode;
  children: React.ReactNode;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({ mode, children }) => (
  <View
    style={[
      styles.settingsGroup,
      mode === 'dark' ? styles.settingsGroupDark : styles.settingsGroupLight,
    ]}
  >
    {children}
  </View>
);

interface DividerProps {
  mode: HSColorMode;
}

const Divider: React.FC<DividerProps> = ({ mode }) => (
  <View
    style={[
      styles.divider,
      mode === 'dark' ? styles.dividerDark : styles.dividerLight,
    ]}
  />
);

interface ModeContainerProps {
  mode: HSColorMode;
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
// SETTINGS SCREEN SECTION
// =============================================================================

interface SettingsSectionProps {
  mode: HSColorMode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ mode }) => {
  const [settings, setSettings] = useState<SettingsState>({
    dailyNotifications: true,
    soundEffects: true,
    darkMode: false,
    autoPlay: true,
    downloadOnWifi: false,
    shareActivity: false,
  });

  const updateSetting = (key: keyof SettingsState) => (value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <View>
      {/* Notifications Section */}
      <SectionHeader title="NOTIFICATIONS" mode={mode} />
      <SettingsGroup mode={mode}>
        <Toggle
          label="Daily Reminders"
          isOn={settings.dailyNotifications}
          onToggle={updateSetting('dailyNotifications')}
          mode={mode}
          accessibilityHint="Receive daily meditation reminders"
        />
        <Divider mode={mode} />
        <Toggle
          label="Sound Effects"
          isOn={settings.soundEffects}
          onToggle={updateSetting('soundEffects')}
          mode={mode}
          accessibilityHint="Play sounds during meditation transitions"
        />
      </SettingsGroup>

      {/* Appearance Section */}
      <SectionHeader title="APPEARANCE" mode={mode} />
      <SettingsGroup mode={mode}>
        <Toggle
          label="Dark Mode"
          isOn={settings.darkMode}
          onToggle={updateSetting('darkMode')}
          mode={mode}
          accessibilityHint="Use dark theme throughout the app"
        />
      </SettingsGroup>

      {/* Playback Section */}
      <SectionHeader title="PLAYBACK" mode={mode} />
      <SettingsGroup mode={mode}>
        <Toggle
          label="Auto-Play Next"
          isOn={settings.autoPlay}
          onToggle={updateSetting('autoPlay')}
          mode={mode}
          accessibilityHint="Automatically play the next session"
        />
        <Divider mode={mode} />
        <Toggle
          label="Download on Wi-Fi Only"
          isOn={settings.downloadOnWifi}
          onToggle={updateSetting('downloadOnWifi')}
          mode={mode}
          accessibilityHint="Only download content when connected to Wi-Fi"
        />
      </SettingsGroup>

      {/* Privacy Section */}
      <SectionHeader title="PRIVACY" mode={mode} />
      <SettingsGroup mode={mode}>
        <Toggle
          label="Share Activity with Friends"
          isOn={settings.shareActivity}
          onToggle={updateSetting('shareActivity')}
          mode={mode}
          accessibilityHint="Let friends see your meditation progress"
        />
      </SettingsGroup>
    </View>
  );
};

// =============================================================================
// STATES SHOWCASE
// =============================================================================

interface StatesShowcaseProps {
  mode: HSColorMode;
}

const StatesShowcase: React.FC<StatesShowcaseProps> = ({ mode }) => {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);

  return (
    <View>
      <SectionHeader title="COMPONENT STATES" mode={mode} />
      <SettingsGroup mode={mode}>
        <View style={styles.stateRow}>
          <View style={styles.stateInfo}>
            <Text style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}>
              On State
            </Text>
            <Text style={[styles.stateValue, mode === 'dark' && styles.stateValueDark]}>
              Green track, white thumb
            </Text>
          </View>
          <Toggle
            isOn={toggleOn}
            onToggle={setToggleOn}
            mode={mode}
          />
        </View>
        <Divider mode={mode} />
        <View style={styles.stateRow}>
          <View style={styles.stateInfo}>
            <Text style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}>
              Off State
            </Text>
            <Text style={[styles.stateValue, mode === 'dark' && styles.stateValueDark]}>
              Gray track, white thumb
            </Text>
          </View>
          <Toggle
            isOn={toggleOff}
            onToggle={setToggleOff}
            mode={mode}
          />
        </View>
        <Divider mode={mode} />
        <View style={styles.stateRow}>
          <View style={styles.stateInfo}>
            <Text style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}>
              Disabled (On)
            </Text>
            <Text style={[styles.stateValue, mode === 'dark' && styles.stateValueDark]}>
              Non-interactive state
            </Text>
          </View>
          <Toggle
            isOn={true}
            onToggle={() => {}}
            mode={mode}
            disabled
          />
        </View>
        <Divider mode={mode} />
        <View style={styles.stateRow}>
          <View style={styles.stateInfo}>
            <Text style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}>
              Disabled (Off)
            </Text>
            <Text style={[styles.stateValue, mode === 'dark' && styles.stateValueDark]}>
              Non-interactive state
            </Text>
          </View>
          <Toggle
            isOn={false}
            onToggle={() => {}}
            mode={mode}
            disabled
          />
        </View>
      </SettingsGroup>
    </View>
  );
};

// =============================================================================
// STANDALONE TOGGLE SHOWCASE
// =============================================================================

interface StandaloneShowcaseProps {
  mode: HSColorMode;
}

const StandaloneShowcase: React.FC<StandaloneShowcaseProps> = ({ mode }) => {
  const [value, setValue] = useState(true);

  return (
    <View>
      <SectionHeader title="STANDALONE (NO LABEL)" mode={mode} />
      <SettingsGroup mode={mode}>
        <View style={styles.standaloneRow}>
          <Text style={[styles.standaloneLabel, mode === 'dark' && styles.standaloneLabelDark]}>
            Toggle without built-in label (for custom layouts):
          </Text>
          <Toggle
            isOn={value}
            onToggle={setValue}
            mode={mode}
            accessibilityLabel="Custom toggle"
          />
        </View>
      </SettingsGroup>
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ToggleGallery: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Toggle Gallery</Text>
        <Text style={styles.pageSubtitle}>
          Headspace Design System Toggle Switch Component
        </Text>

        {/* Light Mode Section */}
        <ModeContainer mode="light">
          <SettingsSection mode="light" />
          <View style={styles.sectionSpacer} />
          <StatesShowcase mode="light" />
          <View style={styles.sectionSpacer} />
          <StandaloneShowcase mode="light" />
        </ModeContainer>

        {/* Dark Mode Section */}
        <ModeContainer mode="dark">
          <SettingsSection mode="dark" />
          <View style={styles.sectionSpacer} />
          <StatesShowcase mode="dark" />
          <View style={styles.sectionSpacer} />
          <StandaloneShowcase mode="dark" />
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
    color: HSColors.charcoal,
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
    backgroundColor: HSColors.charcoal,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: HSColors.charcoal,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modeTitleDark: {
    color: '#FFFFFF',
    borderBottomColor: '#3D3D47',
  },

  // Section Header
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderDark: {
    color: '#8B8B8B',
  },

  // Settings Group
  settingsGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  settingsGroupLight: {
    backgroundColor: '#F7F7F7',
  },
  settingsGroupDark: {
    backgroundColor: '#3D3D47',
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  dividerLight: {
    backgroundColor: '#E0E0E0',
  },
  dividerDark: {
    backgroundColor: '#4A4A54',
  },

  // State Row
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  stateInfo: {
    flex: 1,
    marginRight: 16,
  },
  stateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: HSColors.charcoal,
    marginBottom: 2,
  },
  stateLabelDark: {
    color: '#E0E0E0',
  },
  stateValue: {
    fontSize: 12,
    color: '#666666',
  },
  stateValueDark: {
    color: '#8B8B8B',
  },

  // Standalone
  standaloneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  standaloneLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  standaloneLabelDark: {
    color: '#B0B0B0',
  },

  // Section Spacer
  sectionSpacer: {
    height: 8,
  },
});

export default ToggleGallery;
