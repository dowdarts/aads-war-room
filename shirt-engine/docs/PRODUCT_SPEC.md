# MD Studios Shirt Mockup Engine — Product and technical specification

## Product objective
A reusable local-first professional mockup studio. Users upload a base shirt pattern and genuine logo artwork, assign assets or text to stable physical locations on an approved four-view polo stencil, preview, save, and export. The same project can eventually be opened from an authenticated web/PWA phone interface anywhere.

## Source of truth
`public/master-stencil.png` is the approved master. 1672×941 pixels. The approved layout, lighting, sleeve orientation, and background must remain intact. It is an illustrative mockup, not a manufacturer cutting pattern. An annotated image from the user can be used for calibration but must not replace the clean master.

## Zone semantics
A zone is a physical region with stable ID, geometry, garment-view identifier and allowed clipping/warp mask. Artwork assignments are separate entities. Aliases are semantic labels for content at the same zone, not separate zones.

- FRONT left chest (wearer's left, viewer right): N01 for player given name/nickname; TN01 for team name; also accepts logos/sponsors.
- BACK upper below collar: N02 for player surname; TN02 for team name; also accepts logos/sponsors.
- RIGHT sleeve: RS01 upper stacked/vertical, RS02 lower near cuff horizontal.
- LEFT sleeve: LS01 upper stacked/vertical, LS02 lower near cuff horizontal.
- Additional existing MVP front/back zones F02, F03, F04, B02, B03, B04, B05, B06: artwork and small seam marks; adjust only after user reviews exact zone coordinates.

The original prototype stores aliases as combined strings `N01 / TN01` and `N02 / TN02`; refactor to canonical physical IDs with separate content labels to avoid ambiguities.

## Asset/rendering model
Keep immutable master image; editable independent layers; each layer stores asset ID, canonical zone, x/y, scale, rotation, opacity, z-order, visibility and semantic label. Preserve original file and metadata. Support PNG transparency, SVG and high-res raster assets. Avoid CORS-tainted canvas exports. Render at original coordinate system, independent of responsive viewport. Explicitly distinguish preview scale from export resolution.

For actual base shirt pattern wrapping: obtain clean pattern images for garment panels, calibration masks and optional displacement maps. Do not simply place a full rectangle over garment folds/background. Require user review for mapping quality.

## Project portability
Use versioned schema, migration rules, portable asset packaging and no browser-only opaque IDs. Support local save/open, JSON import/export (with assets embedded or accompanied by archive), and optional cloud storage with consistent IDs and revision history. Autosave drafts and undo/redo. Never lose the originals.

## Security and distribution
Private account, user-scoped storage, HTTPS for hosted version, no hardcoded credentials. Desktop app packaged for owner's OS, web PWA responsive and accessible remotely. Offline edits should not silently overwrite newer cloud revisions.

## Known MVP gaps
No verified manufacturer dimensions; estimated zone coordinates; no base pattern mapping, masking or fabric warp; no multi-project library; no JSON import; no Supabase; no offline desktop installer; no mobile PWA packaging; no confirmed automated tests. The original 1672×941 image is slightly off exact 16:9; padding rather than distortion is the safe approach.
