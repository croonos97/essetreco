# Panda — QA independente: adendo do MP4 corrigido

**Correção visual APROVADA. Sem bloqueador material aberto no reteste.** A aprovação é da correção e regressão visual/técnica; reprodução normal e escuta continuam pendentes, portanto não declaro checklist integral de 100% nem aprovação perceptual final.

Arquivo atual: `out/panda_render_corrected.mp4`. SHA-256: `5b273560923ad8529cd94f86f9a2b60e4a950808b230027e20321803d0795b54`. Auditoria: 2026-11-03.

**Notas no escopo visual: 7,5/10 para imagem; 7,0/10 para execução editorial; geral visual 7,0/10.** A causa da reprovação anterior foi removida. A composição continua com bastante repetição da alimentação sentada; as ressalvas não bloqueantes e os limites anteriores permanecem. Não atribuo probabilidade de alcance.

## Reteste independente 23 → 24 → 25

- Plano 23: início/meio/fim vistos em f1424/1479/1535 (47,467/49,300/51,167 s); panda se aproxima da pilha.
- Plano 24: os **47 quadros consecutivos f1536–1582 (51,200–52,733 s)** foram extraídos diretamente do novo MP4 e vistos nas três pranchas. O enquadramento lateral mostra a pilha, o contato baixo das patas e o mesmo colmo subindo; o tronco deixou de cobrir a ação. A pilha perde unidade por volta de f1560/52 s. O contato inicial já está estabelecido na primeira imagem; a comprovação é do afastamento/retirada e elevação visíveis, sem reivindicar biomecânica naturalista dos dedos.
- Plano 25: início/meio/fim vistos em f1583/1597/1611 (52,767/53,233/53,700 s); colmo continua na boca e a alimentação paga a ação anterior.
- Cortes f1535→1536 e f1582→1583 vistos: mudança de câmera intencional, sem sumiço do colmo ou obstrução material da ação no corte. Parte lateral da cabeça sai do quadro no close 24; mãos, pilha e alimentação seguem legíveis.

Evidências novas: `out/panda_qa_corrected/plan_23_000.jpg`, `plan_24_000.jpg`, `plan_24_018.jpg`, `plan_24_036.jpg` e `plan_25_000.jpg`. Cada miniatura tem número de quadro e tempo. PNGs originais das extrações e logs ficam na mesma pasta.

## Regressão técnica e loop

| Verificação | Novo resultado | Comparação |
|---|---|---|
| Duração/quadros | 85,366667 s / 2561 | Preservados |
| Resolução/fps | 1080×1920 / 30 fps constante | Preservados |
| Codecs | H.264 High/yuv420p; AAC mono 44,1 kHz | Preservados |
| Loudness/pico | −15,5 LUFS / −1,2 dBTP | Sem regressão; mesma tolerância anterior |
| Áudio decodificado | WAV/PCM idêntico byte a byte ao MP4 anterior | Mesma faixa sonora, sem alteração detectada |
| Verificador | 0 FAIL / 2 WARN | Persistem alertas de cor e faixa separada de legendas |
| Loop abaixo de y480 | Diferença média RGB 1,7149/255; antes 1,7121 | Sem regressão material visual |
| Primeiro/último vistos | Pose, colmo e câmera correspondentes; headline apenas no início | Preservado |

Evidências: `out/panda_qa_corrected/probe.json`, `check.json`, `metrics.json`, `loop_compare.jpg` e PNGs `loop_0.000s.png` / `loop_85.331s.png`. As pequenas diferenças entre quadros comprimidos não permitem chamar o loop de igualdade pixel a pixel.

## Limite e veredito atual

**QA-P24-RETIRADA resolvido; correção visual aprovada.** Não alterei produção, código, voz ou arquivos entregáveis. Este reteste reviu a cadeia 23–25, medidas, áudio técnico e extremos do loop; não foi uma segunda inspeção completa dos 39 planos. A primeira inspeção de 117 pontos e sequências críticas permanece abaixo como histórico da versão anterior.

