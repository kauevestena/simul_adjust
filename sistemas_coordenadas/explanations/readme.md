# Material de aula · Lecture Materials

Esta pasta reúne apresentações didáticas em Beamer sobre sistemas geodésicos de referência e o Sistema Geodésico Brasileiro.

---

## 1. `sgr_terrestres.pdf` — Sistemas e Referenciais Terrestres

54 slides em português, no mesmo formato didático das outras aulas do repositório: ensino médio, passo a passo, com apêndice técnico.

O `descricao.md` desta pasta registra que **"sistemas de coordenadas ≠ Sistemas Geodésicos de Referência"**. O simulador mostra *como* converter entre $(\varphi, \lambda, h)$, ECEF, ENU e plano local; esta aula é sobre *sobre o quê* essas coordenadas se apoiam — exatamente o que o simulador deixa de fora de propósito.

**Esta é a Parte 1 geral: os referenciais terrestres.** Os celestes estão na **Parte 2** (`sgr_celestes.pdf`, seção 3 abaixo).

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

A **Parte 2** — a **rede altimétrica**: o zero (o mar e o marégrafo), o nivelamento geométrico, os ajustamentos e o REALT-2018 — está na **seção 4** abaixo (`sgb_altimetria.pdf`). · **Part 2** — the **vertical network**: the zero (the sea and the tide gauge), geometric leveling, the adjustments and REALT-2018 — is in **section 4** below (`sgb_altimetria_en.pdf`).

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

---

## 3. `sgr_celestes.pdf` & `sgr_celestes_en.pdf` — Sistemas Geodésicos de Referência: Parte 2 — os referenciais celestes e a ponte até o chão · Geodetic Reference Systems: Part 2 — the celestial frames and the bridge to the ground

### Português

**A Terra gira em relação a quê?** É a Parte 2 prometida no último slide de `sgr_terrestres.pdf`: os referenciais **celestes** (ICRS e ICRF), os que *não* giram com a Terra, e a **ponte** que liga o céu ao chão (rotação, precessão, nutação, movimento polar, EOP e tempo). Deck bilíngue (um único `.tex` gera as duas versões) com **148 páginas**, **quatro aulas de 50 minutos**, uma ideia por slide, linguagem de ensino médio e apêndice técnico, no mesmo formato das outras aulas da pasta.

| Aula | Páginas | Tema |
|---|---|---|
| **Abertura** | 1–4 | Sumário, onde a Parte 1 parou e o plano das quatro aulas |
| **Aula 1** | 5–36 | **Um céu que não gira**: referencial inercial × girante (carrossel, pêndulo de Foucault), esfera celeste, ascensão reta e declinação, J2000.0, precessão, nutação e movimento próprio |
| **Aula 2** | 37–68 | **Os faróis do Universo**: quasares, VLBI ($\tau = B\cos\theta/c$, $10$ ps $\to$ $60\,\mu$as), ICRS × ICRF (ICRF1/2/3, 303 fontes definidoras), Hipparcos, Gaia-CRF3 e a aceleração da Galáxia ($5{,}8\,\mu$as/ano) |
| **Aula 3** | 69–105 | **A ponte entre o céu e o chão**: girar eixos, cadeia $Q\,R\,W$, ERA (dia solar × sideral), UT1, CIP, $dX$/$dY$, movimento polar (Chandler + anual), os cinco EOP, quem mede (VLBI, GNSS, SLR, DORIS) e quem publica (IERS) |
| **Aula 4** | 106–136 | **O tempo e a prática**: UT1, UTC, TAI, TT, tempos do GNSS, 27 segundos intercalares e o fim deles (28ª CGPM, 15/10/2026), relatividade nos relógios do GPS, órbita $\to$ TEME $\to$ ECEF, orçamento de erros e o Brasil (ON, Fortaleza, RBMC) |
| **Apêndice** | 137–148 | **A1–A9 e fontes**: marcos normativos, a cadeia $Q\,R\,W$ em fórmulas, ERA/GMST, precessão de uma estrela (Sirius), contas de relatividade, os 27 intercalares, glossário PT/EN |

