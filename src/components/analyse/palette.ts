// Categorical palette for the analysis charts — the one place the ember-mono
// app uses multiple hues. Taken from the dataviz reference's dark categorical
// theme and verified with scripts/validate_palette.js against a dark surface:
// all checks pass (lightness band, chroma, adjacent CVD ΔE ≥ 8, contrast ≥ 3:1).
// The ORDER is the CVD-safety mechanism — do not reorder cosmetically.
export const CATEGORY_COLORS = [
  "#3987e5", // blue
  "#008300", // green
  "#d55181", // magenta
  "#c98500", // yellow
  "#199e70", // aqua
  "#d95926", // orange
  "#9085e9", // violet
  "#e66767", // red
];

// Everything outside the shown categories folds into "Autres" — a recessive
// neutral, never a categorical hue.
export const AUTRES_COLOR = "#6f6e6a";

export function categoryColor(colorIndex: number | null): string {
  return colorIndex === null
    ? AUTRES_COLOR
    : (CATEGORY_COLORS[colorIndex] ?? AUTRES_COLOR);
}
