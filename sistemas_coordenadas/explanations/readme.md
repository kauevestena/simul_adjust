# Material de aula · Lecture Materials

Esta pasta reúne apresentações didáticas em Beamer sobre sistemas geodésicos de referência e o Sistema Geodésico Brasileiro.

---

## 1. `sgr_terrestres.pdf` — Sistemas e Referenciais Terrestres

54 slides em português, no mesmo formato didático das outras aulas do repositório: ensino médio, passo a passo, com apêndice técnico.

O `descricao.md` desta pasta registra que **"sistemas de coordenadas ≠ Sistemas Geodésicos de Referência"**. O simulador mostra *como* converter entre $(\varphi, \lambda, h)$, ECEF, ENU e plano local; esta aula é sobre *sobre o quê* essas coordenadas se apoiam — exatamente o que o simulador deixa de fora de propósito.

**Esta é a Parte 1 geral: os referenciais terrestres.** Os celestes ficam para a Parte 2.

### O percurso
- **O choque:** o mesmo poste plotado na carta de 1995 e no mapa moderno cai a $\sim 65$\,m de distância — sem erro de medição.
- **Sistema vs. Frame:** a definição pela velocidade da luz (sistema) vs. a trena física (frame).
- **As 4 técnicas espaciais:** VLBI, SLR, GNSS, DORIS.
- **Transformações:** Helmert de 7 e 14 parâmetros.
- **Referenciais na placa:** ETRS89, NAD83, GDA2020 e a velocidade da placa sul-americana ($1{,}2$\,cm/ano para NW).

```bash
cd sistemas_coordenadas/explanations
latexmk -pdf sgr_terrestres.tex
latexmk -c
```

---

## 2. `sgb_sirgas2000.pdf` & `sgb_sirgas2000_en.pdf` — O Sistema Geodésico Brasileiro: Parte 1 — SIRGAS 2000

Deck bilíngue completo com **99 páginas**, quatro aulas modulares de 50 minutos e 8 apêndices técnicos, construído com foco pedagógico passo a passo (*baby steps*), rigor conceitual e exatidão documental com fontes primárias do IBGE, SIRGAS e legislação federal.

A **Parte 2** futura abordará a **rede altimétrica**, o nivelamento geométrico, as anomalias de altura e o quase-geoide/geoide brasileiro.

### Estrutura das Aulas · Course Structure

| Aula / Class | Páginas / Pages | Tema (PT-BR) | Topic (EN) |
|---|---|---|---|
| **Aula 1** | 4–30 | **A Herança: Os Data Clássicos** (Córrego Alegre, SAD69, Chuá, astrogeodésia, distorção de até $13$\,m) | **The Heritage: Classical Datums** (Córrego Alegre, SAD69, Chuá, astrogeodesy, up to $13$\,m regional distortion) |
| **Aula 2** | 31–55 | **A Idealização: 1993–1995 & SIRGAS95** (Assunção 1993, ITRS, GRS80 vs WGS 84, campanha de 1995 com 58 estações) | **The Design: 1993–1995 & SIRGAS95** (Asunción 1993, ITRS, GRS80 vs WGS 84, 1995 campaign with 58 stations) |
| **Aula 3** | 56–74 | **A Realização: Maio de 2000 e o Cálculo** (184 estações, DGFI, IBGE, NIMA, época congelada $2000{,}4$, esqueleto de 21 estações) | **The Realization: May 2000 and the Computation** (184 stations, DGFI, IBGE, NIMA, frozen epoch $2000.4$, 21 Brazilian backbone stations) |
| **Aula 4** | 75–91 | **Adoção, Densificação e Vida Útil** (PMRG, RBMC ativa, reajustamento de 2006 com 6.265 marcos, Dec. 5.334/2005, R.PR 1/2005, ProGriD/NTv2, VEMOS) | **Adoption, Densification and Lifetime** (PMRG, active RBMC, 2006 re-adjustment of 6,265 monuments, Dec. 5,334/2005, R.PR 1/2005, ProGriD/NTv2, VEMOS) |
| **Apêndice** | 92–99 | **A1–A8: Fórmulas, Modelos e Fontes Primárias** (Helmert 3/7 parâmetros, GRS80 vs WGS84, cronologia, glossário, siglas, fontes [A]–[F]) | **A1–A8: Formulas, Models and Primary Sources** (Helmert 3/7 parameters, GRS80 vs WGS84, timeline, glossary, acronyms, sources [A]–[F]) |

### Destaques Didáticos e Técnicos

1. **Pedagogia Ativa e "Baby Steps":**
   - Uma ideia central por slide.
   - Quadros interativos **Pare e pense** e **Sua vez** (com pergunta no primeiro clique e resposta detalhada no clique seguinte).
   - "Onde paramos", "As perguntas de hoje" e "Para levar para casa" delimitando o início e fim de cada uma das quatro aulas.

2. **Código de Cores Canônico:**
   - <span style="color:#4F46E5">**Sistema / Idealizado**</span> (Índigo): elipsoides GRS80/UGGI67, convenções ITRS, leis e definições matemáticas.
   - <span style="color:#0D9488">**Frame / Medido**</span> (Teal): marcos físicos de concreto, pilares de triangulação, receptores GNSS, estações RBMC.
   - <span style="color:#D97706">**Tempo / Dinâmica**</span> (Âmbar): época de referência ($2000{,}4$), velocidades de placas tectônicas (VEMOS).
   - <span style="color:#E11D48">**Diferença / Erro**</span> (Rosa): vetor de translação SAD69 $\to$ SIRGAS2000, distorções de rede clássica, resíduos.
   - <span style="color:#0284C7">**Geoide / Mar**</span> (Sky): marégrafos de Imbituba e Santana, desvio da vertical em Chuá.

3. **Conferência Rigorosa com Fontes Primárias:**
   - **[A]** IBGE (2000), *SIRGAS Final Report, Working Groups I and II*.
   - **[B]** IBGE (2006), *Ajustamento da Rede Planimétrica Brasileira em SIRGAS2000* (6.265 estações, 22.232 equações, 8 blocos de Helmert, fator a posteriori $\hat{\sigma}_0^2 = 1{,}509$).
   - **[C]** IBGE (1996/2002), *Ajustamento da Rede Planimétrica do SGB* (histórico de Córrego Alegre, Chuá e distorção de até $13$\,m).
   - **[D]** SIRGAS, `sirgas.ipgh.org` (IAG / IPGH).
   - **[E]** Presidência da República, *Decreto nº 5.334, de 06/01/2005* (alterou o art. 21 do Decreto 89.817/1984).
   - **[F]** IBGE, *Resolução do Presidente nº 1/2005, de 25/02/2005* (transição decenal de 2005 a 2015).
   - **Script recalculador:** `sgb_sirgas2000_numeros.py` recalcula com precisão arbitrária os semi-eixos, desvios por cidade (Porto Alegre, Curitiba, Brasília, Fortaleza, Manaus), norma do vetor de translação ($77{,}5$\,m) e proporções em ppm.

### Instruções de Compilação · Build Instructions

```bash
cd sistemas_coordenadas/explanations

# Versão em Português (sgb_sirgas2000.pdf)
latexmk -pdf sgb_sirgas2000.tex

# English Version (sgb_sirgas2000_en.pdf)
latexmk -pdf sgb_sirgas2000_en.tex

# Limpeza de arquivos intermediários
latexmk -c sgb_sirgas2000.tex sgb_sirgas2000_en.tex

# Recalcular todos os números da aula
python3 sgb_sirgas2000_numeros.py
```
