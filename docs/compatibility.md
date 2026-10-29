# Compatibility and acceptance evidence

Version 0.1.0 is a development prototype, not production readiness certification.

## Host support

The manifest targets VS Code-compatible extension hosts 1.85+. Cursor desktop is the intended host. This Linux cloud workspace has Node.js 24, npm 11, Python 3.12, and no Cursor or VS Code executable. Therefore installation, native theme appearance, native command availability, Agent preservation, and actual desktop extension activation have **not** been verified. Windows, macOS, remote providers, 10k-file performance, and the full host accessibility matrix are untested.

At runtime the extension enumerates native command IDs before enabling its handoffs. It does not guess private Cursor Agent, account, skill, or MCP APIs. Native Agent and account controls remain outside the webview. Unsupported native handoffs are disabled with a reason. The directory provider supplies real data; no fake workspace is substituted on errors.

## Automated checks

`npm test` exercises theme/icon assets, bridge validation and escaping, a mocked VS Code host with real extension activation code, provider directory listing/navigation, pin toggling, forged URI rejection, command allowlisting, CSP, and provider failures. These tests do not establish desktop compatibility.

`npm run check` checks JavaScript syntax. `npm run package` builds and CRC-checks a dependency-free VSIX. Desktop installation of that artifact remains a manual gate.

## Browser harness evidence

The actual webview HTML, CSS and JavaScript were also exercised in system Chromium through a local-only test harness. The harness supplied a snapshot of this repository’s directory entries through a stand-in VS Code bridge. Six building cards, filename filtering, pin and folder bridge events, fold/unfold state, and a 540px layout without horizontal overflow passed; no page script errors occurred. This is browser validation, not extension-host integration. Screenshots are saved under `dist/village-preview.png` and `dist/village-mobile-preview.png`; they are harness renders, not Cursor screenshots.

## Manual desktop gates

- Install VSIX; select each palette and file icon set; inspect native code, completion, terminal, Agent, settings and diff views. Check text contrast in both palettes.
- Open Village with no root, an empty root, multiple roots, long names, unreadable folders, symbolic links, and a representative remote provider.
- Navigate by keyboard, open a file, pin/unpin it, filter, change roots, and mutate files externally. Confirm native file actions and watcher updates.
- Fold/unfold repeatedly and reverse mid-transition. Verify reduced-motion preferences and focus. Check high contrast, screen readers, narrow windows, and 200% zoom.
- Open each native handoff and confirm missing commands are disabled. No account credentials or Agent approvals should pass through the extension.
- Close the panel and uninstall; confirm defaults can be selected and workspace files are unchanged.

The PDF's AT01, AT02, AT13–AT16 are only partially covered by this prototype and need host QA. AT03–AT12 involving destructive workflows, skill installation, Git revisions, store lifecycle and auth are deferred, not passed. Native tools provide the current route for those operations.

## Assets

All shipped SVGs, CSS building art, and the PNG icon were created for this project and are covered by the repository's MIT license. No embedded PDF concept-board artwork, external fonts, or generated screenshot text is shipped. The village uses original lightweight CSS illustrations rather than a photorealistic replacement shell.
