# GoFixWeb PDF — redesign, světlé téma

Návrh vychází z exportu `gofixweb-pdf-template-export.zip` (README.md + tokens.css + visual-spec.html).
Export je **vizuální výchozí bod, ne generátor** — produkce skládá PDF v Pythonu (ReportLab Platypus),
HTML v pipeline neexistuje. Tento návrh je proto prohlížitelný v prohlížeči, ale každá komponenta má
níže uvedený ReportLab ekvivalent, aby se dal převést ručně.

Náhled: `report-preview/index.html` · tokeny: `tokens.css` · komponenty: `report.css`

## Co se změnilo proti exportu

| Oblast | Export | Redesign |
| --- | --- | --- |
| Pozadí stránky | `#1a2332` (dark) | `#ffffff` (light) |
| Peněžní ztráta | červená `#f87171` | jantarová `#b45309` |
| Chybový stav | nerozlišen | červená `#b91c1c` |
| Oprava / zlepšení | zelená `#4ade80` na tmavém | zelená `#15803d` na světlém |
| Skóre | jen text `62/100` | KPI pás + ukazatel plnění |
| Nález | řádek tabulky + jeden natvrdo napsaný AI box | opakovatelná karta nálezu |
| Dvousloupcové bloky | `display: grid` | skutečné `<table>` |

Report je dokument, který se tiskne a čte v PDF prohlížeči — tmavé pozadí patří landing page, ne A4.
Světlé pozadí navíc odstraňuje spotřebu toneru a problém s tiskem bílého textu.

## Barevné role — tři, nemíchají se

| Role | Barva | Kde se používá |
| --- | --- | --- |
| **Oprava** | `#15803d` | návod k opravě, provedená oprava, sloupec „Po“, kladná změna, CTA cena |
| **Ztráta v Kč** | `#b45309` | výhradně peněžní částky: `monthly_loss_czk`, roční ztráta, sloupec `Kč/měs.` |
| **Chybový stav** | `#b91c1c` | co je na webu rozbité: „Chybí title“, LCP 4,8 s, sloupec „Před“ |
| *(bez stavu)* | `#475569` | neutrální — meta, mřížka, stav `neovereno`. Není čtvrtá role. |

Rozdíl proti exportu: tam byla červená `--loss` použitá na peníze **i** na datum skenu. Tady peníze nikdy
nejsou červené — červená znamená vadu, jantarová její cenu. Díky tomu jde v tabulce nálezů číst příčinu
a dopad zvlášť.

## Datový kontrakt

**REPORT (dokument)**

| Pole | Kde se používá |
| --- | --- |
| `varianta` (`manual` / `auto`) | Pruh varianty pod dělicí linkou; přepíná obsah karty a hlavičku tabulky nálezů. Zdroj = objednávka, ne scanner. |
| `platforma` | Jen MANUÁL. Řídí formulaci cesty v administraci (Shoptet vs WooCommerce mají jiné menu). |
| `mereni_pred`, `mereni_po` | Jen typ 3, jen AUTO. Box zdroje dat + srovnávací tabulka + dvojitý KPI pás. |

**NÁLEZ (karta)**

| Pole | Poznámka |
| --- | --- |
| `issue` | Titulek karty. |
| `issue_type` | Volba textu návodu / popisu opravy. |
| `monthly_loss_czk` | Pravý sloupec hlavičky karty a sloupec `Kč/měs.` — vždy jantarová. |
| `stav` | **Jen AUTO.** V MANUÁL se nepoužívá vůbec. |

## Kde se `stav` smí objevit — řídí TYP reportu, ne jen varianta

| Typ reportu | Varianta | Povolené stavy |
| --- | --- | --- |
| 2 Vstupní (teaser) | jednotný | `stav` se nepoužívá |
| 1 Kompletní | manual | `stav` se nepoužívá |
| 1 Kompletní | auto | `opraveno` · `neovereno` · `nelze_automaticky` |
| 3 Před/Po | auto | `opraveno` · `nelze_automaticky` |

`neovereno` existuje **výhradně v typu 1 AUTO**, protože PDF se generuje ještě před spuštěním automatické
opravy. Typ 3 vzniká až po dokončení, takže `neovereno` se v něm nikdy neobjeví — implementuj to jako
validaci vstupu, ne jako třetí vizuální větev.

**Důsledek:** typ 1 AUTO **nesmí** uvádět skóre po opravě ani srovnání `62 → 88`. V ten moment žádné „po“
neexistuje. Skóre je stav při skenu; srovnání patří jedině do typu 3.

## Obsah karty podle stavu

| Stav | Box | Barva | Co karta říká |
| --- | --- | --- | --- |
| `opraveno` | „Provedená oprava“ | zelená `--fix-*` | Co bylo změněno, doklad z auditního logu (`wp_autofix_log status=applied`), „Vaše akce: žádná“ |
| `neovereno` | „Naplánovaná oprava“ | neutrální `--pending-*` | Co doplníme, explicitní věta, že report vznikl před zápisem, doklad bude v Před/Po |
| `nelze_automaticky` | „Kde a jak to opravit“ | zelená `--fix-*` | Plný návod + řádek „Proč ručně“, aby zákazník nezůstal bez řešení |
| MANUÁL (bez `stav`) | „Kde a jak to opravit“ | zelená `--fix-*` | Kroky, text k vložení, ověření, čas — žádný štítek stavu |

