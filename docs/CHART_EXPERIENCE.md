# Chart experience

website/src/charts/InteractiveChart.tsx provides shared SVG charts with date-range controls, series toggles, pointer crosshair/tooltip, touch selection, a native keyboard date explorer and an exact data table. The last visible series cannot be hidden. Loading and empty states explain missing data. Sparse data remains sparse; negative movement remains visible and zero is included in the domain.

Historical default readouts total flows within the loaded selected range. Selecting a date displays that date's exact values. Forecast readouts display the final cumulative scenario value and projected date. Disabled range buttons indicate unavailable history/horizons, not an invented one-year dataset. Record creation timestamps group in Africa/Nairobi. Currency-specific minor-unit formatting remains explicit.

WorkspaceCharts.tsx uses the existing scoped intelligence endpoint for Overview, Cash Flow and Reports. Payment requests and invoice charts describe face/requested value, not settlement. Reconciliation counts are separate measures and not stacked as a shared total. Existing Stage 2 trends use the same inspection component. No chart library or backend financial arithmetic change was introduced.

Model tests cover dates, ranges, timezone boundaries, domains, pointer bounds, sparse grouping and unavailable horizons. Browser checks and practical limits are recorded in CONTENT_QA.md.
