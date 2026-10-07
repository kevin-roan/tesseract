import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUP } from "../TimeSeriesChart/gallery-samples";
import { LegendDemo } from "./LegendDemo";

export default defineGalleryEntry({
  id: "series-legend",
  title: "SeriesLegend",
  group: GALLERY_GROUP,
  render: () => <LegendDemo />,
});
