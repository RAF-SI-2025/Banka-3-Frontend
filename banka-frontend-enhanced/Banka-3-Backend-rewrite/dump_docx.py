import zipfile
import re
from pathlib import Path

path = Path(r'C:\Users\Bekica\AppData\Local\Temp\48c1d4cf-4238-4e8b-b20a-5c2ddb98910b_drive-download-20260515T151513Z-3-001.zip.10b\Celina 5(Nova).docx')
print('DOCX EXISTS:', path.exists())
if not path.exists():
    raise FileNotFoundError(path)

with zipfile.ZipFile(path) as z:
    for name in z.namelist():
        if name == 'word/document.xml' or name.startswith('word/header') or name.startswith('word/footer'):
            xml = z.read(name).decode('utf-8', errors='ignore')
            xml = re.sub(r'<w:t[^>]*>', '', xml)
            xml = xml.replace('</w:t>', ' ')
            xml = re.sub(r'<[^>]+>', '', xml)
            print('FILE:', name)
            print(xml)
