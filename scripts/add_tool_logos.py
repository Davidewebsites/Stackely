import json
from urllib.parse import urlparse
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "app" / "backend" / "mock_data" / "tools.json"

data = json.loads(path.read_text(encoding="utf-8"))
changed = False

for tool in data:
    logo_url = tool.get("logo_url")
    website = tool.get("website_url")

    if not logo_url and website:
        try:
            domain = urlparse(website).hostname
            if domain:
                domain = domain.lstrip("www.")
                logo_url = f"https://logo.clearbit.com/{domain}"
                tool["logo_url"] = logo_url
                changed = True
        except Exception:
            pass

    # Add `logo` field if missing
    if "logo" not in tool:
        if logo_url:
            tool["logo"] = logo_url
            changed = True
        elif website:
            try:
                domain = urlparse(website).hostname
                if domain:
                    domain = domain.lstrip("www.")
                    tool["logo"] = f"https://logo.clearbit.com/{domain}"
                    changed = True
            except Exception:
                pass

if changed:
    path.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Updated tools.json adding logo fields where missing.")
else:
    print("No changes needed to tools.json.")
