"""Optional internal social review board; never a publishable asset."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,sys
r=Path(sys.argv[1]);items=[x for x in json.loads((r/'output/render-manifest.json').read_text()) if x['type']=='social']
sheet=Image.new('RGB',(1200,((len(items)+3)//4)*560),'#e9e7e2');d=ImageDraw.Draw(sheet)
for i,x in enumerate(items):
    im=Image.open(r/'previews'/f"{x['name']}.png");im.thumbnail((280,500));left=i%4*300+10;top=i//4*560+10
    sheet.paste(im,(left,top));d.text((left,top+510),x['name'],fill='black')
sheet.save(r/'INTERNAL-SOCIAL-REVIEW.png')
