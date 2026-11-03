# Panda — storyboard de direção

Roteiro aprovado pelo usuário; voz e alinhamento pertencem à produção. **Nenhum tempo final atribuído antes da timeline real.** Os gatilhos abaixo são palavras da fala; o código aplicará o deslocamento inicial de 0,5 s. Cada plano recebe início/meio/fim exportados para QA após o alinhamento.

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
- Checagem textual: 36 chamadas de `wordAt` foram confrontadas com o texto exato aprovado, incluindo ocorrências repetidas. Full typecheck neste marco só encontra a dependência ainda ausente `public/panda/timeline.json`; nenhum tempo provisório foi criado.
- Rodada 1: pendente — contato boca/pata/colmo e textura preta/branca; comparar frame real com cadela/veado.
- Rodada 2: pendente — descascamento, punho/mandíbula, fezes, troca física do colmo e caminhada; registrar correções de cada amostra.
- Rodada 3: pendente — cortes, enquadramento seguro, floração local, loop e capa final; conferir início/meio/fim de cada plano e ações críticas em movimento.
- Limite: prévias e quadros amostrados não equivalem à revisão integral do MP4 final; QA independente pertence à produção após exportar.
