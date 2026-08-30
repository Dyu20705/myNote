# myNote Theme Specification (Version 1)

`myNote` supports contract-driven UI themes. You can create themes in JSON format and import them directly into the application.

## Schema Structure

```json
{
  "id": "my-custom-theme",
  "version": 1,
  "name": "My Custom Theme",
  "isDark": false,
  "author": "Designer Name",
  "colors": {
    "background": "#ffffff",
    "surface": "#f8f9fa",
    "surfaceHover": "#e9ecef",
    "textPrimary": "#212529",
    "textSecondary": "#6c757d",
    "textMuted": "#adb5bd",
    "border": "#dee2e6",
    "borderFocus": "#4dabf7",
    "primary": "#228be6",
    "primaryHover": "#1c7ed6",
    "accent": "#7950f2",
    "statusSuccess": "#2b8a3e",
    "statusWarning": "#e67700",
    "statusError": "#c92a2a"
  },
  "typography": {
    "fontFamilyPrimary": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "fontFamilyMono": "ui-monospace, SFMono-Regular, monospace",
    "fontFamilyJapanese": "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif",
    "fontSizeBasePx": 16,
    "lineHeight": 1.5
  },
  "metrics": {
    "spacingUnitPx": 8,
    "borderRadiusPx": 6,
    "sidebarWidthPx": 260,
    "overlayMaxWidthPx": 760
  }
}
```

## Token Definitions

### Colors
- `background`: Main workspace and window background color.
- `surface`: Elevated surfaces, sidebars, cards, and modal dialog backgrounds.
- `surfaceHover`: Interactive hover state for cards and list items.
- `textPrimary`: Primary readable text.
- `textSecondary`: Subtle metadata, timestamps, and secondary captions.
- `textMuted`: Placeholder text and disabled label text.
- `border`: Hairline boundaries and dividers.
- `borderFocus`: Accessibility focus ring and active input border.
- `primary`: Primary action buttons, active navigation markers, and links.
- `primaryHover`: Active hover state for primary action buttons.
- `accent`: Highlights, study session streak badges, and active Japanese workspace accents.
- `statusSuccess`: Confirmed saves, review successes, and completed goals.
- `statusWarning`: Degraded states, storage alerts, and approaching deadlines.
- `statusError`: Transaction rollback notices, validation errors, and destructive warnings.

### Typography
- `fontFamilyPrimary`: Standard UI text font stack.
- `fontFamilyMono`: Code blocks, keyboard shortcuts, and mono tokens.
- `fontFamilyJapanese`: Japanese kanji, furigana, and vocabulary reading text.
- `fontSizeBasePx`: Root base font size in pixels (Range: 10 to 32).
- `lineHeight`: Text line height ratio (Range: 1.0 to 2.5).

### Metrics
- `spacingUnitPx`: Base grid spacing unit in pixels (Range: 4 to 16).
- `borderRadiusPx`: Corner rounding for cards, inputs, and buttons in pixels (Range: 0 to 24).
- `sidebarWidthPx`: Navigation sidebar width in pixels (Range: 180 to 400).
- `overlayMaxWidthPx`: Centered note editor overlay maximum width in pixels (Range: 480 to 1200).
