# BI Sondagem de Língua Portuguesa - 1º BI 2026

Este projeto contém uma página BI para acompanhar resultados da sondagem inicial e do 1º bimestre em Língua Portuguesa, com recortes de Escrita e Leitura por DRE, escola, turma e estudante/resposta.

## Arquivos principais

- `index.html`: estrutura da página BI.
- `styles.css`: estilos, responsividade e organização visual dos painéis.
- `dashboard.js`: carregamento do JSON, transformação dos dados, cálculos dos indicadores e renderização dos gráficos/tabelas.
- `gera_json.py`: script de geração da base compacta a partir da extração original.
- `data/lp_avaliacoes_escrita.json`: base consolidada multiavaliação usada pelo painel, incluindo Escrita e Leitura.
- `data/lp_sistema_de_escrita.json`: base legada do recorte Sistema de escrita/1º ano.
- `vendor/`: bibliotecas locais usadas para exportar tabelas e copiar gráficos como imagem.
- `tsvs/dre-bt_lp_escrita_1_ano.tsv`: base TSV original de referência do MVP inicial.

## Como executar

A página usa `fetch` para carregar o JSON, então deve ser aberta por um servidor local, não diretamente como arquivo.

Na raiz deste repositório:

```powershell
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000/
```

## Como o MVP foi feito

O arquivo `data/lp_avaliacoes_escrita.json` está em formato longo compactado: cada linha representa uma resposta de estudante em um bimestre. Para reduzir tamanho, o JSON usa um cabeçalho `schema` e uma lista `rows`, em vez de repetir nomes longos de campos em cada registro.

Esquema atual:

| Chave | Campo |
| --- | --- |
| `av` | Tipo de avaliação |
| `q` | Questão avaliada |
| `d` | Nome DRE |
| `ec` | Código EOL Escola |
| `e` | Nome Escola |
| `t` | Nome Turma |
| `id` | Código EOL Estudante |
| `n` | Inicial do nome do estudante |
| `r` | Resposta |
| `a` | Ano |
| `b` | Bimestre |

Tipos de avaliação:

| Código | Proficiência | Questões | Ano |
| --- | --- | --- | --- |
| `se1` | Escrita | Sistema de escrita | 1 |
| `esc2` | Escrita | Escrita | 2 |
| `pt3` | Escrita | Produção de Texto | 3 |
| `lei1` | Leitura | Localização | 1 |
| `lei2` | Leitura | Localização; Inferência | 2 |
| `lei3` | Leitura | Localização; Inferência; Apreciação e Réplica | 3 |

Para comparar a evolução, o painel agrupa os registros por estudante e questão, montando um par de valores:

- `Inicial`
- `1° bimestre`

Nos recortes de Escrita, somente estudantes com hipótese/categoria válida nos dois momentos entram nos cálculos de evolução. Respostas vazias, `Sem preenchimento` ou valores fora da escala são tratadas como `Sem dado` e ficam fora da evolução individual, mas permanecem nas visões consolidadas. O painel diferencia ausência na Inicial, ausência no 1º bimestre e ausência de par completo.

Nos recortes de Leitura, as categorias válidas são `Adequada`, `Inadequada`, `Não respondeu` e `Sem preenchimento`. Respostas vazias da extração são exibidas como `Sem preenchimento`, seguindo a legenda visual de referência.

O arquivo consolidado contém registros de múltiplas DREs e dos recortes de avaliação. A interface aplica os filtros de DRE, Escola e Tipo de avaliação diretamente na página. Ao selecionar o tipo de avaliação, o painel atualiza automaticamente o Ano avaliado:

- Sistema de escrita: 1º ano.
- Escrita: 2º ano.
- Produção de Texto: 3º ano.
- Leitura - 1º ano: 1º ano, questão Localização.
- Leitura - 2º ano: 2º ano, questões Localização e Inferência.
- Leitura - 3º ano: 3º ano, questões Localização, Inferência e Apreciação e Réplica.