#### Destaques

- **Pedagogia passo a passo:** *Onde paramos*, *As perguntas de hoje* e *Para levar para casa* delimitam cada aula; os quadros **Sua vez** e **Pare e pense** mostram a resposta só no clique seguinte (é a mesma página repetida no PDF).
- **Sistema × frame, outra vez:** o ICRS é a regra escrita (origem no baricentro, eixos presos a objetos extragalácticos, sem rotação); o ICRF é a lista de quasares medida por VLBI. A ponte para o chão é o assunto das aulas 3 e 4.
- **Os simuladores da pasta entram na aula:** `astrometria/` (o que ele deixa de fora: precessão, nutação, UT1) e `GNSS_simul/` (órbitas, TEME $\to$ ECEF só com o ângulo sideral, sem $W$ e com UT1 $=$ UTC).
- **Código de cores** (o mesmo das outras aulas): <span style="color:#4F46E5">**sistema / regra**</span> (índigo), <span style="color:#0D9488">**frame / medido**</span> (teal), <span style="color:#D97706">**tempo**</span> (âmbar), <span style="color:#E11D48">**diferença / erro**</span> (rosa) e <span style="color:#0284C7">**o céu**</span> (azul).
- **Números recalculados por script:** `sgr_celestes_numeros.py` (Python puro, sem dependências) imprime, aula por aula, todos os valores citados (precessão de Sirius, ERA e dia sideral, 1 ms de UT1 $=$ 0,47 m, relatividade do GPS, órbitas repetidas, orçamento de erros) e, com `--figuras`, as coordenadas das figuras (traço do satélite, esfera celeste, mapa de Hammer).
- **Datas e fontes conferidas em 18/10/2026**, com a lista nos slides *Fontes e leituras*. **Duas ressalvas, também ditas no deck:** (1) a Resolução 5 da 28ª CGPM (UTC contínuo desde 20/5/2027, limite de 1 h para $|\text{UT1}-\text{UTC}|$) foi conferida na declaração do presidente do CCTF e na imprensa técnica, **não** no texto oficial do BIPM; (2) alguns dados do Brasil (Hora Legal do ON, antena VGOS de Fortaleza, 153 estações da RBMC) vieram de resumos de busca, porque os sites oficiais ficaram inacessíveis.

### English

**What does the Earth spin relative to?** This is the Part 2 announced on the last slide of `sgr_terrestres.pdf`: the **celestial** reference systems (ICRS and ICRF), the ones that do *not* turn with the Earth, and the **bridge** linking the sky to the ground (rotation, precession, nutation, polar motion, EOP and time). A bilingual deck (a single `.tex` builds both versions) with **148 pages**, **four 50-minute classes**, one idea per slide, high-school-level language and a technical appendix, in the same format as the other classes in this folder.

| Class | Pages | Topic |
|---|---|---|
| **Opening** | 1–4 | Contents, where Part 1 stopped and the plan of the four classes |
| **Class 1** | 5–36 | **A sky that does not spin**: inertial vs. rotating frames (carousel, Foucault pendulum), celestial sphere, right ascension and declination, J2000.0, precession, nutation and proper motion |
| **Class 2** | 37–68 | **The beacons of the Universe**: quasars, VLBI ($\tau = B\cos\theta/c$, $10$ ps $\to$ $60\,\mu$as), ICRS vs. ICRF (ICRF1/2/3, 303 defining sources), Hipparcos, Gaia-CRF3 and the Galaxy's acceleration ($5.8\,\mu$as/yr) |
| **Class 3** | 69–105 | **The bridge between the sky and the ground**: turning axes, the $Q\,R\,W$ chain, ERA (solar vs. sidereal day), UT1, CIP, $dX$/$dY$, polar motion (Chandler + annual), the five EOP, who measures (VLBI, GNSS, SLR, DORIS) and who publishes (IERS) |
| **Class 4** | 106–136 | **Time and practice**: UT1, UTC, TAI, TT, GNSS times, the 27 leap seconds and their end (28th CGPM, 15 Oct 2026), relativity in GPS clocks, orbit $\to$ TEME $\to$ ECEF, the error budget and Brazil (ON, Fortaleza, RBMC) |
| **Appendix** | 137–148 | **A1–A9 and sources**: normative milestones, the $Q\,R\,W$ chain in formulas, ERA/GMST, precession of a star (Sirius), relativity sums, the 27 leap seconds, PT/EN glossary |

