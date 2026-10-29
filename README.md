# Codehaven

**Your project becomes a living village.** Codehaven brings the supplied Design Atlas to Cursor with an illustrated Village Map for navigation and a **Guild Workshop** for editing real text files. Native Cursor remains one click away for Agent, language tooling, diffs, and authentication.

## Preview the theme

### Guild Workshop — illustrated code editor

A building-free guild interior with a large parchment code editor, expandable project scroll, mage portrait, guild tool menus, and pinned-file worktable.

![Codehaven Guild Workshop editing the included TypeScript example inside a candlelit interior](docs/screenshots/workshop.png)

This is a browser capture of the implemented CodeMirror editor and Workshop UI, displaying `examples/workshop.ts`. The capture uses a stand-in host document bridge; desktop Cursor integration still needs validation. Editing and Save are implemented through Cursor’s public custom text editor API. Workshop is optional, supports text files up to two million characters, and provides a **Native editor** button. It has syntax highlighting, undo/redo, and basic editor keybindings; it does not reproduce Cursor’s native IntelliSense, Agent, debugger, or full language-server features. Use the native editor for those capabilities.

### Nightfall

A woodland dark palette with warm gold accents, sage strings, and soft violet keywords.

![Codehaven Nightfall palette preview showing sample TypeScript and file icons](docs/screenshots/nightfall.png)

### Parchment

A warm light palette with dark ink, moss-green strings, and restrained purple keywords.

![Codehaven Parchment palette preview showing sample TypeScript and file icons](docs/screenshots/parchment.png)

The editor images above are rendered palette previews using the shipped theme colors and file icons, with sample code and an illustrative editor layout. They are not screenshots taken inside Cursor; native appearance may vary with your Cursor version and settings.

### Optional village view

A painterly fantasy village with labeled house districts, a parchment Project Scroll, Companion panel, fixed guild stations, and a bottom inventory. Folder labels and file cards are live controls over one continuous village scene. Expand folder rows directly in the scroll, enter districts from the map, switch workspace roots, and hand off supported actions to native Cursor tools.

Village and Workshop have distinct illustrated environments. Workshop uses an interior without buildings; Village uses the outdoor world. The standard native editor uses the Nightfall or Parchment palette above. Neither view patches Cursor’s workbench.

![Codehaven Village Map showing labeled house districts, Project Scroll, Companion, guild stations, and inventory](docs/screenshots/village.png)

This is a browser capture of the implemented village webview with a repository directory snapshot supplied by a test bridge. The village is an optional extension tab; it does not replace Cursor's editor. Advanced interactions listed below remain outside this prototype.

## Install in Cursor

1. Download or build `dist/runegrove-0.5.0.vsix`.
2. In Cursor, run **Extensions: Install from VSIX…** from the command palette and select that file.
3. Run **Preferences: Color Theme** and choose **Codehaven Nightfall** or **Codehaven Parchment**.
4. Run **Preferences: File Icon Theme** and choose **Codehaven File Icons**.
5. For the illustrated code editor, open a text file and run **Codehaven: Open Guild Workshop**, or use **Reopen Editor With… → Codehaven Guild Workshop**.
6. For the world map, run **Codehaven: Open Village Map**.

The VSIX is a local development package, not a published Marketplace release. The `runegrove` publisher name is a local package identity; ownership of a marketplace publisher is not asserted.

## What works in this prototype

- Dark woodland and light parchment themes, syntax colors, terminal palette, and accessible native red/green diff colors.
- Original SVG file and folder icons.
- An optional Atlas-style Village Map with real workspace-provider directory listings, labeled house districts, multi-root selection, a Companion panel, fixed guild stations, a lazy expandable folder tree, native file opening, and session-scoped inventory pins.
- A folding parchment archive: both rollers move toward the center together; rapid toggles reverse the height transition. Selection and the file list are not rebuilt by folding.
- Native Source Control, terminal, extension catalog, search, settings, Explorer, and command palette handoffs, enabled only when the command exists in the host.
- Watcher-based refresh, errors reported in place, keyboard controls, visible focus, responsive layout, and reduced motion (`runegrove.reduceMotion` or OS preference).

This is a theme, a bounded Village prototype, and an optional Workshop custom text editor. No custom Git graph, skill installer, MCP registration, account facade, drag-to-Trash, Agent Ignore edits, custom product-icon font, energy overlay, sound, or wizard is implemented. Those remain later phases from the specification. No static sample data is presented as live Git or tool state. Pins do not copy or delete files and reset when the Village panel closes. File filtering is for the current directory; The Scout opens native workspace-wide search.

## Development

Use the existing checkout; cloud tasks already have isolated workspaces, so no Git worktree is needed. Node.js 18+ and Python 3.9+ are required. Run `npm ci` to install the lockfile-pinned CodeMirror and esbuild dependencies, then build the browser editor bundle. Installed VSIX packages include the bundle and artwork and need no runtime network access.

```sh
cd /workspace/cursor-themes
npm ci
npm run build
npm run check
npm test
npm run package
```

Open this repository in Cursor or VS Code and use **Run Codehaven** in Run and Debug (`F5`) to launch an Extension Development Host. No compiler or background service is necessary. Use the theme picker and open Village Map in that host.

## Privacy and safety

Activation makes no network requests, runs no shell commands, changes no editor settings, and performs no background workspace writes. Explicit Workshop edits update the host TextDocument; Save persists that document through the host. Stale-version edits are rejected and the local editor text is preserved for review. File references originate from the host listing; arbitrary webview paths and arbitrary command IDs are rejected. Webview names use text nodes, scripts use a nonce CSP, and no remote assets load. Symbolic links and provider-specific behavior remain under the native filesystem/editor provider. Restricted Mode keeps Village read-only and disables Workshop editing. Native tools retain the host's trust and authorization controls.

## Reset and uninstall

Close Village Map, select another color theme and file icon theme, then uninstall Codehaven from Extensions. No workspace migration or cleanup is required. Native editor UI remains available throughout.

See [compatibility and test evidence](docs/compatibility.md) for validation boundaries. The supplied PDF is a design reference; its embedded implementer instructions do not replace the user's request or runtime capabilities.