Quando a avaliação selecionada possui mais de uma questão, o filtro `Questão` aparece abaixo de `Tipo de avaliação` e exige a seleção de uma questão específica. Isso evita duplicidade visual no acompanhamento de turmas, já que o mesmo estudante pode ter uma resposta para cada questão de Leitura.

O ranking e o gráfico de comparação entre escolas respeitam o recorte de DRE/tipo/ano, mas continuam mostrando todas as escolas desse recorte mesmo quando uma escola específica está selecionada, destacando a escola filtrada.

Para reduzir exposição de dados pessoais, o JSON público não armazena o nome completo nem o primeiro nome do estudante. O script `gera_json.py` grava apenas a inicial do nome no campo `n`; a interface combina essa inicial ao código EOL do estudante no formato `InicialCódigoEOL`, por exemplo `A7940534`.

Também foi aplicada normalização simples em respostas com pequenas variações:

- `SSCV` é tratado como `SSVC`.
- `SCVC_` é tratado como `SCVC`.

## Escala de hipóteses

As hipóteses de escrita foram convertidas para uma escala numérica para permitir cálculo de ganho:

| Hipótese | Código |
| --- | ---: |
| PS | 1 |
| SSVC | 2 |
| SCVC | 3 |
| SA | 4 |
| A | 5 |

Exemplos:

- `PS -> SCVC` gera ganho `+2`.
- `SCVC -> A` gera ganho `+2`.
- `A -> SA` gera ganho `-1`.

## Escala de Leitura

As respostas de Leitura usam a escala abaixo para cálculo de evolução e para manter a ordem visual dos gráficos:

| Resultado | Código |
| --- | ---: |
| Sem preenchimento | 1 |
| Não respondeu | 2 |
| Inadequada | 3 |
| Adequada | 4 |

A paleta de Leitura segue a referência visual: verde para `Adequada`, amarelo para `Inadequada`, vermelho para `Não respondeu` e branco para `Sem preenchimento`.

## Classificação da evolução

Cada estudante com par válido recebe uma situação:

| Ganho | Situação |
| ---: | --- |
| `>= 2` | Alta evolução |
| `1` | Evolução média |
| `0` | Estável |
| `< 0` | Baixa |

## Indicadores calculados

O painel calcula, para a DRE ou para a escola filtrada:

- Total de alunos com par válido.
- Total de alunos sem par válido, que ficam fora dos cálculos de evolução.
- Percentual e quantidade de estudantes que melhoraram.
- Percentual e quantidade de estudantes que mantiveram o nível.
- Percentual e quantidade de estudantes que baixaram.
- Índice de Evolução, calculado como a média dos ganhos de níveis.
- Percentual e quantidade absoluta de estudantes alfabéticos no 1º bimestre.
- Diferença percentual e absoluta de estudantes alfabéticos entre a sondagem inicial e o 1º bimestre.

## Blocos da página

### Indicadores gerais

Uma faixa acima dos cards mostra explicitamente o recorte aplicado no momento: DRE, escola, ano e quantidade total de alunos no recorte.

Cards no topo consolidam a situação geral da DRE, ano ou escola selecionada.

### Visão consolidada

A chave `Consolidado` mantém todos os alunos do recorte, inclusive estudantes sem dado válido em um dos períodos. Essa visão é indicada para ler a escola, a DRE ou a rede no tipo de avaliação selecionado, sem restringir a análise apenas aos alunos com par válido.

A barra de filtros exibe o Ano avaliado como informação de escopo, sem seletor. O ano muda automaticamente com o tipo de avaliação selecionado.

A visão consolidada inclui:

- KPIs de total de alunos, par válido, alfabéticos por período e sem registro por período.
- Gráfico de rosca com distribuição geral por categoria e `Sem dado`.
- Gráfico de participação entre preenchidos e sem dado.
- Mapa de calor com distribuição por período.
- Comparação por DRE, quando o recorte está em todas as DREs e todas as escolas.
- Ranking de escolas por distribuição de hipóteses.