Não assisti à reprodução contínua em velocidade normal e não ouvi o áudio como uma pessoa. Identidade PCM, loudness e transcrição não equivalem a escuta; naturalidade, mascaramento, cliques e sincronismo perceptual continuam pendentes. Nenhuma publicação foi autorizada por este parecer.

---

# Histórico — primeira auditoria da versão anterior

O parecer abaixo vale para `panda_render_cloud.mp4`. Sua reprovação pelo plano 24 foi superada exclusivamente pelo adendo acima; não descreve o estado do MP4 corrigido.

# Panda — QA independente do MP4 exportado

**REPROVADO — pendente de correção e novo QA. Não há aprovação final nem checklist100%.**

Arquivo: `out/panda_render_cloud.mp4` · SHA-256 `0de858f13ec4a3b78d7fbb99b96f906defeb39250e28fbf67473ec7b14aba318` · auditoria2026-11-03.

O bloqueador é o plano24(51,20–52,745s): o tronco encobre a fase de retirada do segundo colmo. A subida é visível, porém a cadeia pilha→pata→colmo não é demonstrada. Evidência: `out/panda_qa_final/crit_24_000.jpg` e `planos_22_24.jpg`. Retestar a retirada desobstruída e a continuidade23→24→25 no novo MP4. Nenhum código, voz ou arquivo de produção foi alterado.

## Notas e comparação com referências

**Visual:7,5/10. Editorial/execução causal:6,5/10. Geral desta versão:6,5/10.** Não atribuo nota de potencial de200mil views nem probabilidade de alcance.

Comparação independente com as folhas reais cadela/veado: pelo, separação preto/branco, olhos e boca têm leitura suficiente; floresta tem várias camadas, chão, sombras, pedras, água e colmos. A alternância de abertos, closes e janelas anatômicas acompanha a linguagem das referências. Esquemas têm fundo limpo e rótulos, mas são mais abstratos; eles não provam a biomecânica sozinhos. O vídeo repete bastante a pose sentada e a composição da alimentação. Isso e a retirada encoberta impedem uma nota editorial de aprovação. A comparação é de imagens; não assisti aos vídeos de referência com áudio.

## Medidas do arquivo real

| Medida | Resultado |
|---|---|
| Duração/quadros |85,366667s /2561quadros|
| Vídeo |1080×1920,30fps constante,H.264 High,yuv420p,8bit|
| Áudio |AAC mono,44.100Hz,~198,6kb/s|
| Tamanho |272.330.148bytes|
| Loudness integrado |−15,5LUFS: dentro da tolerância−14±2do verificador; não exatamente−14|
| Pico verdadeiro |−1,2dBTP: abaixo de−1|
| Cor |PrimáriasBT709, transferênciaiec61966-2-1(sRGB), espaço não informado: WARNdo verificador; não constatei imagem lavada|
| Legendas |Queimadas na imagem; sem faixa de legenda separada(WARNopcional)|

`check.py` retornou0FAIL e2WARN; isso não é aprovação editorial nem validação atual dos limites de plataforma. `probe.py.json`, `check.py.json`, `metrics.json` e todos os logs estão em `out/panda_qa_final/`.

Correlação do áudio AAC decodificado com `public/panda/mix.wav`, sem deslocamento aplicado: **0.99996058**; erro RMS relativo após ajustar ganho: **0.8880%**. Sustenta que o export preservou o pré-mix temporalmente; não comprova pronúncia, mix agradável ou sincronismo ouvido.

Loop: primeiro/último quadro extraídos do MP4, regiãox0–1079/y480–1919: diferença RGB média**1.712/255**, **0.978%**dos canais com diferença>10. Pose, colmo e câmera casam visualmente; não há igualdade pixel a pixel após compressão. Headline inicial não existe no último quadro e fica fora dessa região. Emenda sonora não ouvida.

## Cobertura e limites

Inspecionados início/meio/fim de39/39planos(117pontos) e os pares fim/início dos38cortes. Também inspecionadas pranchas sequenciais de1220quadros nominais em18planos críticos:01,06,09,10,13,14,15,18,19,24,27,30,31,32,33,34,38,39.

