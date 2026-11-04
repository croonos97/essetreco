"""Alinha as sete tomadas aprovadas sem prompt e registra a conferência ASR."""
import sys, pathlib, json, difflib
assert sys.flags.utf8_mode, 'Execute com python -X utf8 para evitar mojibake na ferramenta narrar.py.'
ROOT=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'work/pombo-python'))
sys.path.insert(0,str(ROOT/'tools'))
sys.stdout.reconfigure(encoding='utf-8')
import faster_whisper
Original=faster_whisper.WhisperModel
reports=[]
class CheckedModel:
    def __init__(self,*args,**kwargs):
        cache=pathlib.Path('C:/Users/gnnoc/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots')
        self.model=Original(str(next(cache.iterdir())),device='cpu',compute_type='int8',cpu_threads=2)
    def transcribe(self,audio,**kwargs):
        expected=kwargs.pop('initial_prompt')
        segments,info=self.model.transcribe(audio,**kwargs)
        segments=list(segments)
        heard=' '.join(s.text.strip() for s in segments)
        a=' '.join(narrar.norm(w) for w in expected.split())
        b=' '.join(narrar.norm(w) for w in heard.split())
        score=difflib.SequenceMatcher(None,a,b).ratio()
        reports.append({'cena':len(reports)+1,'esperado':expected,'ouvido':heard,'similaridade':score,'sem_prompt':True})
        print('ASR',len(reports),round(score,4),heard,flush=True)
        return iter(segments),info
faster_whisper.WhisperModel=CheckedModel
import narrar
script=ROOT/'roteiros/baleia.json'
data=json.loads(script.read_text(encoding='utf-8-sig'))
data['status']='APROVADO pelo usuário; produção e narração autorizadas'
keywords=[['mama','d’água','jubarte'],['mamilos','fendas','abastecimento'],['gordura','crescer','camada'],['respirar','cabeça','Mergulha'],['comer','gordura','corpo'],['crescer','viagem','leite'],['Mergulha','mama','respirar']]
for c,k in zip(data['cenas'],keywords):c['keywords']=k
script.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
sys.argv=[__file__,str(script),str(ROOT.parent.parent/'03_Narracoes/baleia')]
narrar.main()
dest=ROOT/'docs/baleia';dest.mkdir(parents=True,exist_ok=True)
(dest/'TRANSCRICAO_CONFERIDA.json').write_text(json.dumps({'metodo':'faster-whisper small CPU int8, sem initial_prompt; comparação normalizada; não equivale a escuta humana','cenas':reports,'divergencias_asr':{'cena1':'small: ama; base: mama, sem prompt','cena5':'small: apaga; base: paga, sem prompt'},'segundo_modelo':'TRANSCRICAO_SEGUNDO_ASR.json; segunda leitura independente reconheceu mama e paga; nenhuma tomada regenerada'},ensure_ascii=False,indent=2),encoding='utf-8')
assert len(reports)==7 and min(x['similaridade'] for x in reports)>.94