### Movimentação geral

Visual em SVG inspirado em Sankey. Mostra os fluxos entre as hipóteses da avaliação inicial e do 1º bimestre. A ordem visual fica de cima para baixo como:

```text
A
SA
SCVC
SSVC
PS
```

Assim, `PS` fica na base e `A` no topo.

Cada bloco de hipótese exibe a sigla, o número absoluto de estudantes e a porcentagem correspondente dentro do próprio bloco, evitando sobreposição com as linhas de movimentação.

### Mapa de calor

Duas tabelas lado a lado mostram a distribuição por hipótese na avaliação inicial e no 1º bimestre. Cada linha usa a cor da hipótese e exibe número absoluto e porcentagem no período.

### Ranking de escolas

Quando o filtro DRE está em `Todas as DREs` e o filtro Escola está em `Todas as escolas`, o painel exibe antes do ranking de escolas um ranking consolidado das DREs, com as mesmas métricas de alunos, alfabéticos, evolução e Índice de Evolução. O card tem controles próprios de ordenação por coluna e direção (`ASC`/`DESC`). Ao clicar em uma DRE nessa tabela, o painel aplica o filtro correspondente.

Tabela por escola com:

- alunos com par válido;
- percentual que melhorou;
- percentual que manteve;
- percentual que baixou;
- Índice de Evolução.
- percentual e quantidade de alfabéticos no 1º bimestre;
- diferença percentual e absoluta de alfabéticos entre a inicial e o 1º bimestre.

Ao clicar em uma escola no ranking, o painel filtra os demais blocos para aquela escola.

O card permite escolher a coluna usada para classificação e a direção da ordenação: `ASC` ou `DESC`.

### Comparação entre escolas

Dispersão em SVG:

- eixo X: percentual de estudantes em uma hipótese escolhida na avaliação inicial;
- eixo Y: percentual de estudantes em uma hipótese escolhida no 1º bimestre;
- cada ponto representa uma escola.

O card permite escolher as hipóteses dos dois eixos, por exemplo `PS` na inicial contra `A` no 1º bimestre, ou `SSVC` na inicial contra `SCVC` no 1º bimestre.

### Análise da escola

Compara a distribuição dos níveis na avaliação inicial e no 1º bimestre.

### Velocidade da evolução

Mostra a proporção de estudantes em cada classificação: alta evolução, evolução média, estável e baixa.

### Alunos que pedem atenção

Antes da lista de alunos, o painel exibe uma tabela de turmas do recorte atual. Cada linha mostra escola, turma, total de alunos, quantidade e percentual com par válido, sem dado na Inicial, sem dado no 1º bimestre, sem par válido, alfabéticos no 1º bimestre, evolução e Índice de Evolução. O botão de ícone abre diretamente a visualização da sala daquela turma em uma guia na própria página.

Tabela com estudantes filtráveis por DRE, ano, escola e busca textual. A lista prioriza estudantes com baixa, estabilidade ou alta evolução, usando o ganho entre a hipótese inicial e a do 1º bimestre.

Para proteção de dados, estudantes são exibidos na interface como `InicialCódigoEOL`, sem espaço e sem parênteses. Essa proteção também é aplicada no JSON gerado para a página, que armazena apenas a inicial no campo de nome.

Por desempenho e legibilidade, a tabela de acompanhamento exibe até 220 estudantes priorizados pela ordenação atual. Quando houver mais estudantes no recorte, o card mostra uma nota com a quantidade exibida e o total priorizado.

O card permite ordenar a lista por ganho, aluno, escola, turma, hipótese inicial, hipótese no 1º bimestre ou situação, em direção `ASC` ou `DESC`.

