# Design critique: Creator OS v0.3

Written with the design-critique skill, from the v0.3 screenshots in `docs/screenshots/`.

## Overall impression
It reads like a generic admin dashboard: grey page, identical white rounded cards, small grey text everywhere. Nothing says "this turns your voice into posts". The biggest opportunity is hierarchy. The thing you are making, the post, should be the hero on every screen.

## Usability
| Finding | Severity | Fix |
|---|---|---|
| On Review, the three agent cards sit above the draft and push it below the fold | 🔴 Critical | Make the draft the first thing you see. Move the agents into a side rail or a collapsible "Second opinion" drawer |
| There is no single "start here". The Inbox shows a form and a list with equal weight | 🔴 Critical | Use one big capture moment (drop, record, paste) with the list secondary. Add a guided path: Capture, Pick angle, Review, Post |
| Internal jargon: gate, holdout, F1, traceability, measured or judged, sha256, condition | 🟡 Moderate | Use plain words ("backed by what you said", "said before") and hide the experiment details behind an "Experiment" toggle |
| The draft does not look like a post | 🟡 Moderate | Render each post as an X-style preview (avatar, name, character ring, thread connector), so you judge it as readers will see it |
| Every proof underline is green, so a clean draft looks noisy | 🟡 Moderate | Mark only the problems by default. A clean sentence gets no mark |
| Evidence is a wall of numbers | 🟡 Moderate | Lead with one answer ("The gate helps: +18 points") and put the tables under it |
| Long helper sentences on every card | 🟢 Minor | Cut them to one line, or move them into tooltips |

## Visual hierarchy
- **Draws the eye first:** the page title and the sidebar. It should be the post or the drop zone.
- **Emphasis:** everything has the same card weight, so nothing leads.

## Consistency
| Element | Issue | Fix |
|---|---|---|
| Cards | Same radius, border and padding for primary and tertiary content | Three levels: hero surface, plain section, inline |
| Type | Too many 11–13 px grey labels | Use a 14 px minimum for body text. Keep muted text for metadata only |

## Accessibility
- **Contrast:** muted text on the grey background is borderline at small sizes.
- **Touch targets:** these are fine.
- **Keyboard and reduced motion:** these are handled.

## What works
- The waveform upload rows, the sentence-to-transcript highlight, the swipe calibration, and the publish tracker.

## Priority recommendations
1. **Post-first review screen with X-style previews.** This is where the creator spends their time.
2. **One guided flow and a bold capture hero.** This makes the first use obvious.
3. **A plain-language pass and less chrome.** Fewer cards and fewer grey sentences make it feel calmer and more premium.
