# Direção baleia — estado visual

24 planos, fronteiras por palavras da locução real. Inventário exato: PLANOS.json, gerado dos defaultProps da composição, com início/meio/fim. Composição71,4s/2142quadros. Câmera usa LagCam, palco PalcoNoite, tipografia/legenda do kit lagartixa.

## Rodadas reais e correções
R1: out/baleia_r1_0.png. Reprovada: filhote distante, olhos enterrados, peitorais no plano errado, dorsal excessiva, corpo liso e cauda cortada. Comparação com NOAA docs/baleia/referencias/noaa-mae-filhote.jpg revelou necessidade de peitorais longas, tubérculos e sulcos.
R2: out/baleia_r2_0.png. Olhos na superfície, yaw/pitch/roll da mamada e contato derivado do ponto da boca. Fins com espessura e simetria corrigidas. Ainda faltavam acabamento e morfologia.
R3: out/baleia_r3_0.png/12/31/48/63. Pele e abertura de fendas, mas sulcos retos se projetavam além do focinho, contas de tubérculos soltas e cauda em dois ovais. Reprovada pelo produtor/revisor.
R4: out/baleia_r4_0.png/12/34/48/63. Textura aparece e câmera oblíqua revela ventre. Ainda sulcos/contas/cauda inadequados. Não aprovação simbólica.
R5: out/baleia_r5_0.png/12/16/36/49. Fluke extrudada com entalhe, peitorais sem contas, sulcos curvos seguindo raio local, textura, oceano deformado e caústicas. Correção respiração pendente.
R6: out/baleia_r6_0.png/12/16/36/49/57. Fendas mamárias amarelas e genital azul; flashback ampliado para3,18s e custo materno dividido em dois ângulos. Filhote respirando coordenadas mundo, espiráculos realmente acima interface. Duas fendas precisavam separar na projeção e spray menor.
R7: out/baleia_r7_36.png. Camera quase zenital, dois espiráculos separados e spray fino deslocado da área dos orifícios.

## Anatomia/continuidade
A assertiva de contato verifica canto da boca transformado por Euler/escala contra a fenda mamária. Distância zero numericamente. Isto não substitui avaliação visual: contato close no16s deve ser verificado no MP4 final.
Sulcos são geometria curva superficial, não cordas retas ou barbatanas saindo da boca. Filhote e mãe usam mesma anatomia jubarte, incluindo peitorais longas e cauda horizontal com entalhe.
Respiração sem abrir a boca, olhos/espiráculos na superfície da geometria. Expiração restrita à superfície. Passagem de tempo e reservas são destaques didáticos, não transformação em um único gole.

## Limites
Stills não equivalem a assistir ao MP4 nem a ouvir em velocidade normal. Revisão final independente deve examinar todas as24ações e transições, movimento crítico da mamada/subida e composição final, incluindo loop e áudio.

R8: out/baleia_r8_37.5.png. Interface água/ar com céu real acima do plano, focinho e espiráculos atravessam a superfície. Para leitura, plano12b ampliado para1,81s (HOLES+DIVE)/2-.3 até DIVE, mantendo12a1,21s zenital de dois espiráculos. Plano22repete lateral. PLANOS.json atualizado com25planos na rodadaR9. Capa final: out/baleia_capa.png em1080×1920.
R9: out/baleia_r9_24.png/36.8/52/67.5. Confere leite/camada usando a mesma pose de contato, interface, custo materno e emenda ao gancho. TypeScript sem erros no estado final. Não equivale a aprovação final independente do MP4.
R10: interface com câmera literalmente horizontal pos[.2,2.045,3] look[.2,2.045,.4], para horizonte cortar imediatamente abaixo dos espiráculos2.088. Legenda esquemática da camada movida para y540 no trecho com porcentagem, evitando colisão com GORDURA DO LEITE. R10_24.png e R10_37.5.png são evidências posteriores. Total final25planos. Não afirmar aprovação com base apenas nesses quadros.
