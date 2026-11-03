"""Áudio do panda: mesma trilha sintetizada do kit, efeitos pontuais e pré-mix com respiro inicial."""
import json,math,pathlib,wave
import numpy as np
import trilha as kit
ROOT=pathlib.Path(__file__).resolve().parent.parent
base=ROOT/'public/panda'
tl=json.loads((base/'timeline.json').read_text(encoding='utf-8'))
SR=44100
with wave.open(str(base/'narracao.wav'),'rb') as w:
    assert w.getframerate()==SR and w.getsampwidth()==2 and w.getnchannels()==1
    voice=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
n=math.ceil((tl['duration']+.4)*SR)
music=kit.music(n/SR)[:n]
absolute=np.pad(np.abs(voice),(0,max(0,n-len(voice))))[:n]
window=int(.15*SR)
integral=np.concatenate(([0.],np.cumsum(np.pad(absolute,(window//2,window-window//2)))))
envelope=(integral[window:window+n]-integral[:n])/window
duck=1-.6*np.clip(envelope/(max(envelope.max(),1e-6)*.3),0,1)
amb=music*duck*.22
events=[]
def event(kind,t,gain=.13,dur=None):
    e={'kind':kind,'t':round(t,3),'gain':gain}
    if dur is not None:e['dur']=dur
    events.append(e)
def at(scene,word,occ=0):
    def norm(s):return ''.join(c.lower() for c in s if c.isalnum())
    hits=[w['s'] for c in tl['cenas'] if c['id']==scene for w in c['words'] if norm(w['w'])==norm(word)]
    assert len(hits)>occ,(scene,word)
    return hits[occ]
for c in tl['cenas'][1:]:
    event('whoosh',c['start']-.12,.055,.28)
for sid,word in [('pegada','araque'),('mandibula','triturador'),('rotina','expediente'),('floracao','buffet')]:
    event('pop',at(sid,word),.12)
# Mordidas discretas, sem pico que cubra a voz ou sugestão de osso quebrando.
event('snap',at('gancho','bambu'),.07)
event('snap',at('mandibula','casca'),.07)
event('crackle',at('mandibula','esmaga'),.035,.55)
event('whoosh',at('pegada','osso'),.055,.3)
event('whoosh',at('floracao','florescer'),.045,.4)
event('whoosh',at('floracao','procurar'),.05,.4)
event('snap',at('loop','bambu'),.06)
fx=np.zeros(n+SR*2)
for e in events:
    fn=kit.SFX[e['kind']]
    sound=fn(e['dur']) if 'dur' in e else fn()
    j=max(0,int(e['t']*SR))
    fx[j:j+len(sound)]+=sound*e['gain']
amb+=fx[:n]
fade=int(1.5*SR)
amb[:int(.2*SR)]*=np.linspace(0,1,int(.2*SR))
amb[-fade:]*=np.linspace(1,0,fade)
assert np.isfinite(amb).all()
def save(name,values):
    pcm=(np.clip(values,-.98,.98)*32767).astype(np.int16)
    with wave.open(str(base/name),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
save('trilha.wav',amb)
frames=math.ceil((tl['duration']+.9)*30);full=np.zeros(round(frames/30*SR))
offset=round(.5*SR)
for stem in [voice,amb]:
    size=min(len(stem),len(full)-offset)
    full[offset:offset+size]+=stem[:size]
assert np.isfinite(full).all() and np.max(np.abs(full))<1.1
save('mix.wav',full)
(base/'eventos.json').write_text(json.dumps(events,ensure_ascii=False,indent=2),encoding='utf-8')
print('Panda: trilha própria,',len(events),'efeitos;',frames,'frames;',round(len(full)/SR,3),'s; pico linear',round(float(np.max(np.abs(full))),3))
