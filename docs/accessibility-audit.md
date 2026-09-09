# Actionable UI accessibility audit

Reviewed September 9, 2026. Scope: landing page, Light Study, Seasons, Grand
Tour, Scale Walk, Missions, and Sky Tonight; shared navigation, information
drawers, buttons, links, disclosure summaries, date/location inputs and sliders.

## Criteria

Used [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/): normal text contrast of
4.5:1, meaningful control boundaries/state graphics at 3:1, visible keyboard
focus, accessible names/states, and target size (24 CSS pixels, with the
standard's spacing/inline exceptions). Disabled controls are contrast-exempt.
Small type alone is not a WCAG failure, but several labels were enlarged for
readability. See also [Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).

## Findings and fixes

| Finding | Change |
| --- | --- |
| Phone landing CTA inherited pale text over gold: axe measured **1.38:1**. | Increased selector specificity so the intended dark accent-ink color wins. The updated CTA passes axe. |
| Translucent controls could lose contrast over bright scene pixels. | Increased panel opacity to 96%, brightened secondary text, and gave active buttons/Explore an opaque dark surface. |
| Control borders and slider tracks were very faint. | Added a shared contrasting border/track token; retained the thumb's dark boundary. |
| Disclosure summaries lacked the shared explicit focus treatment. | Added a 3px gold focus outline with a dark outer backing to actionable elements; preserved the canvas-specific focus cue. |
| Scrolling chip rails could fade focused controls. | Scroll focused buttons/links into view and remove the edge mask while focus is within the rail. |
| Source/next links and several labels were unnecessarily small. | Increased relevant labels to 11px, added minimum link heights and persistent underlines. Existing large touch targets remain. |
| Mission source links were indistinguishable in a links list. | Added the mission name to each source link's accessible name. |
| Explore advertised an ARIA menu while containing ordinary navigation links. | Retained disclosure semantics (`aria-expanded`/`aria-controls`) and removed `aria-haspopup`. |

## Contrast regression evidence

Calculated sRGB contrast using the actual shared CSS tokens. The panel column
composites the 96%-opaque panel over pure white, a conservative bright-scene
stress case rather than a measurement of a particular planet pixel.

| Foreground | Panel over white | Opaque active surface |
| --- | ---: | ---: |
| Secondary text | 9.34:1 | 8.02:1 |
| Faint text | 8.54:1 | 7.33:1 |
| Accent text | 11.23:1 | 9.64:1 |
| Control border | 5.38:1 | 4.62:1 |

`accessibility.test.ts` prevents regressions in these pairings, the slider/focus
boundary contrast, and the landing CTA specificity fix.

## Verification and limits

- All seven views scanned with axe-core's WCAG A/AA tags at 1440×900 and
  320×740: no reported violations after the CTA fix; no document horizontal
  overflow. Phone Sky Tonight was also visually inspected at 390×844.
- Expanded Sky Tonight navigation and location fields also passed axe.
- DOM-driven interaction verified that Explore updates its expanded state and
  desktop collapse makes the hidden information panel inert.
- Build and HTML validation passed; 157 repository tests passed.
- Axe left contrast checks incomplete on canvas/translucent content (1–86
  elements per view). Token calculations supplement these results; they are
  not a complete per-pixel certification of every animated state.
- The preview's native click/key automation did not reliably deliver events.
  DOM interaction is not a substitute for a complete physical-keyboard or
  screen-reader walkthrough. Those checks, hover-state visual inspection,
  and exhaustive zoom/assistive-technology testing remain manual follow-ups.

This is a scoped remediation and regression baseline, not a declaration of
full WCAG conformance.
