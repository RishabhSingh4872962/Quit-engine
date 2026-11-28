import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withAlpha } from '../lib/color';
import { radius, useColors } from '../theme';
import { AppText } from './AppText';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * A settings-style group: a small section label, then one card whose rows are split by hairlines.
 * Children are rows (`Row`, `ToggleRow` with `style={rowPad}`, or any padded view); `false`/`null`
 * children are skipped, so conditional rows need no extra wrapping.
 */
export function Group({ label, note, children, style }: {
  label?: string; note?: string; children: React.ReactNode; style?: ViewStyle;
}) {
  const c = useColors();
  const items = React.Children.toArray(children);
  if (items.length === 0) return null;
  return (
    <View style={[s.group, style]}>
      {label ? <AppText variant="label" style={s.label}>{label}</AppText> : null}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={[s.divider, { backgroundColor: c.border }]} />}
            {item}
          </React.Fragment>
        ))}
      </View>
      {note ? <AppText variant="caption" style={s.note}>{note}</AppText> : null}
    </View>
  );
}

/** The 34 px icon circle at the start of a row. */
export function RowIcon({ icon, color, danger }: { icon: IconName; color?: string; danger?: boolean }) {
  const c = useColors();
  const fg = danger ? c.danger : color ?? c.accentText;
  return (
    <View style={[s.icon, { backgroundColor: danger ? withAlpha(c.danger, 0.14) : color ? withAlpha(color, 0.16) : c.accentSoft }]}>
      <Ionicons name={icon} size={18} color={fg} />
    </View>
  );
}

/** A letter in a neutral circle, for rows about other apps (no brand logos). */
export function RowLetter({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={[s.icon, { backgroundColor: c.surfaceHigh }]}>
      <AppText style={s.letter} color={c.text}>{text.slice(0, 1).toUpperCase()}</AppText>
    </View>
  );
}

/**
 * One row: icon, title, optional subtitle, and on the right a value and a chevron (when it opens
 * something). `children` go under the title line (a segmented control, say), `note` under those.
 */
export function Row({ icon, iconColor, leading, title, sub, value, badge, right, onPress, danger, chevron, children, note, hint }: {
  icon?: IconName;
  iconColor?: string;
  leading?: React.ReactNode;
  title: string;
  sub?: string;
  value?: string;
  badge?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  children?: React.ReactNode;
  note?: string;
  hint?: string;
}) {
  const c = useColors();
  const showChevron = chevron ?? (!!onPress && !danger);
  const line = (
    <View style={s.line}>
      {leading ?? (icon ? <RowIcon icon={icon} color={iconColor} danger={danger} /> : null)}
      <View style={s.flex}>
        <AppText style={s.title} color={danger ? c.danger : c.text}>{title}</AppText>
        {sub ? <AppText variant="caption">{sub}</AppText> : null}
      </View>
      {badge ? (
        <View style={[s.badge, { backgroundColor: c.accentSoft }]}>
          <AppText style={s.badgeText} color={c.accentText}>{badge}</AppText>
        </View>
      ) : null}
      {value ? <AppText style={s.value} color={c.textMuted} numberOfLines={1}>{value}</AppText> : null}
      {right}
      {showChevron && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </View>
  );
  const body = (
    <>
      {line}
      {children ? <View style={s.below}>{children}</View> : null}
      {note ? <AppText variant="caption" style={s.below}>{note}</AppText> : null}
    </>
  );
  if (!onPress) return <View style={s.row}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={hint ?? sub}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: c.surfaceAlt }]}
    >
      {body}
    </Pressable>
  );
}

/** Padding for a `ToggleRow` (or any custom row) placed inside a `Group`. */
export const rowPad: ViewStyle = { paddingHorizontal: 16, paddingVertical: 14, minHeight: 62 };

const s = StyleSheet.create({
  group: { marginBottom: 24 },
  label: { marginLeft: 4, marginBottom: 8 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 16 },
  note: { marginTop: 8, marginHorizontal: 4 },
  row: { ...rowPad, justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1, gap: 1 },
  title: { fontSize: 15.5, lineHeight: 22, fontWeight: '600' },
  value: { fontSize: 14, lineHeight: 20, maxWidth: 140 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  below: { marginTop: 12 },
});
