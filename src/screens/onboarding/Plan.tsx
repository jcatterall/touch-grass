import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { Button, DayChip, SegmentedControl } from '../../components';
import { TimeRangeSlider } from '../../components/TimeRangeSlider';
import { AppBlockList, type BlockedApp } from '../../components/AppBlockList';
import { Slider } from '../../components/Slider';
import { BlocklistScreen } from '../BlocklistScreen';
import { spacing, colors } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';

export interface PlanProps {
  onComplete: () => void;
}

type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type DurationType = 'entire_day' | 'specific_hours';
type CriteriaType = 'distance' | 'time';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

const DEFAULT_BLOCKED_APP_IDS = ['netflix', 'discord', 'youtube', 'tiktok'];

const APP_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  telegram: 'Telegram',
  reddit: 'Reddit',
  'candy-crush': 'Candy Crush',
  'pokemon-go': 'Pokemon Go',
  'clash-royale': 'Clash Royale',
  netflix: 'Netflix',
  youtube: 'YouTube',
  spotify: 'Spotify',
  twitch: 'Twitch',
  amazon: 'Amazon',
  doordash: 'DoorDash',
  'uber-eats': 'Uber Eats',
  airbnb: 'Airbnb',
  'google-maps': 'Google Maps',
};

const CRITERIA_CONFIG = {
  distance: { min: 1, max: 15, step: 0.5, unit: 'Kilometers', label: 'km' },
  time: { min: 5, max: 120, step: 5, unit: 'Minutes', label: 'min' },
} as const;

export const Plan = ({ onComplete }: PlanProps) => {
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([]);
  const [durationType, setDurationType] =
    useState<DurationType>('specific_hours');
  const [fromTime, setFromTime] = useState('09:00 AM');
  const [toTime, setToTime] = useState('05:00 PM');
  const [criteriaType, setCriteriaType] = useState<CriteriaType>('distance');
  const [criteriaValue, setCriteriaValue] = useState({
    distance: 5.0,
    time: 30,
  });
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blockedAppIds, setBlockedAppIds] = useState<string[]>(DEFAULT_BLOCKED_APP_IDS);

  // Convert blocked app IDs to BlockedApp format for display
  const blockedApps: BlockedApp[] = blockedAppIds.map(id => ({
    name: APP_NAMES[id] || id,
  }));

  const toggleDay = (day: DayKey) => {
    triggerHaptic('selection');
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const handleSaveRule = () => {
    triggerHaptic('impactMedium');
    onComplete();
  };

  const config = CRITERIA_CONFIG[criteriaType];
  const currentValue = criteriaValue[criteriaType];

  const handleBlocklistSave = (selectedIds: string[]) => {
    setBlockedAppIds(selectedIds);
    setShowBlocklist(false);
  };

  if (showBlocklist) {
    return (
      <BlocklistScreen
        selectedAppIds={blockedAppIds}
        onSave={handleBlocklistSave}
        onClose={() => setShowBlocklist(false)}
      />
    );
  }

  return (
    <OnboardingContainer>
      <View style={styles.container}>
        <View style={{ ...styles.frequencySection, ...styles.section }}>
          <Text style={styles.sectionLabel}>FREQUENCY</Text>
          <View style={styles.daysContainer}>
            {DAYS.map(day => (
              <DayChip
                key={day.key}
                label={day.label}
                isSelected={selectedDays.includes(day.key)}
                onPress={() => toggleDay(day.key)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ACTIVE TIME</Text>
            <SegmentedControl
              options={['Entire Day', 'Specific Hours']}
              selectedIndex={durationType === 'entire_day' ? 0 : 1}
              onSelect={index =>
                setDurationType(index === 0 ? 'entire_day' : 'specific_hours')
              }
            />
          </View>
          {durationType === 'specific_hours' && (
            <View style={styles.timeSection}>
              <TimeRangeSlider
                startTime={fromTime}
                endTime={toTime}
                onStartTimeChange={setFromTime}
                onEndTimeChange={setToTime}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>CRITERIA</Text>
            <SegmentedControl
              options={['Distance', 'Time']}
              selectedIndex={criteriaType === 'distance' ? 0 : 1}
              onSelect={index =>
                setCriteriaType(index === 0 ? 'distance' : 'time')
              }
            />
          </View>

          <View style={{ ...styles.criteriaValueRow, ...styles.section }}>
            <Text style={styles.criteriaValue}>
              {criteriaType === 'distance'
                ? currentValue.toFixed(1)
                : currentValue}
            </Text>
            <Text style={styles.criteriaUnit}>
              {config.label.toUpperCase()}
            </Text>
          </View>

          <View style={{ ...styles.sliderSection, ...styles.section }}>
            <Slider
              min={config.min}
              max={config.max}
              value={currentValue}
              step={config.step}
              onValueChange={v =>
                setCriteriaValue(prev => ({ ...prev, [criteriaType]: v }))
              }
              showValue={false}
              style={styles.sliderStyle}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>
                {config.min} {config.label}
              </Text>
              <Text style={styles.sliderLabelText}>
                {config.max} {config.label}
              </Text>
            </View>
          </View>
        </View>

        <AppBlockList apps={blockedApps} onEdit={() => setShowBlocklist(true)} />
      </View>

      <View style={styles.footer}>
        <Button size="lg" onPress={handleSaveRule}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxxl,
  },
  section: {},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  frequencySection: {
    gap: spacing.sm,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeSection: {
    marginTop: spacing.xs,
  },
  criteriaValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  criteriaValue: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.primary.blue,
  },
  criteriaUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.text.secondary,
  },
  sliderSection: {
    marginTop: spacing.xs,
  },
  sliderStyle: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sliderLabelText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.tertiary,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
