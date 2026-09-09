"""Ingest browser-downloaded media without network requests or modifying originals."""
from pathlib import Path
import argparse,hashlib,json,shutil
from PIL import Image,ImageDraw,ImageOps

def ingest(manifest,destination):
    source=Path(manifest).resolve();items=json.loads(source.read_text(encoding='utf-8'))
    root=Path(destination);root.mkdir(parents=True,exist_ok=True)
    originals=root/'originals';originals.mkdir(exist_ok=True)
    results=[];seen=set()
    for item in items['photos']:
        path=(source.parent/item['downloaded_file']).resolve()
        raw=path.read_bytes();h=hashlib.sha256(raw).hexdigest()
        if h in seen:continue
        seen.add(h);im=Image.open(path);im.load()
        if im.width<600 or im.height<400:raise ValueError('Thumbnail: retrieve a practical full-size rendition')
        target=originals/(str(items['mls'])+'-'+str(item['number']).zfill(2)+path.suffix)
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=h:raise ValueError('Never overwrite a different original')
        if not target.exists():shutil.copy2(path,target)
        results.append({'id':str(item['number']),'file':str(target.resolve()),'sha256':h,'source_url':item['url'],'width':im.width,'height':im.height,'roles':[],'fit':{},'focal':[.5,.5],'excluded':False})
    sheet=Image.new('RGB',(1000,((len(results)+3)//4)*195),'white');draw=ImageDraw.Draw(sheet)
    for n,item in enumerate(results):
        im=ImageOps.exif_transpose(Image.open(item['file']));im.thumbnail((246,166))
        x=n%4*250;y=n//4*195;sheet.paste(im,(x,y));draw.text((x+3,y+170),item['id'],fill='black')
    sheet.save(root/'CONTACT-SHEET.jpg',quality=90)
    (root/'candidates.json').write_text(json.dumps({'mls':str(items['mls']),'rights':'NEEDS CONFIRMATION','candidates':results},indent=2))
    return results
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['ingest']);p.add_argument('--manifest',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    print(len(ingest(a.manifest,a.out)))
