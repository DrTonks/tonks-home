"""Import an OwO manifest as inert local raster assets; never copy its HTML."""
import concurrent.futures, hashlib, json, re, shutil, sys, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/emojis'
PACKS = {'Emoji':'unicode','Azukisan':'azukisan','Bilibili':'bilibili','Blobcat':'blobcat','2233':'2233'}
def raster_ext(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'): return 'png'
    if data.startswith((b'GIF87a',b'GIF89a')): return 'gif'
    if data.startswith(b'\xff\xd8\xff'): return 'jpg'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP': return 'webp'
    raise ValueError('not an allowed raster image')
def download(job):
    pack,entry,url = job
    key=hashlib.sha256(url.encode()).hexdigest()[:16]
    for attempt in range(3):
        try:
            cached=list((OUT/'v1'/pack).glob(f'{key}.*'))
            if cached: dest=cached[0]
            else:
                fetch_url=url
                # Original OwO Bilibili mirror now returns HTML; use the original CDN asset hash.
                if url.startswith('https://owo.imaegoo.com/bilibili/'):
                    fetch_url='https://i0.hdslb.com/bfs/emote/'+url.rsplit('/',1)[1]
                fetch_url=urllib.parse.quote(fetch_url,safe=':/?=&%')
                req=urllib.request.Request(fetch_url,headers={'User-Agent':'Mozilla/5.0'})
                with urllib.request.urlopen(req,timeout=15) as response: data=response.read(4_000_001)
                if len(data)>4_000_000: raise ValueError('image too large')
                ext=raster_ext(data)
                dest=OUT/'v1'/pack/f'{key}.{ext}'
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(data)
            return pack,{'token':f':{pack}:{key}:','label':str(entry.get('text') or pack),'src':'/emojis/'+dest.relative_to(OUT).as_posix()},None
        except Exception as e:
            if attempt==2:return pack,None,{'url':url,'error':str(e)}

source_file=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'scripts/emoji-sources/owo.json'
source=json.loads(source_file.read_text(encoding='utf8'))
groups={};jobs=[];failures=[]
for label,pack in PACKS.items():
    group={'id':pack,'label':label,'items':[]};groups[pack]=group
    for i,item in enumerate(source[label]['container']):
        if source[label]['type']=='image':
            match=re.search(r'src=[\'"]([^\'"]+)[\'"]',item['icon'])
            if not match or not match[1].startswith('https://'): raise ValueError('unsafe image URL')
            jobs.append((pack,item,match[1]))
        else:
            value=str(item['icon'])
            if '<' in value and source[label]['type']=='emoji': continue
            group['items'].append({'token':f':{pack}:{i}:','label':value,'text':value})
laopu={'id':'laopu','label':'老普专用','items':[]}
labels={'angry':'生气','angry2':'气鼓鼓','cry':'哭哭','happy-1':'开心','happy-2':'好耶','sleep':'睡觉','think':'思考','wait':'等待'}
for file in sorted((ROOT/'public/assets/emoji').glob('*.jpg')):
    dest=OUT/'v1/laopu'/file.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,dest)
    laopu['items'].append({'token':f':laopu:{file.stem}:','label':labels.get(file.stem,file.stem),'src':'/emojis/v1/laopu/'+file.name})
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    for pack,item,error in pool.map(download,jobs):
        if error:failures.append(error)
        else:groups[pack]['items'].append(item)
ordered=[groups['unicode'],laopu,groups['2233'],groups['bilibili'],groups['azukisan'],groups['blobcat']]
manifest={'version':1,'groups':ordered}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'.tmp-emoji-download-failures.json').write_text(json.dumps(failures,indent=2),encoding='utf8')
print(json.dumps({'groups':{g['id']:len(g['items']) for g in ordered},'failures':len(failures)}))