A coluna `Turma` é clicável. Ao clicar, abre uma guia na área `Salas abertas`, com uma visualização da sala de aula: estudantes aparecem como silhuetas agrupadas por hipótese de escrita, usando as cores da escala. É possível abrir mais de uma turma, alternar entre turmas abertas, fechar uma turma específica ou fechar todas. Cada guia permite alternar entre `Inicial` e `1º bimestre`, mostra todos os alunos da turma no recorte atual e separa estudantes sem dado válido em um grupo cinza `Sem dado`.

## Filtros disponíveis

- DRE.
- Escola, atualizada conforme DRE e tipo de avaliação.
- Tipo de avaliação: Sistema de escrita, Escrita, Produção de Texto, Leitura - 1º ano, Leitura - 2º ano ou Leitura - 3º ano.
- Questão, exibida apenas quando o tipo de avaliação tem mais de uma questão, sem opção agregada em Leitura.
- Ano avaliado, exibido como informação fixa de escopo derivada do tipo de avaliação.
- Busca por aluno ou escola na tabela de acompanhamento.

## Exportações

Os botões de download das tabelas continuam exportando a tabela visível em `.xlsx`, removendo colunas de ação quando necessário.

Na visão `Consolidado`, o card final dos indicadores gerais traz o botão `Baixar consolidado XLSX`, que gera uma pasta de trabalho com múltiplas abas:

- `Resumo`: filtros aplicados, questão selecionada, totais, preenchimento e categoria-alvo.
- `Distribuicao`: hipóteses por período, incluindo `Sem dado`.
- `Escolas Final` e `Escolas Inicial`: distribuição por escola.
- `Turmas`: total, par válido, ausências por período, sem par e evolução.
- `Alunos`: lista de estudantes/respostas do recorte.
- `Sem dado`: estudantes/respostas sem par válido.

## Validação realizada

Foram feitas as seguintes verificações:

- Carregamento da página em `http://localhost:8000/`.
- Leitura do JSON consolidado via `fetch`.
- Renderização dos 8 KPIs.
- Renderização do fluxo, heatmap, ranking, distribuição, velocidade e tabela de alunos.
- Clique em escola no ranking filtrando os indicadores.
- Filtros de DRE, Escola e Tipo de avaliação atualizando indicadores, gráficos e tabelas, com Ano avaliado derivado do tipo selecionado.
- Filtro de questão em Leitura - 2º ano e Leitura - 3º ano, exigindo uma questão específica para evitar duplicidade no acompanhamento de turmas.
- Renderização das categorias de Leitura com as cores de referência.
- Visão Consolidado com gráfico de rosca, participação e tabela dinâmica por categorias do tipo selecionado.
- Colunas de sem dado na Inicial, sem dado no 1º bimestre e sem par na tabela de turmas.
- Geração do workbook consolidado em `.xlsx` validada até o ponto permitido pelo navegador interno; downloads não são suportados no Browser da Codex, mas não houve erros de aplicação.
- Ausência de erros de console no navegador.
- Checagem responsiva em largura mobile sem rolagem horizontal indevida.

## Observações de manutenção

- As escalas pedagógicas ficam definidas em `SYSTEM_LEVELS`, `RUBRIC_LEVELS`, `READING_LEVELS` e `LEVEL_COLORS`, no início de `dashboard.js`.
- A ordem visual do Sankey vem de `getVisualLevels()`, derivada da escala do tipo de avaliação selecionado.
- A fonte carregada pela aplicação fica definida em `DATA_PATH`, no início de `dashboard.js`.
- O esquema compacto do JSON fica definido em `COMPACT_SCHEMA`, no início de `dashboard.js`, e deve acompanhar qualquer mudança feita em `gera_json.py`.
- As bibliotecas de exportação e captura ficam versionadas localmente em `vendor/`, evitando dependência de CDN durante o uso do painel.
- Se novos bimestres forem adicionados, será necessário ajustar a regra que identifica `Inicial` e `1° bimestre` em `buildStudentRecords`.
- Se novas hipóteses de escrita ou categorias de leitura forem incorporadas, será necessário atualizar a escala, as cores correspondentes e os filtros em `gera_json.py`.
