import re, os, json

dirs = ['methodology', 'case-studies', 'tools', 'frameworks']
ascii_pattern = re.compile(r'[┌┐└┘├┤┬┴┼─│╔╗╚╝║═╠╣╦╩╬▷◀▸◄▲▼]')

results = []
for d in dirs:
    if not os.path.isdir(d):
        continue
    for fname in sorted(os.listdir(d)):
        if not fname.endswith('.md'):
            continue
        fpath = os.path.join(d, fname)
        with open(fpath, 'r') as f:
            content = f.read()
        
        blocks = list(re.finditer(r'```\w*\n(.*?)```', content, re.DOTALL))
        for m in blocks:
            block = m.group(1)
            lines = block.strip().split('\n')
            ascii_lines = [l for l in lines if ascii_pattern.search(l)]
            if len(ascii_lines) >= 2:
                results.append({
                    'file': fpath,
                    'start': m.start(),
                    'end': m.end(),
                    'original': m.group(0),
                    'ascii_count': len(ascii_lines)
                })

for r in results:
    print(f"=== {r['file']} (pos {r['start']}-{r['end']}, ascii_lines={r['ascii_count']}) ===")
    print(r['original'])
    print()
