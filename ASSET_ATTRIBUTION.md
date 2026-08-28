# Asset Attribution and Provenance

This file is a public provenance register for character visuals and related media.

## Usage Scope

- Non-commercial use in project context (including portfolio/project showcase).
- Keep all assets in repo for demo continuity.
- Disclose third-party or generated sources in slides/video credits.
- If original creator name is unknown, cite by `Role ID + upstream repository/dataset URL + access date`.
- Role ID convention in this project: `xxxxg` (example: `5738g`).

## Historical Upstream Sources Referenced for Attribution

- Storyworld repository: [`venetanji/polyu-storyworld`](https://github.com/venetanji/polyu-storyworld)
- Storyworld dataset mirror: [`venetanji/polyu-storyworld-characters`](https://huggingface.co/datasets/venetanji/polyu-storyworld-characters)
- Dataset page metadata currently labels `venetanji/polyu-storyworld-characters` as `mit`.

These links are retained only as provenance records for already-local assets. The application does not fetch character profiles or portraits from either source at runtime.

Important note:

- Publicly accessible on GitHub does not automatically mean "no attribution needed".
- This project therefore keeps explicit references for role IDs used in demos.

## Character Visual Register

| Asset Path | Role ID | Provenance Statement | Reference URL | Usage Note |
|---|---|---|---|---|
| `public/asset/角色/cutout/0055g_cutout.png` | Aquabyte-98 | Preset role visual aligned with local character manifest | `seeds/characters/presets/aquabyte-98/source.yaml` | Project-context demo; show with attribution line |
| `public/asset/角色/cutout/2928g_cutout.png` | `2928g` | Imported as Storyworld-linked role asset | `https://github.com/venetanji/polyu-storyworld` | Project-context demo; follow upstream terms |
| `public/asset/角色/cutout/5208g_cutout.png` | `5208g` | Imported as Storyworld-linked role asset | `https://github.com/venetanji/polyu-storyworld` | Project-context demo; follow upstream terms |
| `public/asset/角色/cutout/5738g_cutout.png` | Captain Quick | Preset role visual aligned with local character manifest | `seeds/characters/presets/captain-quick/source.yaml` | Project-context demo; show with attribution line |
| `public/asset/角色/cutout/1512g_cutout.png` | `1512g` | Team-provided visual in active asset pack | team internal evidence | Add owner/source note in final slide |
| `public/asset/角色/cutout/1601_cutout.png` | `1601` / `1601g` | Team-provided visual in active asset pack | team internal evidence | Add owner/source note in final slide |
| `public/asset/角色/微信图片_20260418170446_294_154.jpg` | `5738g` reference | Team local reference portrait used in production prep | team internal evidence | Keep reference note explicit in presentation |
| `seeds/characters/presets/captain-quick/微信图片_20260418170446_294_154.jpg` | Captain Quick seed reference | Team local seed-side portrait copy | team internal evidence | Keep source note aligned with above row |
| `public/asset/角色/调酒师头像.png` | bartender | Team-authored bartender asset | team internal | Add creator name(s) |
| `public/asset/角色/调酒师动画.mp4` | bartender | Team-authored bartender animation | team internal | Add creator name(s) |

## Repository Evidence for Role Mapping

- `seeds/characters/presets/aquabyte-98/character.json`
- `seeds/characters/added/2928g/profile.json`
- `seeds/characters/added/5208g/profile.json`
- `seeds/characters/presets/captain-quick/character.json`
- `server/local-character-service.mjs` (local-only character loading)

## Reference Line Templates

- `0055g - Aquabyte-98 character seed/cutout - Source chain: local character manifest and archived source - Non-commercial project-context demo`
- `2928g - cutout - Source: venetanji/polyu-storyworld (project-context integration) - Accessed: 2026-04-24 - Non-commercial project-context demo`
- `5208g - cutout - Source: venetanji/polyu-storyworld (project-context integration) - Accessed: 2026-04-24 - Non-commercial project-context demo`
- `5738g - character seed/cutout - Source chain: local seed + Storyworld-linked workflow - Accessed: 2026-04-24 - Non-commercial project-context demo`
- `1512g/1601 - cutout visuals - Source: team internal asset pack - Accessed: 2026-04-24 - Non-commercial project-context demo`
- `Bartender avatar/animation - Source: team original production assets - Accessed: 2026-04-24 - Non-commercial project-context demo`

## Minimal Declaration for Unknown Original Author

Use this line when you only know the role ID and upstream project:

`Role ID <ID> is referenced from the Storyworld source (venetanji/polyu-storyworld). Original individual creator name is not available in our retrieved metadata. Used for non-commercial project-context presentation with repository reference and access date.`

Recommended dual-source variant:

`Role ID <ID> is referenced from Storyworld characters (GitHub) and Storyworld character images (Hugging Face dataset). Original individual creator name is not available in our retrieved metadata. Used for non-commercial project-context presentation with repository/dataset reference and access date.`

## Pending Metadata Items

Complete the following metadata fields before final hand-in:

1. Team member name(s) responsible for `1512g` and `1601` asset origins.
2. Team member name(s) responsible for bartender avatar/animation production.
3. If your instructor requires, add exact upstream file URL or commit hash per Storyworld-linked ID.

## AI Workflow Rule (Random Role Pool)

If AI manages full storyboard rendering with random role IDs:

1. Yes, every role ID that appears in the final demo should be referenced.
2. Use one unified method: maintain this file as the only register and append one line per newly appeared role ID.
3. When author name is unknown, use the "Minimal Declaration for Unknown Original Author" template.
4. For practical use, references can be generated per run by exporting the appeared role ID list, then mapping IDs to this register.
