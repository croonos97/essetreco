# Panda — storyboard de direção

Roteiro aprovado pelo usuário; voz e alinhamento pertencem à produção. **Tempos fechados somente após receber a timeline Fish real:** 84,448s de áudio, deslocamento inicial de 0,5s, composição de 2561 quadros a 30fps (85,367s). Os gatilhos abaixo são palavras da fala; os limites e quadros de início/meio/fim dos 39 planos estão em `PLANOS.json` para o QA final.

Direção: mundo contínuo de bambu, montanhas e trilha. Panda sentado na origem, frente +Z, chão Y0; tronco de repouso em [-1,65; 0,32; 1,35]. Mancha que seca à esquerda; floresta verde à direita/fundo permanece viva. Pilha de colmos alcançável em [-0,25; 0; 0,65], alinhada ao centro da pega baixa [-0,20; 0,32; 0,66]; comprimento do colmo permanece constante ao subir. Último plano retorna à pose, mordida, câmera e iluminação do primeiro. Só o plano corrente monta atores/esquema. Fonte MontserratET do kit; legendas embaixo e headline segura no topo.

| Plano | Gatilho da fala | Ação / câmera / causa visível |
|---|---|---|
| 01 | gancho: início | Panda já segura e morde colmo; olhos/orelhas inteiros, dolly lateral; headline VOCÊ CAI DE BOCA / NO BAMBU. |
| 02 | contradicao: início | Abrir câmera, revelar corpo sentado e floresta densa na identificação do panda. |
| 03 | contradicao: Parece | Lateral da mordida; mesma pata e mesmo colmo; fibras no chão. |
| 04 | contradicao: intestino | Seguir fragmento da boca; corpo continua panda, sem transformação em carnívoro. |
| 05 | contradicao: carnívoro | Esquema breve de estômago/tubo intestinal rotulado SEM ESCALA; voltar ao exterior na próxima cena. |
| 06 | pegada: início | Pata abaixa e pega colmo da pilha visível; colmo acompanha a pata. |
| 07 | pegada: ajuda | Close na pata real segurando; cinco dedos e apoio lateral. |
| 08 | pegada: sexto | Outro lado do punho mostra saliência, sem sexto dedo humano. |
| 09 | pegada: osso | Janela local de raio X revela sesamoide; curto, sem pele aberta. |
| 10 | pegada: funciona | Transparência fecha; pata aperta o mesmo bambu, câmera sobe até boca. |
| 11 | pegada: araque | Fechar gag na pegada e mordida; label POLEGAR DE ARAQUE por até 1,5 s. |
| 12 | mandibula: início | Colmo preso na posição de mordida; close 3/4 preserva olhos. |
| 13 | mandibula: casca | Dentes puxam casca; tiras caem e permanecem no chão. |
| 14 | mandibula: esmaga | Parte interna clara mastigada entre dentes; mesma direção do colmo. |
| 15 | mandibula: músculos | Corte curto da mandíbula mostra molares e músculos em movimento; SEM ESCALA. |
| 16 | mandibula: triturador | Voltar à mordida completa; pagar gag TRITURADOR sem cartaz. |
| 17 | digestao: início | Mastigar com descarte acumulado já visível; câmera muda para o outro lado. |
| 18 | digestao: aproveita | Esquema curto: pontos dourados deixam tubo; fibra verde segue adiante. |
| 19 | digestao: parte | Saída do esquema acompanha fibras até dejeto estilizado no chão, sem gore. |
| 20 | digestao: trabalho | Contracampo baixo com panda mastigando e resíduos abaixo, mantendo floresta. |
| 21 | rotina: início | Plano aberto: panda, pilha, descartes, tronco e outra mancha verde. |
| 22 | rotina: metade | Sol/luz atravessa dia; panda continua comendo; indicação variável 10–16 H. |
| 23 | rotina: procurando | Panda anda até pilha e encontra outro colmo; patas no chão. |
| 24 | rotina: outro | Pata retira colmo da pilha e eleva para a boca; pilha perde uma unidade. |
| 25 | rotina: expediente | Volta à mastigação, mais descartes; label EXPEDIENTE fecha a ação. |
| 26 | descanso: início | Panda repousa junto ao tronco já estabelecido, boca fecha e colmo fica no chão. |
| 27 | descanso: cocô | Contracampo mostra novo dejeto surgindo atrás do panda; foco no corpo/cenário, sem ânus. |
| 28 | descanso: serviço | Reação pequena de cabeça/corpo, ambiente ainda vivo, boca continua fechada. |
| 29 | floracao: início | Revele a mancha local da esquerda e o caminho para a direita verde. |
| 30 | floracao: espécie | Close dos colmos da mesma mancha/espécie; brotos florais aparecem. |
| 31 | floracao: florescer | Floração na mancha local com folhas e flores legíveis; direita permanece verde. |
| 32 | floracao: morrer | Lapso temporal separado do dia de alimentação; esquerda seca progressivamente. |
| 33 | floracao: procurar | Panda quadrúpede atravessa trilha em direção à mancha verde distante. |
| 34 | floracao: buffet | Chega à nova área verde; a mancha seca continua no fundo, sem renascer. |
| 35 | loop: início | Nova pata segura novo colmo; breve lembrança do pseudopolegar. |
| 36 | loop: mandíbula | Mandíbula morde o colmo segurado; ação externa sem novo esquema. |
| 37 | loop: dia | Abrir floresta e pilha, comer/descartar continua. |
| 38 | loop: Tudo | Colmo sobe das patas para a boca; aproximar câmera da abertura. |
| 39 | loop: Você | Mesma pose e enquadramento inicial; última frase termina na alimentação, sem CTA/cartela. |

## Evidências e rodadas