#### Highlights

- **Step-by-step pedagogy:** *Where we left off*, *Today's questions* and *Take-home* frame each class; the **Your turn** and **Stop and think** boxes show the answer only on the next click (the same page repeated in the PDF).
- **System vs. frame, again:** the ICRS is the written rule (origin at the barycenter, axes tied to extragalactic objects, no rotation); the ICRF is the list of quasars measured by VLBI. The bridge to the ground is the subject of classes 3 and 4.
- **The folder's simulators are part of the class:** `astrometria/` (what it leaves out: precession, nutation, UT1) and `GNSS_simul/` (orbits, TEME $\to$ ECEF with the sidereal angle only, no $W$, and UT1 $=$ UTC).
- **Color code** (same as the other classes): <span style="color:#4F46E5">**system / rule**</span> (indigo), <span style="color:#0D9488">**frame / measured**</span> (teal), <span style="color:#D97706">**time**</span> (amber), <span style="color:#E11D48">**difference / error**</span> (rose) and <span style="color:#0284C7">**the sky**</span> (blue).
- **Numbers recomputed by script:** `sgr_celestes_numeros.py` (pure Python, no dependencies) prints, class by class, every value quoted (Sirius precession, ERA and sidereal day, 1 ms of UT1 $=$ 0.47 m, GPS relativity, repeat orbits, error budget) and, with `--figuras`, the coordinates of the figures (satellite track, celestial sphere, Hammer map).
- **Dates and sources checked on 18 Oct 2026**, listed on the *Sources and further reading* slides. **Two caveats, also stated in the deck:** (1) Resolution 5 of the 28th CGPM (continuous UTC from 20 May 2027, 1 h limit for $|\text{UT1}-\text{UTC}|$) was checked against the statement of the CCTF president and the technical press, **not** against the official BIPM text; (2) some Brazilian data (ON Legal Time, the Fortaleza VGOS antenna, the 153 RBMC stations) came from search summaries, because the official sites were unreachable.

### Instruções de Compilação · Build Instructions

```bash
cd sistemas_coordenadas/explanations

# Versão em Português (sgr_celestes.pdf)
latexmk -pdf sgr_celestes.tex

# English Version (sgr_celestes_en.pdf)
latexmk -pdf sgr_celestes_en.tex

# Limpeza de arquivos intermediários · Clean auxiliary files
latexmk -c sgr_celestes.tex sgr_celestes_en.tex
rm -f sgr_celestes*.nav sgr_celestes*.snm

# Recalcular os números · Recompute the numbers
python3 sgr_celestes_numeros.py            # todas as aulas · all classes
python3 sgr_celestes_numeros.py --figuras  # coordenadas das figuras · figure coordinates
```

---

## 4. `sgb_altimetria.pdf` & `sgb_altimetria_en.pdf` — O Sistema Geodésico Brasileiro: Parte 2 — a rede altimétrica · The Brazilian Geodetic System: Part 2 — the vertical network

### Português

**A que altura?** É a Parte 2 prometida no último slide de `sgb_sirgas2000.pdf`. Se a Parte 1 ensinou *onde* fica cada ponto (latitude, longitude, altura sobre o elipsoide), esta ensina de onde vem a **altitude**: o **nível médio do mar** e o marégrafo, o **datum vertical** (Torres, Imbituba e Santana), o **nivelamento geométrico** e o erro que cresce com $\sqrt{K}$, a **rede de RRNN**, a **história dos ajustamentos** e o **REALT-2018** por dentro. Deck bilíngue (um único `.tex` gera as duas versões) com **165 páginas**, **quatro aulas de 50 minutos**, uma ideia por slide, linguagem de ensino médio e apêndice técnico.

