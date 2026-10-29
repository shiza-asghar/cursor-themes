"""Build an offline VSIX containing only an explicit allowlist of extension files."""
from pathlib import Path
import json, zipfile
from xml.sax.saxutils import escape
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'package.json').read_text())
paths = [root / f for f in ['package.json', 'README.md', 'LICENSE', 'package-lock.json']]
for directory in ['src', 'themes', 'icons', 'media', 'docs', 'examples']:
    paths.extend(sorted(p for p in (root / directory).rglob('*') if p.is_file()))
for p in paths:
    if not p.is_file(): raise SystemExit(f'Missing required file: {p}')
escape_attr = lambda s: escape(s, {'"': '&quot;'})
name, version, publisher = [escape_attr(manifest[k]) for k in ['name','version','publisher']]
vsix = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
<Metadata><Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}"/><DisplayName>{escape(manifest['displayName'])}</DisplayName><Description xml:space="preserve">{escape(manifest['description'])}</Description><Tags>cursor,theme,fantasy</Tags><Categories>Themes,Other</Categories><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="{escape_attr(manifest['engines']['vscode'])}"/><Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/></Properties><License>extension/LICENSE</License><Icon>extension/media/icon.png</Icon></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/media/icon.png" Addressable="true"/></Assets></PackageManifest>'''
content = '''<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="txt" ContentType="text/plain"/><Default Extension="ts" ContentType="text/plain"/><Default Extension="vsixmanifest" ContentType="text/xml"/><Default Extension="" ContentType="text/plain"/></Types>'''
(root / 'dist').mkdir(exist_ok=True)
output = root / 'dist' / f'{manifest["name"]}-{manifest["version"]}.vsix'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('extension.vsixmanifest', vsix)
    archive.writestr('[Content_Types].xml', content)
    for path in paths: archive.write(path, 'extension/' + path.relative_to(root).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
print(output)
