import React, { useContext } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { space, useColors } from '../theme';

/** Safe-area aware page with the themed background. Tab screens only need the top edge. */
export function Screen({ children, scroll, edges = ['top'], style }: {
  children: React.ReactNode; scroll?: boolean; edges?: Edge[]; style?: ViewStyle;
}) {
  const c = useColors();
  // Tab screens sit under the floating tab bar: keep their last content above it.
  const tabBar = useContext(BottomTabBarHeightContext) ?? 0;
  const bottom = tabBar ? { paddingBottom: tabBar + space.md } : null;
  return (
    <SafeAreaView edges={edges} style={[s.flex, { backgroundColor: c.bg }]}>
      {scroll ? (
        // "handled": a tap on a button while the keyboard is open presses the button (not just closes the keyboard)
        <ScrollView contentContainerStyle={[s.pad, bottom, style]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.flex, s.pad, bottom, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg },
});