**Enfoque complementar ao do geoide.** Geoide, superfícies de nível, número geopotencial, altitude normal, quase-geoide, IHRS/IHRF e hgeoHNOR2020 já têm aula própria (`rede_gravimetrica/explanations/`: `geoide_e_alturas`, `quase_geoide`, `gravimetria`); aqui só são *relembrados*. O que é novo: o mar e o marégrafo, o datum como *um* valor de NMM numa estação e época, o nivelamento e seus erros, a rede, os ajustamentos e os dois zeros do Brasil.

| Aula | Páginas | Tema |
|---|---|---|
| **Abertura** | 1–4 | Sumário, o que a Parte 1 deixou e o plano das quatro aulas |
| **Aula 1** | 5–46 | **Onde fica o zero?** O mar como régua (nível médio, marégrafo, marés, ciclo nodal de $18{,}6$ anos, quanto tempo de média); os zeros do Brasil (Torres 1919–20, nivelamento desde 1945, Imbituba 1949–57, a troca de 1958–59, Santana 1957–58 e o Amazonas); o zero não é o geoide (níveis de redução, o mar sobe e a altitude não muda) |
| **Aula 2** | 47–82 | **Lance a lance**: nível, mira, ré e vante ($\Delta h = \text{ré} - \text{vante}$), visadas iguais, ida e volta, invar; o erro aleatório $\eta\sqrt{K}$ contra o sistemático $\delta K$, a tolerância; a rede (RN, linhas, circuitos, macrocircuitos, fechamento); por que um circuito sem erro não fecha ($\sum \Delta n \neq \Delta C$) |
| **Aula 3** | 83–118 | **Os ajustamentos e o REALT**: a mesma RN com várias altitudes; mínimos quadrados do nivelamento com um exemplo de 4 nós; os 8 ajustamentos (1945–75), os três primeiros globais, macrocircuitos (1991–92), o ajuste simultâneo (2005–11, GHOST); o REALT-2018 (número geopotencial, gravidade real, dois blocos: RN 4X e RN 9329T) |
| **Aula 4** | 119–149 | **O zero hoje e amanhã**: a RMPG (seis marégrafos, GNSS, nivelamento ao marégrafo); os dois zeros diferem em cerca de $1{,}3$\,m (estudos); SIRGAS GT III e IHRS/IHRF; nivelar ou GNSS e modelo; a vida das RRNN; as três datas de toda altitude; as três redes do SGB |
| **Apêndice** | 150–165 | **A1–A8**: número geopotencial e tipos de altitude, mínimos quadrados do nivelamento (matriz normal como laplaciano), propagação de erro, cronologia 1919–2026, conta do ciclo nodal, glossário PT/EN, siglas e fontes |

#### Destaques