- Não assisti ao MP4 em reprodução contínua em velocidade normal e não ouvi o áudio como um ouvinte humano. Ritmo, naturalidade, mascaramento da voz, cliques e sincronismo perceptual permanecem pendentes.
- Início/meio/fim dos39planos foram inspecionados, com pares adjacentes fim/início nos38cortes; isso não é inspeção de todos os2561quadros.
- 18planos críticos receberam pranchas sequenciais de todos os quadros nominais dos intervalos, em270×480; o primeiro quadro foi extraído separadamente.16intervalos usam cópias QA cortadas com precisão de quadro, CRF24; planos30/31 foram extraídos diretamente do original quadro a quadro. Mapeamento temporal nominal pode ter tolerância de um quadro; não é laudo geométrico de todos os pixels a1080p.
- Legendas queimadas foram lidas nas117amostras e nas sequências críticas; não houve OCR/conferência humana de todas as palavras e fades. A transcrição conferida fornecida é evidência anterior, não escuta minha do MP4.
- Referências cadela/veado foram vistas como folhas de contato; comparação de materiais/enquadramentos é válida, mas não uma comparação de movimento ou áudio dos vídeos originais.
- Sem prévia dentro do aplicativo Instagram. A máscara reels é orientação da skill, não medição da UI atual nem garantia de segurança em todos os aparelhos.
- Métricas de áudio e correlação com pré-mix não substituem escuta. PubMed20814990 não retornou texto útil nesta consulta; fundamentos centrais também constam nas páginas oficiais dos zoológicos.

## Checklist por plano

SIM na coluna I/M/F significa que o ponto foi extraído e visto. “Ação inteira” compara a demonstração visual ao storyboard; SIM não aprova áudio/movimento. Todos os planos continuam com reprodução normal com áudio = NÃO verificada. Intervalos abaixo usam quadros reais a30fps; início/fim do JSON do storyboard têm valores decimais intermediários.

