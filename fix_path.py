with open('report.tex', 'r') as f:
    content = f.read()

content = content.replace('/home/mukama/.gemini/antigravity/brain/090a4a62-df78-4ba8-8882-18b00cbe6561/browser/login_page_1776453699653.png', '/home/mukama/.gemini/antigravity/brain/090a4a62-df78-4ba8-8882-18b00cbe6561/login_page_1776453699653.png')

with open('report.tex', 'w') as f:
    f.write(content)

print("Fixed path")
