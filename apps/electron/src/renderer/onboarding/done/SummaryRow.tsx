import { Icon } from "../../components/Icon";
import { PreferenceRow } from "../../components/PreferenceRows";
import { SUMMARY_GLYPHS } from "./constants";
import type { SummaryItem } from "./model";

export interface SummaryRowProps {
  item: SummaryItem;
}

export function SummaryRow({ item }: SummaryRowProps) {
  const glyph = SUMMARY_GLYPHS[item.status];
  return (
    <PreferenceRow
      data-status={item.status}
      data-testid={`summary-${item.id}`}
      prefix={<Icon name={glyph.icon} color={glyph.color} />}
      title={item.title}
      subtitle={item.detail}
    />
  );
}
