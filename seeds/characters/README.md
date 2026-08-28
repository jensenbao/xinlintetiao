# Characters Seed Directory

This directory centralizes local NPC asset management:

- `defaults.json`: the only registry that decides which preset characters load by default
- `presets/`: bundled character asset packages
- `custom/`: locally stored custom character asset packages

Canonical folder layout:

```text
seeds/characters/
├─ defaults.json
├─ presets/<readable-slug>/
│  ├─ character.json
│  ├─ source.yaml
│  └─ portrait.*
└─ custom/<readable-slug>/
   ├─ character.json
   ├─ source.yaml
   ├─ portrait.*
   ├─ concept.png (optional)
   ├─ pixel.png (optional)
   └─ image-generation.json (optional)
```

Rules:

- Every NPC has exactly one `character.json` runtime manifest.
- Folder names use readable slugs; stable internal IDs remain inside the manifest for save compatibility.
- `source.yaml` is an archive and attribution source, not a runtime character definition.
- Character loading is local-only. The runtime indexes only `character.json` under `presets/` and `custom/`.
- Adding a preset does not make it a default. Add its slug to `defaults.json` explicitly.

Current default preset manifests:

- `seeds/characters/presets/captain-quick/character.json`
- `seeds/characters/presets/aquabyte-98/character.json`

## Compliance Requirements (Mandatory)

Every character used in demos/presentations must include traceable attribution metadata.

Required for each role folder:

- `character.json`
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
