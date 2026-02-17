
import fs

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_index = -1
end_index = -1

# Find the script block. We know it starts around line 195 and ends around line 4080.
# We look for the <script> tag that starts the main js logic.
# Line 195 was <script>
# Line 4080 was </script>

for i, line in enumerate(lines):
    if '<script>' in line and i > 150: # Avoid earlier scripts
        start_index = i
        break

for i in range(len(lines) - 1, -1, -1):
    if '</script>' in lines[i]:
        end_index = i
        break

if start_index != -1 and end_index != -1:
    js_content = lines[start_index + 1 : end_index]
    
    # Save js content to js/app.js
    with open('js/app.js', 'w', encoding='utf-8') as f_js:
        f_js.writelines(js_content)
    
    # Replace the script block in index.html
    new_lines = lines[:start_index] + ['    <script type="module" src="js/app.js"></script>\n'] + lines[end_index + 1:]
    
    with open('index.html', 'w', encoding='utf-8') as f_html:
        f_html.writelines(new_lines)
    
    print(f"Extracted JS from line {start_index + 1} to {end_index + 1} into js/app.js")
else:
    print("Could not find script block")
