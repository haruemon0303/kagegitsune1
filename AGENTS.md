# AGENTS.md

## 作業方針
- 依存なし（CDN禁止）・GitHub Pages前提で運用する。
- iPhone Safari対応を考慮する（safe-area、overflow、音声の初回タップ制限）。
- `story.json`は「配線（next/choices）」が正であることを最優先し、本文は置換表示（主人公名）する方針とする。
- 大規模変更は避け、まず差分を小さくする。
- END/SECRET判定は文字列で判定しているため、判定対象の文字列を明文化して運用する。
  - 現状は `type=system` の行で `text` に `END` を含む場合のみ判定対象とする。