| Plano | I/M/F vistos | Quadros I/M/F | Tempos I/M/F(s) | Ação inteira | Observação/evidência |
|---|---|---|---|---|---|
|01-mordida-gancho|SIM/SIM/SIM|0/36/73|0.000/1.200/2.433|SIM|Panda, colmo, boca e floresta já presentes; headline legível; os quadros sequenciais mostram pequena mastigação e variação de câmera. `planos_01_03.jpg`, `crit_01_000.jpg`, `crit_01_048.jpg`|
|02-identidade-floresta|SIM/SIM/SIM|74/90/107|2.467/3.000/3.567|SIM|Revelação de corpo e floresta; identificação PANDA/Ailuropoda melanoleuca legível. `planos_01_03.jpg`|
|03-mesmo-bambu|SIM/SIM/SIM|108/141/176|3.600/4.700/5.867|SIM|Mesmo animal e colmo; contracampo preserva relação pata/boca. `planos_01_03.jpg`|
|04-boca-ao-intestino|SIM/SIM/SIM|177/195/214|5.900/6.500/7.133|NÃO|Close da boca, seguido pelo esquema; não identifiquei um fragmento sendo acompanhado até o intestino como previsto. `planos_04_06.jpg`|
|05-intestino-ancestral|SIM/SIM/SIM|215/240/266|7.167/8.000/8.867|SIM|Esquema digestivo inteiro e rotulado sem escala; nenhuma transformação em outro animal. `planos_04_06.jpg`|
|06-pata-pega-colmo|SIM/SIM/SIM|267/311/356|8.900/10.367/11.867|NÃO|Colmo já está entre as patas na posição baixa no início; a sequência comprova elevação, mas não retirada física da pilha. `planos_04_06.jpg`, `crit_06_000.jpg`, `crit_06_048.jpg`|
|07-pata-real|SIM/SIM/SIM|357/373/389|11.900/12.433/12.967|SIM|Patas/unhas e apoio lateral legíveis; contato com colmo mantido nas amostras. `planos_07_09.jpg`|
|08-parece-sexto-dedo|SIM/SIM/SIM|390/422/455|13.000/14.067/15.167|SIM|Contracampo do punho, sem sexto dedo humano independente visível. `planos_07_09.jpg`|
|09-osso-do-punho|SIM/SIM/SIM|456/480/505|15.200/16.000/16.833|SIM|Cinco raios digitais e saliência lateral destacada no esquema local; giro contínuo. `planos_07_09.jpg`, `crit_09_000.jpg`, `crit_09_048.jpg`|
|10-pegada-leva-a-boca|SIM/SIM/SIM|506/547/589|16.867/18.233/19.633|SIM|Colmo sobe com as patas até a boca; sequência contínua, sem salto grosseiro de posição identificado. `planos_10_12.jpg`, `crit_10_000.jpg`, `crit_10_048.jpg`|
|11-polegar-de-araque|SIM/SIM/SIM|590/599/609|19.667/19.967/20.300|SIM|Pega/mordida e label POLEGAR DE ARAQUE legíveis; plano curto. `planos_10_12.jpg`|
|12-bambu-preso|SIM/SIM/SIM|610/640/672|20.333/21.333/22.400|SIM|Colmo entre patas e região dos dentes; enquadramento permite ver contato. `planos_10_12.jpg`|
|13-casca-cai|SIM/SIM/SIM|673/691/710|22.433/23.033/23.667|SIM|Faixa interna clara aparece no colmo; tiras se desprendem e caem na sequência. `planos_13_15.jpg`, `crit_13_000.jpg`|
|14-esmaga-parte-clara|SIM/SIM/SIM|711/735/759|23.700/24.500/25.300|SIM|Parte clara e fibras visíveis; mastigação pequena. A prancha não demonstra fluidez em velocidade normal. `planos_13_15.jpg`, `crit_14_000.jpg`, `crit_14_048.jpg`|
|15-molares-e-musculos|SIM/SIM/SIM|760/797/835|25.333/26.567/27.833|SIM|Janela dos dentes/músculos inteira e sem escala; mandíbula abre/fecha na sequência. `planos_13_15.jpg`, `crit_15_000.jpg`, `crit_15_048.jpg`|
|16-triturador|SIM/SIM/SIM|836/897/959|27.867/29.900/31.967|SIM|Retorno à alimentação, fibras no chão e label TRITURADOR; sem cartaz final. `planos_16_18.jpg`|
|17-triturar-nao-basta|SIM/SIM/SIM|960/1009/1058|32.000/33.633/35.267|SIM|Alimentação/descartes visíveis; mudança de enquadramento para introduzir digestão. `planos_16_18.jpg`|
|18-nutrientes-e-fibra|SIM/SIM/SIM|1059/1100/1142|35.300/36.667/38.067|SIM|Dourado sai do tubo e fibra permanece em trânsito; rótulo das cores evita afirmar ausência total de digestão. `planos_16_18.jpg`, `crit_18_000.jpg`, `crit_18_048.jpg`|
|19-fibra-no-residuo|SIM/SIM/SIM|1143/1189/1235|38.100/39.633/41.167|SIM|Dejeto estilizado com fibras junto à pata, desobstruído; passagem do esquema ao chão é corte sem acompanhamento do mesmo fragmento. `planos_19_21.jpg`, `crit_19_000.jpg`, `crit_19_048.jpg`|
|20-trabalho-duplo|SIM/SIM/SIM|1236/1269/1302|41.200/42.300/43.400|SIM|Plano aberto mostra boca e dejeto simultaneamente; continuidade local com19. `planos_19_21.jpg`|
|21-come-muito|SIM/SIM/SIM|1303/1350/1397|43.433/45.000/46.567|SIM|Floresta, panda, pilha e descartes; dejeto antes frontal deixa de ser visível. Não atribuí erro geométrico só pela mudança de plano. `planos_19_21.jpg`|
|22-metade-do-dia|SIM/SIM/SIM|1398/1410/1423|46.600/47.000/47.433|SIM|10–16H com indicação VARIA, panda alimentando-se; duração de0,88s isolada, faixa permanece nos planos seguintes. `planos_22_24.jpg`|
|23-procura-na-pilha|SIM/SIM/SIM|1424/1479/1535|47.467/49.300/51.167|SIM|Panda quadrúpede se aproxima da pilha; chão e patas legíveis nas três amostras. Movimento normal não assistido. `planos_22_24.jpg`|
|24-pega-outro-colmo|SIM/SIM/SIM|1536/1558/1582|51.200/51.933/52.733|NÃO|BLOQUEADOR: tronco cobre mãos/base e a pilha na fase inicial; depois o colmo sobe. Não se vê contato da retirada nem uma unidade sair da pilha. `planos_22_24.jpg`, `crit_24_000.jpg`|
|25-almoco-expediente|SIM/SIM/SIM|1583/1597/1611|52.767/53.233/53.700|SIM|Retorno à mordida e EXPEDIENTE; descartes presentes. `planos_25_27.jpg`|
|26-repouso-no-tronco|SIM/SIM/SIM|1612/1672/1733|53.733/55.733/57.767|SIM|Repouso junto ao tronco estabelecido; sem colmo na boca; nenhuma mastigação identificada nas amostras. `planos_25_27.jpg`|
|27-repouso-dejeto-novo|SIM/SIM/SIM|1734/1762/1791|57.800/58.733/59.700|SIM|Dejetos passam de dois volumes para três por crescimento gradual; aparecem ao lado posterior, sem gore. A animação é estilizada, não queda anatômica realista. `planos_25_27.jpg`, `crit_27_000.jpg`, `crit_27_048.jpg`|
|28-boca-fecha-servico-segue|SIM/SIM/SIM|1792/1810/1830|59.733/60.333/61.000|SIM|Reação pequena do corpo, boca fechada e contexto de repouso preservado nas amostras. `planos_28_30.jpg`|
|29-cardapio-local|SIM/SIM/SIM|1831/1881/1931|61.033/62.700/64.367|SIM|Mancha/cenário verde e cardápio introduzidos; novo plano aberto. `planos_28_30.jpg`|
|30-especie-da-mancha|SIM/SIM/SIM|1932/1943/1955|64.400/64.767/65.167|NÃO|Close dos colmos/folhas locais; formação dos brotos não ficou demonstrada neste plano, flores entram no corte seguinte. `planos_28_30.jpg`, `crit_30_000.jpg`|
|31-florescer-na-regiao|SIM/SIM/SIM|1956/1972/1989|65.200/65.733/66.300|SIM|Flores claras legíveis; rótulo de outra escala de tempo/florescimento local. `planos_31_33.jpg`, `crit_31_000.jpg`|
|32-mancha-seca|SIM/SIM/SIM|1990/2044/2100|66.333/68.133/70.000|SIM|Colmos locais amarelam progressivamente, bambus verdes continuam ao fundo; não representa morte global. `planos_31_33.jpg`, `crit_32_000.jpg`, `crit_32_048.jpg`, `crit_32_096.jpg`|
|33-procura-outro-lugar|SIM/SIM/SIM|2101/2136/2171|70.033/71.200/72.367|SIM|Panda caminha pela trilha, gira e permanece enquadrado; apoio alternado das patas sugerido pela sequência. Não equivale a assistir à marcha. `planos_31_33.jpg`, `crit_33_000.jpg`, `crit_33_048.jpg`|
|34-chega-ao-verde|SIM/SIM/SIM|2172/2202/2234|72.400/73.400/74.467|NÃO|Chegada em área verde, novo colmo sobe, sem colmo ocultando o rosto; corte de caminhada para sentado. Mancha seca não é legível neste enquadramento. `planos_34_36.jpg`, `crit_34_000.jpg`, `crit_34_048.jpg`|
|35-recap-polegar|SIM/SIM/SIM|2235/2252/2271|74.500/75.067/75.700|SIM|Close retoma pega/pseudopolegar externo, sem novo dedo. `planos_34_36.jpg`|
|36-recap-mandibula|SIM/SIM/SIM|2272/2307/2342|75.733/76.900/78.067|SIM|Mordida e fibras reaparecem no recap; sem novo esquema. `planos_34_36.jpg`|
|37-recap-dia-comida|SIM/SIM/SIM|2343/2364/2386|78.100/78.800/79.533|SIM|Plano aberto retorna ao contexto de alimentação; recap usa novamente composição do cenário original. `planos_37_39.jpg`|
|38-reencontra-mordida|SIM/SIM/SIM|2387/2441/2496|79.567/81.367/83.200|SIM|Elevação contínua do colmo com as patas, aproximação para a abertura. `planos_37_39.jpg`, `crit_38_000.jpg`, `crit_38_048.jpg`, `crit_38_096.jpg`|
|39-loop-exato|SIM/SIM/SIM|2497/2528/2560|83.233/84.267/85.333|SIM|Pose/enquadramento retornam à abertura, sem cartela/CTA. Headline reaparece somente no primeiro quadro do reinício; emenda sonora não ouvida. `planos_37_39.jpg`, `crit_39_000.jpg`, `crit_39_048.jpg`|

