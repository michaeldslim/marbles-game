import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Lang, t } from '../../i18n';
import { colors, typography } from '../../theme';

interface Props {
  lang: Lang | undefined;
}

export default function AiThinkingIndicator({ lang }: Props): JSX.Element {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={styles.wrap}>
      <Animated.Text style={[styles.text, { opacity }]}>
        🤖 {t(lang, 'aiThinking')}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
