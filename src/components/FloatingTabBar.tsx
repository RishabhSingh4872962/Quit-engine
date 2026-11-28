import React, { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomTabBarHeightCallbackContext, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { radius, useColors } from '../theme';

const INACTIVE = '#8D8BA3';

/**
 * The Midnight tab bar: a floating dark pill with icons; the active tab sits on a soft accent pill.
 * Labels are for screen readers (the icons are the standard ones). Reports its height so tab
 * screens keep their last content above it.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onHeight = useContext(BottomTabBarHeightCallbackContext);
  const bottom = Math.max(insets.bottom, 10) + 6;

  return (
    <View
      pointerEvents="box-none"
      style={[s.wrap, { bottom }]}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height + bottom)}
    >
      <View style={[s.bar, { borderColor: c.border }]}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const key = route.name.toLowerCase() as 'home' | 'focus' | 'rooms' | 'milestones' | 'settings';
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (focused || e.defaultPrevented) return;
            void Haptics.selectionAsync();
            navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(`tabs.${key}`)}
              hitSlop={4}
              style={[s.item, focused && { backgroundColor: c.accentSoft }]}
            >
              {options.tabBarIcon?.({ focused, color: focused ? c.accentText : INACTIVE, size: 23 })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    height: 66,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: '#161622',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    boxShadow: '0px 14px 32px rgba(0,0,0,0.5)',
  },
  item: { width: 52, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