## Verificações transversais

| Critério | SIM/NÃO | Evidência/limite |
|---|---|---|
| Gancho visual imediato, panda/bambu legíveis |SIM|Plano01; nome panda na identificação seguinte, conforme roteiro aprovado.|
| Pegada e elevação sem salto grosseiro nas sequências revistas |SIM|06/09/10; não prova retirada da pilha.|
| Retirada física da nova unidade da pilha |NÃO|Bloqueador24;06também já começa segurando.|
| Casca/parte clara/fibras mostradas |SIM|13/14; contato fino ainda limitado por pranchas270×480.|
| Molares/músculos em esquema rotulado |SIM|15; abre/fecha, sem afirmação de anatomia clinicamente exata.|
| Digestão distingue nutrientes de fibra |SIM|18; sem percentagem inventada.|
| Resíduo e novo dejeto em repouso visíveis |SIM|19/27; estilizados.|
| Floração/secagem local e verde alternativo |SIM|30–34; outro tempo explicitado. Não vejo morte global, mas a mancha seca não está legível na chegada34.|
| Caminhada enquadrada |SIM|33quadro a quadro em prancha; marcha em tempo normal pendente.|
| Fonte/legendas amostradas legíveis |SIM|117amostras e sequências; não verificação integral de todas as palavras.|
| Todas as legendas sem erro e sincronismo ouvido |NÃO|Não verificado integralmente; ASR/transcrição anterior não equivale à minha escuta.|
| Áudio em níveis aceitáveis |SIM|−15,5LUFS/−1,2dBTP medidos no MP4.|
| Áudio/fluidez assistidos em velocidade normal |NÃO|Limite perceptual declarado.|
| Loop sem cartela e pose correspondente |SIM|39→01; headline reaparece. Áudio do loop pendente.|
| Área superior do gancho bloqueada no Reels |NÃO|`safe_reels_0.png`: texto abaixo da faixa superior8%. Poucos pixels da última letra encostam na zona lateral; prévia realIGpendente.|
| Checklist integral100% / aprovação de entrega |NÃO|Bloqueador24e verificações perceptuais pendentes.|

## Fontes reconsultadas

- [Smithsonian](https://nationalzoo.si.edu/animals/giant-panda): sustenta punho/pseudopolegar, mandíbula, digestão ineficiente,10–16h e defecação em repouso.
- [San Diego Zoo](https://animals.sandiegozoo.org/animals/giant-panda): sustenta descascamento, dentes posteriores e floração/morte conjunta local com mudança de área.
- [Natural History Museum](https://nhm.org/press/eating-bamboo-its-all-wrist): sustenta sesamoide radial e sua função.
- [PubMed20814990](https://pubmed.ncbi.nlm.nih.gov/20814990/): texto não recuperado nesta revisão; não alego revalidação do artigo.

## Próximo portão

Volta ao diretor para corrigir o plano24. Novo render exige novo QA do MP4 resultante, incluindo cortes23→24→25. Não considerar esta revisão autorização de publicação. Escuta e reprodução normal continuam pendentes.