- Planejamento: 39 planos previstos, sujeitos a dividir/reunir apenas conforme duração real da voz. Marcadores repetidos usarão ocorrência explícita; validação impede intervalos negativos/zerados.
- Pré-checagem de ativos: inspecionei `out/panda_model_eat_r3.jpg` e as pranchas reais `[APROVADO] folha-de-contato-animais_cadela.jpg` / `veado.jpg`. O panda tem preto/branco e pelo legíveis, colmo entre as duas patas e os incisivos, olhos/orelhas inteiros. Como na cadela, o pelo separa focinho/olhos e corpo; falta ainda comprovar essa leitura com a floresta/luz/câmera da composição. Esta pré-checagem não conta como rodada da direção final.
- Checagem textual inicial: 36 chamadas de `wordAt` foram confrontadas com o texto exato aprovado, incluindo ocorrências repetidas. Depois da voz real, os marcadores finais foram resolvidos com sucesso pelo bundle. Não houve timeline provisória.
- Rodada 1: executada em `out/panda_direcao_r1/sheet.jpg`, 16 quadros reais (tempos completos em `tempos.json` da pasta). Gancho 1,20s, pega 10,37s, punho 16s, casca 23,03s, mandíbula 26,57s, digestão 36,67s, troca 51,93s, repouso 55,73s, cocô 58,73s, florescer 65,73s, secagem 68,13s, rota 71,20s, encontro 73,40s e loop 84,27s. Comparação com pranchas cadela/veado: pelo, rosto, mordida e densidade da floresta leem bem e mantêm a régua; porém cocô encoberto por rocha/costas e encontro 100% encoberto por colmo são defeitos materiais. Mandíbula/punho muito cortados; texto 10–16H cruza topo da cabeça. Nota visual provisória 6,5/10 por legibilidade dessas ações, não potencial de views.
- Correções antes da rodada 2: abrir punho 1,65→1,25 e mandíbula 1,8→1,4 com câmera mais longe; novo contracampo de cocô [-1,8;1,4;-2,2], dejetos ao lado posterior do corpo; chegada alinhada à trilha [2,7;0;-4,8] com câmera no corredor [1,4;1,6;-1,2]; enquadrar mancha seca à esquerda e flores perto das ramificações; dar espaço acima da cabeça na troca de colmo e subir faixa 10–16H; ampliar esquema intestinal inicial de 0,93s para 1,75s. Estas são alterações da direção/cenário, não novas aprovações das mesmas imagens.
- Rodada 2: executada em `out/panda_direcao_r2/sheet.jpg`, 16 quadros reais com tempos em `tempos.json`. Punho/mandíbula passaram a caber inteiros; faixas não cruzam cabeça; flores, secagem local e encontro verde se tornaram legíveis. Comparação contra as mesmas referências reais: detalhe de pelo e floresta mantidos; esquema usa janelas curtas como os mecanismos das referências. Restaram rocha cobrindo parte dos dejetos no27 e panda fora da lateral no início do33; rodada não foi tratada como aprovação desses defeitos.
- Correções antes da rodada 3: câmera27 entrou na clareira [-0,15;1,7;-1,3], deixando o resíduo no chão visível ao lado posterior; caminhada começa em “Quando”, dura 4,30s em vez de 2,36s, e câmera acompanha do começo ao fim até o mesmo enquadramento de chegada; ator gira antes de sentar. Capa ganhou câmera própria mais aberta/alta para separar headline das orelhas.
- Rodada 3: executada em `out/panda_direcao_r3/`, **55 quadros reais** cobrindo o centro dos39planos e início/fim de8ações críticas (pega06, casca13, resíduo19/20, nova pega24, cocô27, caminhada33 e reencontro34). Pranchas `sheet_01_13.jpg`, `sheet_14_26.jpg`, `sheet_27_39.jpg`, `sheet_limites.jpg` e `sheet_suplemento19_20.jpg`; tempos em `tempos.json` e `suplemento_19_20.json`. Ampliar a cobertura revelou outro bloqueio no19: tronco tapava o resíduo. Corrigi19/20 colocando resíduos no chão frontal livre [0,6;0;0,25] e close pelo lado oposto; os seis quadros suplementares foram renderizados e inspecionados depois da correção. Resíduo/fibras, 2→3 dejetos em repouso, boca fechada, flores, mancha seca, rota e chegada agora aparecem nas amostras. Nota visual provisória das amostras:8/10, sem atribuir nota ao MP4 ainda não exportado.
- Capa final: `out/capa_panda.png`, 1080×1920, 2.248.711bytes; aberta e inspecionada. MontserratET branca/amarela dentro do centro3:4, rosto/orelhas e mordida visíveis, sem texto sobre o contato.
- Loop: PNGs reais `loop_0.png` e `loop_2560.png`; comparação pixel a pixel da região abaixo de y480 na resolução final (y240 na prévia540×960) deu **diferença RGB média0 e nenhum pixel diferente**. Headline inicial fica fora dessa região; pose, colmo, patas, câmera, vegetação e luz casam exatamente.
- Verificações finais: typecheck completo passou; três bundles/renderizações de amostras concluíram; 39planos contíguos, menor0,689s, nenhuma janela anatômica≥5s. Renderizações locais foram apenas stills, sem filme longo, voz nova, commit ou push.
- Limite: stills e limites amostrados não comprovam fluidez em velocidade normal, sincronismo ouvido ou todos os quadros de todos os planos. Há início/meio/fim exportados para todos os39planos, mas começo/fim foram renderizados nesta direção para8ações; o QA independente deve conferir movimento e áudio no MP4 exportado, além dos demais cortes. Nenhuma aprovação integral de MP4 foi declarada.
