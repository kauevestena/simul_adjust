# Bilingual Monorepo Ground Rules (PT-BR & EN)

All applications, tools, simulators, and documentation within this monorepo must be fully bilingual (Portuguese - PT-BR and English - EN).

## Requirements

1. **Client-Side i18n Architecture**:
   - Each simulator / web application must support both Portuguese (`pt-BR`) and English (`en`).
   - Unified Language Detection Order:
     1. URL query parameter (`?lang=en` or `?lang=pt` / `?lang=pt-BR`).
     2. Shared `localStorage` key: `'monorepo_lang'`.
     3. Browser preference: `navigator.language` (`pt*` defaults to Portuguese, otherwise English).
   - Dynamic Language Switching:
     - Prominent, accessible language toggle switch in the UI (e.g. `PT` / `EN` button).
     - Switching language must update DOM text immediately without requiring a full page reload when possible.
     - Save user preference to `localStorage.setItem('monorepo_lang', lang)`.
     - Outbound navigation links to portal or other simulators should preserve `?lang=<current_lang>`.

2. **Localization Coverage**:
   - UI controls, labels, buttons, modals, tooltips, placeholders, and charts/graphs.
   - Educational/theory content, instructions, formulas/explanations, and sample data.
   - Scientific and technical terms must use standard domain terminology in both Portuguese and English (Geodesy, Cartography, Topography, Least Squares / Ajustamento por Mínimos Quadrados).

3. **Documentation**:
   - Monorepo guides, simulator instructions, and readme files should provide both Portuguese and English instructions.
