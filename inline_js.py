import os

def inline_js():
    html_path = "index.html"
    js_path = "app.js"

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()

    # Replace the script tag
    target_tag = '<script src="app.js"></script>'
    
    if target_tag in html:
        new_tag = f"<script>\n{js}\n</script>"
        html = html.replace(target_tag, new_tag)
        
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        print("Successfully inlined app.js into index.html")
        
        # Optionally, delete app.js to avoid confusion
        os.remove(js_path)
    else:
        print("Target tag not found or already inlined.")

if __name__ == "__main__":
    inline_js()