- **Pedagogia passo a passo:** *Onde paramos*, *As perguntas de hoje* e *Para levar para casa* delimitam cada aula; os quadros **Sua vez** e **Pare e pense** mostram a resposta só no clique seguinte (a mesma página repetida no PDF).
- **O simulador `nivelamento/` entra na aula 2:** o ruído $\sigma\sqrt{d}$ do simulador é o $\eta\sqrt{K}$ da aula; o teste global, o *data snooping* e o Monte Carlo aparecem no roteiro *Experimente*.
- **Números recalculados por script:** `sgb_altimetria_numeros.py` (Python puro) imprime, aula por aula, todos os valores citados (ciclos de maré, subida do mar, erros de visada, $\eta\sqrt{K}$ e $\delta K$, o ajuste de 4 nós com matriz normal e resíduos, cascata de blocos $\times$ simultâneo, $C \to H^{*}$, diferença entre as redes) e, com `--figuras`, as macros TikZ das figuras (maré, série sintética de NMM, costa esquemática, passeios aleatórios).
- **Código de cores** (o mesmo das outras aulas): <span style="color:#4F46E5">**sistema / regra**</span> (índigo), <span style="color:#0D9488">**frame / medido**</span> (teal), <span style="color:#D97706">**tempo**</span> (âmbar), <span style="color:#E11D48">**diferença / erro**</span> (rosa) e <span style="color:#0284C7">**o mar / geoide**</span> (azul).
- **Conferência com fontes primárias (21/10/2026):** a R.PR 22/1983 distingue discrepância de seção ($3\,\mathrm{mm}\sqrt K$), de linha ($4\,\mathrm{mm}\sqrt K$), fechamento de circuito ($0{,}5$ mm/km) e erro-padrão máximo da linha **após ajuste** ($2\,\mathrm{mm}\sqrt K$). Os percentuais $92{,}7/98{,}0/99{,}1/99{,}5\%$ são **frequências dos resíduos do bloco principal do REALT-2018**, não tolerâncias de campo. O relatório de 2019 informa **66.882 RRNN e 70.426 seções no bloco principal**, sem representar o total nacional.
- **Cronologia e ressalvas:** Santana usa observações de 1957–58, foi adotado em **1980**, e as RRNN antigas foram implantadas em **1980–81**. O AAGP tem referência de cálculo em **01/12/1992**. A troca Torres/Imbituba continua com duas datas documentadas: **1958 no IBGE (2011, p. 8)** e **1959 no IBGE (2019, p. 13)**. Taxas do NMM, subsidência e diferença entre data mantêm a qualificação de estimativas de estudos; a projeção até 2026 supõe taxa constante. Comprimentos de 230.000/370.000 km e demais dados sintéticos permanecem exemplos ilustrativos.
- **Referências e validação:** [fontes, páginas e alcance da conferência](sgb_altimetria_fontes.md); cálculos e controles em [sgb_altimetria_numeros.py](sgb_altimetria_numeros.py), com regressões em [test_sgb_altimetria_numeros.py](test_sgb_altimetria_numeros.py).

### English

**How high?** This is the Part 2 announced on the last slide of `sgb_sirgas2000_en.pdf`. If Part 1 taught *where* each point is (latitude, longitude, height above the ellipsoid), this part teaches where **altitude** comes from: **mean sea level** and the tide gauge, the **vertical datum** (Torres, Imbituba and Santana), **geometric leveling** and the error that grows with $\sqrt{K}$, the **network of benchmarks**, the **history of the adjustments** and **REALT-2018** from the inside. A bilingual deck (a single `.tex` builds both versions) with **165 pages**, **four 50-minute classes**, one idea per slide, high-school-level language and a technical appendix.

**A complement to the geoid classes.** The geoid, level surfaces, the geopotential number, normal heights, the quasigeoid, IHRS/IHRF and hgeoHNOR2020 already have their own classes (`rede_gravimetrica/explanations/`: `geoide_e_alturas`, `quase_geoide`, `gravimetria`); here they are only *recalled*. What is new: the sea and the tide gauge, the datum as *one* MSL value at one station and epoch, leveling and its errors, the network, the adjustments and Brazil's two zeros.

| Class | Pages | Topic |
|---|---|---|
| **Opening** | 1–4 | Contents, what Part 1 left us and the plan of the four classes |
| **Class 1** | 5–46 | **Where is the zero?** The sea as a ruler (mean level, tide gauge, tides, the $18.6$-year nodal cycle, how long to average); Brazil's zeros (Torres 1919–20, leveling since 1945, Imbituba 1949–57, the 1958–59 change, Santana 1957–58 and the Amazon); the zero is not the geoid (reduction levels, the sea rises and the altitude does not change) |
| **Class 2** | 47–82 | **Leg by leg**: level, rod, backsight and foresight ($\Delta h = \text{back} - \text{fore}$), equal sights, forward and back, invar; random error $\eta\sqrt{K}$ versus systematic $\delta K$, the tolerance; the network (benchmark, lines, loops, macro-loops, misclosure); why an error-free loop does not close ($\sum \Delta n \neq \Delta C$) |
| **Class 3** | 83–118 | **The adjustments and REALT**: the same benchmark with several altitudes; least squares for leveling with a 4-node example; the 8 adjustments (1945–75), the first three global, macro-loops (1991–92), the simultaneous adjustment (2005–11, GHOST); REALT-2018 (geopotential number, real gravity, two blocks: RN 4X and RN 9329T) |
| **Class 4** | 119–149 | **The zero, now and next**: the RMPG (six tide gauges, GNSS, leveling to the gauge); the two zeros differ by about $1.3$\,m (studies); SIRGAS WG III and IHRS/IHRF; level, or GNSS and a model; the life of benchmarks; the three dates of every altitude; the three SGB networks |
| **Appendix** | 150–165 | **A1–A8**: geopotential number and kinds of height, least squares for leveling (normal matrix as a Laplacian), error propagation, timeline 1919–2026, the nodal-cycle computation, PT/EN glossary, acronyms and sources |