`neovereno` je záměrně neutrální: není zelený, aby nevypadal jako potvrzený úspěch, a není červený,
protože o vadu nejde. Řádek zjištěné vady zůstává i tak červený — vada existuje, jen oprava ještě neběžela.

## Mapování do ReportLab (Platypus)

Uvnitř `.page` není žádný grid ani flex jako nosný layout, žádný `box-shadow`, blur, glow, clip-path,
maska, filtr, animace ani `border-radius`. Grid a stín existují jen v náhledovém rámu `.kit` mimo A4.
Dvousloupcové bloky, které měl export jako `display: grid` (finanční box, CTA), jsou tu skutečné
`<table>`, takže převod je 1:1. Font je pouze Arial / Arial-Bold — nic k registraci navíc.

| Prvek náhledu | ReportLab |
| --- | --- |
| `.page` | `SimpleDocTemplate(pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=15*mm, bottomMargin=26*mm)` |
| `.page::before` vodoznak | `canvas.saveState()` → `rotate(-45)` → `drawString()` → `restoreState()`, kreslí se PŘED obsahem |
| `.footer` | `onPage` callback, absolutní kresba mimo tok Platypus |
| `hr.rule` | `Table` výšky 1 px s `BACKGROUND --fix-rule`, nebo `HRFlowable` |
| `h2.sec` | `Paragraph` + `LINEBELOW` tenkou linkou, nebo spodní `Table` linka |
| `table.variant` | `Table([[tag, desc]], colWidths=[30*mm, 140*mm])`, `BACKGROUND` per buňka |
| `table.kpi` | `Table([[loss, score]], colWidths=[85*mm, 85*mm])`, `BOX` + `BACKGROUND` per buňka |
| `table.bar` | `Table([[fill, rest]], colWidths=[hodnota*w, (1-hodnota)*w], rowHeights=[2*mm])` — šířky se počítají ze skóre, ne CSS procenty |
| `table.metrics` | `Table(colWidths=[42*mm, 20*mm, zbytek])`, `LINEBELOW` 0.5 `--hairline-soft` |
| `table.data` | `Table(colWidths=[…], style=[GRID 0.5 --hairline, BACKGROUND header --surface-2, ROWBACKGROUNDS (white, --surface-1)])` |
| `table.card` | vnější `Table` se dvěma řádky (head / body), `BOX` 0.5; head `colWidths=[8*mm, 128*mm, 34*mm]` |
| `table.kv` | vnořená `Table(colWidths=[32*mm, zbytek])`, bez mřížky, `VALIGN TOP` |
| `.box` | `Table` s jednou celou o `Paragraph`, `BOX` 0.5 + plný `BACKGROUND` |
| `.snippet` | `Table` s `BOX` 0.5 `--hairline`, `BACKGROUND` bílá, text bold |
| `table.steps` | `Table(colWidths=[6*mm, zbytek])`, bez mřížky |
| `.pill` | krátká `Table` s plným `BACKGROUND` a `BOX` 0.5, `hAlign='LEFT'` |
| `table.fin` | `Table([[left, right]], colWidths=[85*mm, 85*mm])` |
| `table.cta-row` | `Table([[a, b]], colWidths=[83*mm, 83*mm])`, mezera přes `LEFTPADDING`/`RIGHTPADDING` |
| `.source` | `Table` na 170 mm, `BOX` 0.5 `--hairline`, `BACKGROUND --surface-1` |
| `td.delta` | `BACKGROUND --fix-bg` + `TEXTCOLOR --fix-strong` |

Karta nálezu je vysoká a nesmí se rozpadnout mezi stránky — obal ji do `KeepTogether([...])`.
Pokud se nevejde, `CondPageBreak` před ní. Totéž platí pro KPI pás, aby se neoddělil od hlavičky.

Ukazatel plnění (`table.bar`) je jediná komponenta, kde náhled používá procenta v `style` atributu.
V ReportLab se místo toho spočítá `colWidths` — procenta jsou v HTML jen zástupné vyjádření.

## Hraniční případy pro generátor

- MANUÁL bez `kroky[]` u nálezu: karta nesmí vykreslit prázdný box — nález patří do tabulky bez karty.
- AUTO `opraveno` bez záznamu v auditním logu: chybí doklad, nelze tvrdit „opraveno“ → ošetřit jako `neovereno`.
- Typ 3 s nálezem ve stavu `neovereno`: chyba na vstupu, report negenerovat.
- Všechny nálezy v typu 1 AUTO ve stavu `nelze_automaticky`: report je fakticky manuální, přeformulovat pruh varianty.
- Typ 3 se zápornou změnou metriky: sloupec „Změna“ přepnout na `--error` a `--error-bg`. Regrese je chybový
  stav, ne zlepšení — nesmí zůstat zelená.
- Skóre nad 90: ukazatel plnění použije `--bar-good`, pod 50 `--bar-bad`, mezi `--bar-mid`.

## Co v návrhu záměrně není

Žádné API klíče, databáze, Stripe, webhooky, platební odkazy, tracking ani kód scanneru.
Data jsou placeholder na `example.cz`. Ceny v teaseru jsou jen text, bez odkazu.