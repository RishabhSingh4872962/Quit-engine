import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { space, useColors } from '../theme';

/** Safe-area aware page with the themed background. Tab screens only need the top edge. */
export function Screen({ children, scroll, edges = ['top'], style }: {
  children: React.ReactNode; scroll?: boolean; edges?: Edge[]; style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <SafeAreaView edges={edges} style={[s.flex, { backgroundColor: c.bg }]}>
      {scroll ? (
        // "handled": a tap on a button while the keyboard is open presses the button (not just closes the keyboard)
        <ScrollView contentContainerStyle={[s.pad, style]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.flex, s.pad, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg },
});