#### Highlights

- **Step-by-step pedagogy:** *Where we left off*, *Today's questions* and *Take-home* frame each class; the **Your turn** and **Stop and think** boxes show the answer only on the next click (the same page repeated in the PDF).
- **The `nivelamento/` simulator is part of class 2:** the simulator's $\sigma\sqrt{d}$ noise is the class's $\eta\sqrt{K}$; the global test, data snooping and Monte Carlo appear in the *Try it* walkthrough.
- **Numbers recomputed by script:** `sgb_altimetria_numeros.py` (pure Python) prints, class by class, every value quoted (tide cycles, sea rise, sight errors, $\eta\sqrt{K}$ and $\delta K$, the 4-node adjustment with normal matrix and residuals, block cascade $\times$ simultaneous, $C \to H^{*}$, the offset between the networks) and, with `--figuras`, the TikZ macros of the figures (tide, synthetic MSL series, sketched coast, random walks).
- **Color code** (same as the other classes): <span style="color:#4F46E5">**system / rule**</span> (indigo), <span style="color:#0D9488">**frame / measured**</span> (teal), <span style="color:#D97706">**time**</span> (amber), <span style="color:#E11D48">**difference / error**</span> (rose) and <span style="color:#0284C7">**the sea / geoid**</span> (blue).
- **Primary-source verification (21 Oct 2026):** R.PR 22/1983 distinguishes section discrepancy ($3\,\mathrm{mm}\sqrt K$), line discrepancy ($4\,\mathrm{mm}\sqrt K$), circuit misclosure ($0.5$ mm/km) and maximum **adjusted-line standard error** ($2\,\mathrm{mm}\sqrt K$). The $92.7/98.0/99.1/99.5\%$ figures are **empirical residual frequencies for the REALT-2018 principal block**, not field tolerances. The 2019 report gives **66,882 benchmarks and 70,426 sections in that block**, not a national total.
- **Chronology and qualifications:** Santana uses 1957–58 observations, was adopted in **1980**, and its old benchmarks were established in **1980–81**. The AAGP calculation reference is **1 December 1992**. Torres/Imbituba retains two documented dates: **1958 in IBGE (2011, p. 8)** and **1959 in IBGE (2019, p. 13)**. MSL trends, subsidence and datum offsets retain their qualification as study estimates; projection to 2026 assumes a constant rate. The 230,000/370,000 km lengths and other synthetic data remain illustrative examples.
- **References and validation:** [sources, pages and verification scope](sgb_altimetria_fontes.md); calculations and checks in [sgb_altimetria_numeros.py](sgb_altimetria_numeros.py), with regressions in [test_sgb_altimetria_numeros.py](test_sgb_altimetria_numeros.py).

### Instruções de Compilação · Build Instructions

```bash
cd sistemas_coordenadas/explanations

# Versão em Português (sgb_altimetria.pdf)
latexmk -pdf sgb_altimetria.tex

# English Version (sgb_altimetria_en.pdf)
latexmk -pdf sgb_altimetria_en.tex

# Limpeza de arquivos intermediários · Clean auxiliary files
latexmk -c sgb_altimetria.tex sgb_altimetria_en.tex
rm -f sgb_altimetria*.nav sgb_altimetria*.snm

# Recalcular os números · Recompute the numbers
python3 sgb_altimetria_numeros.py            # todas as aulas · all classes
python3 sgb_altimetria_numeros.py --figuras  # macros TikZ das figuras · figure TikZ macros
python3 -m unittest -v test_sgb_altimetria_numeros.py  # controles e exemplos · checks and examples
```

