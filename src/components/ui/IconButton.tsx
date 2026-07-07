import React from 'react';
import { Pressable, Text, StyleSheet, View, Insets } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hud, radii, spacing, touch, typography } from '../../theme';
import { hapticLight } from '../../utils/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  label?: string;
  onPress: () => void;
  variant?: 'ghost' | 'danger';
  accessibilityLabel?: string;
  compact?: boolean;
}

const compactHitSlop: Insets = {
  top: Math.max(0, (touch.minSize - hud.navButtonHeight) / 2),
  bottom: Math.max(0, (touch.minSize - hud.navButtonHeight) / 2),
  left: spacing.xs,
  right: spacing.xs,
};

export default function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
  accessibilityLabel,
  compact = false,
}: Props): JSX.Element {
  const isDanger = variant === 'danger';
  const iconColor = isDanger ? colors.danger : colors.textOnDark;
  const iconSize = compact ? 16 : 20;

  const handlePress = () => {
    hapticLight();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={compact ? compactHitSlop : undefined}
      style={({ pressed }) => [
        compact ? styles.hitAreaCompact : styles.hitArea,
        pressed && (isDanger ? styles.dangerPressed : styles.ghostPressed),
      ]}
    >
      {({ pressed }) => (
        <View style={styles.content}>
          <Ionicons
            name={icon}
            size={iconSize}
            color={iconColor}
            style={{ opacity: pressed || isDanger ? 1 : 0.7 }}
          />
          {label ? (
            <Text style={[compact ? styles.labelCompact : styles.label, isDanger && styles.labelDanger]}>
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    minWidth: touch.minSize,
    minHeight: touch.minSize,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  hitAreaCompact: {
    height: hud.navButtonHeight,
    minWidth: hud.navButtonMinWidth,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ghostPressed: {
    backgroundColor: colors.navGhostPressed,
  },
  dangerPressed: {
    backgroundColor: 'rgba(228, 68, 68, 0.15)',
  },
  label: {
    color: colors.textOnDark,
    fontSize: typography.label,
    fontWeight: '600',
    opacity: 0.9,
  },
  labelCompact: {
    color: colors.textOnDark,
    fontSize: typography.labelSm,
    fontWeight: '700',
    opacity: 0.9,
  },
  labelDanger: {
    color: colors.danger,
    opacity: 1,
  },
});
