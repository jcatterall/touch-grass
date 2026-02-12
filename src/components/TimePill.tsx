import { useState, useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Clock } from 'lucide-react-native';
import { borderRadius, colors, spacing } from '../theme';
import { triggerHaptic } from '../utils/haptics';

export interface TimePillProps {
  value: string;
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, '0'),
);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  (i * 5).toString().padStart(2, '0'),
);
const PERIODS = ['AM', 'PM'];
const ITEM_HEIGHT = 44;

const formatTime = (hour: string, minute: string, period: string) =>
  `${hour}:${minute} ${period}`;

const parseTime = (timeStr: string) => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    return {
      hour: match[1].padStart(2, '0'),
      minute: match[2],
      period: match[3].toUpperCase(),
    };
  }
  return { hour: '09', minute: '00', period: 'AM' };
};

interface PickerColumnProps {
  items: string[];
  selected: string;
  onSelect: (value: string) => void;
  scrollRef: React.RefObject<ScrollView | null>;
}

const PickerColumn = ({ items, selected, onSelect, scrollRef }: PickerColumnProps) => {
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    onSelect(items[clampedIndex]);
    triggerHaptic('selection');
  };

  return (
    <View style={styles.pickerColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map(item => (
          <View key={item} style={styles.pickerItem}>
            <Text style={[styles.pickerText, selected === item && styles.pickerTextSelected]}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export const TimePill = ({ value, onChange }: TimePillProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const parsed = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(parsed.period);

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const periodScrollRef = useRef<ScrollView>(null);

  const openModal = () => {
    const current = parseTime(value);
    setSelectedHour(current.hour);
    setSelectedMinute(current.minute);
    setSelectedPeriod(current.period);
    setModalVisible(true);
    triggerHaptic('selection');
  };

  const handleDone = () => {
    onChange(formatTime(selectedHour, selectedMinute, selectedPeriod));
    setModalVisible(false);
    triggerHaptic('impactLight');
  };

  const handleModalShow = () => {
    setTimeout(() => {
      const scrollTo = (ref: React.RefObject<ScrollView | null>, index: number) =>
        ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });

      scrollTo(hourScrollRef, HOURS.indexOf(selectedHour));
      scrollTo(minuteScrollRef, MINUTES.indexOf(selectedMinute));
      scrollTo(periodScrollRef, PERIODS.indexOf(selectedPeriod));
    }, 50);
  };

  return (
    <>
      <Pressable style={styles.pill} onPress={openModal}>
        <Clock size={18} color={colors.oatmeal} />
        <Text style={styles.pillValue}>{value}</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onShow={handleModalShow}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Select Time</Text>
              <Pressable onPress={handleDone} hitSlop={8}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.pickerContainer}>
              <View style={styles.selectionIndicator} />
              <PickerColumn
                items={HOURS}
                selected={selectedHour}
                onSelect={setSelectedHour}
                scrollRef={hourScrollRef}
              />
              <Text style={styles.pickerSeparator}>:</Text>
              <PickerColumn
                items={MINUTES}
                selected={selectedMinute}
                onSelect={setSelectedMinute}
                scrollRef={minuteScrollRef}
              />
              <PickerColumn
                items={PERIODS}
                selected={selectedPeriod}
                onSelect={setSelectedPeriod}
                scrollRef={periodScrollRef}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  pillValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.white,
  },
  cancelText: {
    fontSize: 17,
    color: colors.oatmeal,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4ADE00',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ITEM_HEIGHT * 5,
    paddingHorizontal: spacing.xl,
  },
  selectionIndicator: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    backgroundColor: colors.charcoal,
    borderRadius: borderRadius.md,
  },
  pickerColumn: {
    height: ITEM_HEIGHT * 5,
    width: 60,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 20,
    color: colors.oatmeal,
  },
  pickerTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  pickerSeparator: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    marginHorizontal: spacing.xs,
  },
});
