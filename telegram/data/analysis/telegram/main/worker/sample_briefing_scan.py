import json, glob, os, datetime
from pathlib import Path

base = str(Path(__file__).resolve().parents[1] / 'normalized')
files=glob.glob(os.path.join(base,'*.normalized.jsonl'))
cutoff=datetime.datetime.fromisoformat('2026-04-02T00:00:00+09:00')
items=[]
for fp in files:
    with open(fp,'r',encoding='utf-8') as f:
        for line in f:
            try:
                obj=json.loads(line)
            except:
                continue
            ts=obj.get('timestamp_kst')
            txt=(obj.get('text') or '').strip()
            if not ts or not txt or obj.get('is_service'):
                continue
            try:
                dt=datetime.datetime.fromisoformat(ts)
            except:
                continue
            if dt < cutoff:
                continue
            txt1=' '.join(txt.split())
            items.append({'ts':dt,'chat':obj.get('chat_title'),'text':txt1,'views':obj.get('views') or 0})
items.sort(key=lambda x:x['ts'])
print('TOTAL_MESSAGES', len(items))
print('CHANNELS', len(set(i['chat'] for i in items)))
print('LAST_TS', items[-1]['ts'].isoformat() if items else 'NONE')
for x in items[-120:]:
    print(json.dumps({'ts':x['ts'].isoformat(),'chat':x['chat'],'text':x['text'][:280],'views':x['views']}, ensure_ascii=False))
