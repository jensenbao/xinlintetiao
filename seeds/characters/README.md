# Characters Seed Directory

This directory centralizes role management:

- presets/: built-in preset character asset folders
- added/: user-added character asset folders stored locally

Preset folder layout (recommended):

- seeds/characters/presets/<roleId>/profile.json
- seeds/characters/presets/<roleId>/source.yaml
- seeds/characters/presets/<roleId>/portrait.png (optional)

Added folder layout (recommended):

- seeds/characters/added/<roleId>/profile.json
- seeds/characters/added/<roleId>/source.yaml
- seeds/characters/added/<roleId>/portrait.png (optional, reserved for future image assets)

Runtime lookup uses profile.json as the primary source. source.yaml is kept as raw archive data.

Backward compatibility:

- Legacy flat files in added/ (e.g. <roleId>.json, <roleId>.yaml) are still readable.
- Character loading is local-only. Add or update role folders in this directory before using their IDs in the game.

Current preset source consumed by frontend:
- seeds/characters/presets/5738g/profile.json

## Compliance Requirements (Mandatory)

Every character used in demos/presentations must include traceable attribution metadata.

Required for each role folder:

- `profile.json`
- `source.yaml`
- Optional portrait/cutout files only when provenance is documented

Required metadata in `source.yaml` (recommended block):

```yaml
attribution:
  rights_holder: "Name or team"
  source_type: "original | licensed | public_domain | ai_generated"
  source_url: "https://..."
  license: "License text or SPDX ID"
  modification_note: "What was edited by this team"
  commercial_use: false
```

Rules:

- Keep existing assets for project continuity.
- For every role ID shown in demo/video, add a corresponding entry in `ASSET_ATTRIBUTION.md`.
- If original author name is unavailable, use ID-level reference (`roleId + upstream source URL + access date`).
