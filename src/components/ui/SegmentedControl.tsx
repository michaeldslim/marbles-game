import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import { hapticSelection } from '../../utils/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'spin' | 'english';
  compact?: boolean;
}

export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = 'spin',
  compact = false,
}: Props<T>): JSX.Element {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentPct = 100 / options.length;

  const activeBg = variant === 'english' ? '#1a3a6b' : colors.scoreCardActive;
  const activeBorder = variant === 'english' ? '#4da6ff' : colors.accent;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {label ? <Text style={[styles.sectionLabel, compact && styles.sectionLabelCompact]}>{label}</Text> : null}
      <View style={[styles.track, compact && styles.trackCompact]}>
        <View
          style={[
            styles.indicator,
            {
              width: `${segmentPct}%`,
              left: `${activeIndex * segmentPct}%`,
              backgroundColor: activeBg,
              borderColor: activeBorder,
            },
          ]}
        />
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={styles.segment}
              onPress={() => {
                if (opt.value !== value) hapticSelection();
                onChange(opt.value);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, compact && styles.segmentTextCompact, active && styles.segmentTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 3,
  },
  wrapCompact: {
    gap: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingLeft: 2,
  },
  sectionLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.4,
    paddingLeft: 0,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radii.sm,
    padding: 2,
    position: 'relative',
    minHeight: 30,
  },
  trackCompact: {
    minHeight: 18,
    padding: 1,
  },
  indicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: radii.sm - 2,
    borderWidth: 1.5,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
    zIndex: 1,
  },
  segmentText: {
    fontSize: typography.labelSm,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentTextCompact: {
    fontSize: 9,
  },
  segmentTextActive: {
    color: colors.textOnDark,
  },
});
