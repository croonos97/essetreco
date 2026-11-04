"""Ambiente oceânico e cama musical próprios; mantém todas as tomadas na velocidade original."""
import pathlib,sys,json,math,wave,subprocess
ROOT=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'work/pombo-python'))
sys.path.insert(0,str(ROOT/'tools'))
import numpy as np
from trilha import lp_fast,hp_fast
SR=44100
base=ROOT/'public/baleia'
tl=json.loads((base/'timeline.json').read_text(encoding='utf-8'))
with wave.open(str(base/'narracao.wav')) as w:
    assert w.getframerate()==SR and w.getnchannels()==1 and w.getsampwidth()==2
    voice=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
duration=math.ceil((tl['duration']+.9)*30)/30
n=round(duration*SR);offset=round(.5*SR)
t=np.arange(n)/SR;rng=np.random.default_rng(20261104)
amb=lp_fast(rng.normal(0,1,n),650)*.016*(.65+.35*np.sin(2*np.pi*.11*t)**2)
# Harmonia D menor, acordes lentos e harmônicos arredondados; nenhum ativo externo.
for start in np.arange(0,duration,8):
    chord=([146.832,174.614,220],[130.813,174.614,220],[130.813,164.814,195.998],[146.832,195.998,246.942])[int(start/8)%4]
    j=int(start*SR);size=min(int(10*SR),n-j);tt=np.arange(size)/SR
    env=np.minimum(tt/2,1)*np.minimum((size/SR-tt)/2,1)
    for f in chord:amb[j:j+size]+=.004*np.sin(2*np.pi*f*tt+.15*np.sin(2*np.pi*.17*tt))*env
v=np.pad(np.abs(voice),(offset,max(0,n-offset-len(voice))))[:n]
window=int(.15*SR);cs=np.r_[0,np.cumsum(np.pad(v,(window//2,window-window//2)))];level=(cs[window:window+n]-cs[:n])/window
amb*=1-.55*np.clip(level/.07,0,1)
events=[]
def at(scene,word):
    return next(w['s'] for c in tl['cenas'] if c['id']==scene for w in c['words'] if w['w'].strip('.,?!').lower()==word.lower())+.5
def water(time,dur,gain,bright=False):
    size=int(dur*SR);tt=np.arange(size)/SR
    sound=lp_fast(rng.normal(0,1,size),1600 if bright else 500)*np.sin(np.pi*tt/dur)**2*gain
    j=round(time*SR);amb[j:j+min(size,n-j)]+=sound[:min(size,n-j)]
    events.append({'kind':'surface_water' if bright else 'underwater_current','t':time,'duration':dur,'gain':gain,'synthesized':True})
water(at('respirar','Respirou'),.7,.075,True)
water(at('respirar','Mergulha'),1,.045)
water(at('loop','Mergulha'),.7,.035)
amb[:int(.25*SR)]*=np.linspace(0,1,int(.25*SR));amb[-SR:]*=np.linspace(1,0,SR)
mix=amb.copy();mix[offset:offset+len(voice)]+=voice
assert np.isfinite(mix).all() and len(mix)==n and max(np.abs(mix))<1
def save(name,x):
    with wave.open(str(base/name),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((np.clip(x,-.999,.999)*32767).astype(np.int16).tobytes())
save('trilha.wav',amb);save('mix_pre.wav',mix)
subprocess.run(['ffmpeg','-y','-i',str(base/'mix_pre.wav'),'-af','loudnorm=I=-14:TP=-1.2:LRA=7','-ar',str(SR),'-ac','1',str(base/'mix.wav')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
(base/'eventos.json').write_text(json.dumps(events,ensure_ascii=False,indent=2),encoding='utf-8')
def stamp(s):
    ms=round(s*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
captions=[]
for c in tl['cenas']:
    for j in range(0,len(c['words']),5):
        words=c['words'][j:j+5];captions.append(f"{len(captions)+1}\n{stamp(words[0]['s']+.5)} --> {stamp(words[-1]['e']+.5)}\n{' '.join(w['w'] for w in words)}\n")
(base/'legendas.srt').write_text('\n'.join(captions),encoding='utf-8')
print('Mix',duration,'s;',round(duration*30),'quadros;',len(captions),'legendas; sem alteração de velocidade.')
