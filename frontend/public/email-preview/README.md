# GoFixWeb — e-mailové šablony podle fáze objednávky

Sedm HTML šablon, jedna pro každý okamžik v cestě zákazníka; fáze 7 existuje **jen pro variantu MANUÁL**
a má k sobě SK verzi. Není to jeden univerzální vzhled s proměnným obsahem — každá šablona má vlastní
strukturu a tón, protože řeší jinou situaci.

U jednorázového nákupu AUTO se sedmý e-mail neposílá vůbec. AUTO má jediný doručovací e-mail
(`05-audit-trail-auto.html`) a definitivní výsledek Před / Po se doplňuje **podmíněně do něj**,
až když je kontrolní měření k dispozici.

Náhled: `email-preview/index.html`

| # | Soubor | Fáze | Úkol e-mailu |
| --- | --- | --- | --- |
| 1 | `01-teaser.html` | před rozhodnutím | prodat |
| 2 | `02-followup-2h.html` | otevřel, neklikl | odstranit překážku |
| 3 | `03-followup-48h.html` | klikl, nezaplatil | obnovit objednávku |
| 4 | `04-potvrzeni-platby.html` | zaplaceno, čeká se | ujistit |
| 5 | `05-audit-trail-auto.html` | hotovo — AUTO | předat výsledek s dokladem |
| 6 | `06-report-manual.html` | hotovo — MANUÁL | doručit PDF a nastartovat opravu |
| 7 | `07-final-report-manual.html` | 7 dní po dodání návodu (jen MANUÁL) | zjistit výsledek a nabídnout kontrolní sken |

Slovenská verze fáze 7: `07-final-report-manual-sk.html`.
Zrcadlí český originál — shodná struktura, barvy i podmíněná logika, mění se jen jazyk a `lang`.
Při úpravě jedné verze upravit i druhou. **Ceny zůstávají v Kč i v SK verzi** (fakturuje se v Kč,
takže jiná měna by neodpovídala tomu, co zákazník zaplatil).

## Fáze 7 — check-in (jen MANUÁL)

Fáze 7 patří výhradně variantě MANUÁL. AUTO svou vlastní šablonu fáze 7 **nemá** — u jednorázového
nákupu AUTO je posledním e-mailem šablona 5, do které se výsledek Před / Po vkládá podmíněně
(vykreslí se jen tehdy, když kontrolní měření proběhlo a data existují). Dokud data nejsou,
šablona 5 srovnání neuvádí a nic dalšího se neposílá.

Šablona 7 je check-in s odstupem (např. 7 dní) po dodání kompletního reportu. Tato varianta
**nesmí obsahovat Před/Po**: opravy provádí zákazník ve svém tempu a GoFixWeb jeho e-shop
průběžně neměří, takže hodnota „Po“ neexistuje a jakékoli srovnání by bylo vymyšlené. Místo
sloupce „Po“ stojí pomlčka a věta o tom, co nevíme. Hlavní CTA „Chci vidět výsledek“
(`{{ control_scan_url }}`) spustí nové měření a zákazník dostane vlastní report Před/Po.
Druhá cesta (`{{ resend_report_url }}` nebo odpověď na e-mail) je pro ty, kdo se k návodu
nedostali — nesmí vyznít jako upomínka, zákazník za návod zaplatil a tempo si určuje sám.
Fázový pruh je zde neutrální, ne zelený: nic není dokončeno, jde o dotaz.

Osobní podpis zakladatele je v šabloně 7 **výjimkou** mezi transakčními šablonami. Šablony
4, 5 a 6 jsou doklady o platbě nebo výsledku, tam podpis nepatří. Tato šablona ale klade
otázku a měří se odpovědí, takže institucionální patička by odporovala tomu, co e-mail dělá.

## Jednotné komponenty (shodné ve všech sedmi)

Hlavička s logem `GoFix` + zelený `Web` → zelená dělicí linka 3 px `#16a34a` → fázový pruh
(štítek 128 px + popis) → tělo → CTA tlačítko → patička s kontaktem, právními odkazy a odhlášením.
Šířka 600 px, vnější plocha `#f1f5f9`, tělo `#ffffff`, rám `1px solid #cbd5e1`.

Mění se pouze fázový pruh (text a barva štítku), nadpis, obsah těla a formulace CTA.

## Barevné role — tři, nemíchají se

Shodné s PDF (`report-preview/tokens.css`). Světlé pozadí, plné krycí barvy.

| Role | Text | Výplň | Rám | Použití |
| --- | --- | --- | --- | --- |
| Oprava | `#15803d`, `#166534` | `#f0fdf4` | `#86efac` | návod, provedený zásah, CTA tlačítka, potvrzení platby |
| Částka v Kč | `#b45309` | `#fffbeb` | `#fcd34d` | **všechny** peněžní částky — ztráta i cena, jediný odstín napříč šablonami |
| Chybový stav | `#b91c1c` | `#fef2f2` | `#fca5a5` | **výhradně** zjištěná vada a stav `nelze_automaticky`, nikdy peníze |
| Bez stavu | `#475569` | `#f1f5f9` | `#cbd5e1` | meta, mřížka, `neovereno` |
| Nadpis varianty | `#000000` | — | — | `MANUÁLNÍ OPRAVA` / `AUTOMATICKÁ OPRAVA` v CTA boxech teaseru |

Nadpis varianty v CTA boxech je **černý tučný** — nepoužívá se `#475569` ani zelená `#166534`.
Je to popisek volby, kterou si zákazník vybírá, ne signál stavu opravy; obarvení dělalo z jedné
varianty vizuálně „doporučenou“ a z druhé potlačenou. Odlišení variant nese rámeček boxu.
Stejné pravidlo platí pro `.vlabel` v PDF (`report-preview/report.css`).

Pravidlo pro částky je absolutní: číslo v Kč nesmí být nikdy červené, ani když jde o ztrátu.
Červená patří jen vadě, ne peněžní hodnotě. Pro částky se nepoužívá ani tmavší `#92400e` —
jeden odstín `#b45309` drží KPI boxy, tabulkové sloupce Kč/měs. i ceny vizuálně konzistentní.

Typografie: `Arial, Helvetica, sans-serif`. Bricolage Grotesque a Manrope z landing page se
záměrně nepoužívají — Gmail i Outlook web fonty běžně blokují a fallback by vzhled rozhodil.
PDF používá stejný systémový font, takže e-mail a příloha vypadají konzistentně.

## Technická omezení

- Table-based layout, veškeré CSS inline v `style` atributech.
- Žádné CSS proměnné, žádný flexbox, grid, `border-radius`, `box-shadow`, gradient ani `@media`.
- Šířky sloupců v procentech + `width` atribut (Outlook ignoruje čistě CSS šířky).
- Tlačítka jsou `<table>` s `bgcolor` na `<td>` a `<a>` uvnitř — ne `<button>`, ne `<div>`.
- Diakritika psaná HTML entitami, aby přežila i klienty s vlastní překódováním. `<meta charset="utf-8">` je přítomen.
- Preheader je skrytý `<div>` jako první prvek `<body>`.

## Placeholdery pro generátor

| Placeholder | Šablony | Význam |
| --- | --- | --- |
| `{{ unsubscribe_url }}` | 1–6 | odhlašovací odkaz |
| `{{ survey_url }}` | 2, 3 | dotazník; důvod se předává jako `?reason=<kod>` |
| `{{ resume_checkout_url }}` | 3 | návrat do nedokončeného checkoutu |
| `{{ report_pdf_url }}` | 5, 6 | odkaz na PDF report |
| `{{ founder_name }}` | 1, 2, 3 | jméno zakladatele v podpisu (`Libor Sup`) |
| `{{ founder_role }}` | 1, 2, 3 | funkce v podpisu (`zakladatel GoFixWeb`) |
| `{{ founder_email }}` | 1, 2, 3 | kontakt v podpisu (`info@gofixweb.com`, firemní adresa — ne osobní) |

## Osobní podpis zakladatele

Podpis je **jen ve třech prodejních šablonách** (1 teaser, 2 follow-up 2 h, 3 follow-up 48 h).
Blok nad patičkou, oddělený linkou `1px solid #e2e8f0`, jméno `#0f172a`, funkce a kontakt `#64748b`,
nad podpisem osobní věta nabízející přímou odpověď.

**Transakční šablony (4 potvrzení platby, 5 audit trail, 6 report MANUÁL) podpis NEMAJÍ** —
nesou pouze institucionální patičku. Doklad o platbě a stavový e-mail jsou věcné dokumenty;
osobní podpis by v nich působil rozporně vůči jejich charakteru. Nevracet ho tam.

Podpis nikdy neslibuje výsledek zásahu ani nenahrazuje stavovou logiku — je to jen kontakt na člověka.

Kódy důvodů — šablona 2: `nerozumim`, `nevrim-cislum`, `cena`, `nemam-cas`.
Šablona 3: `platba-selhala`, `spatna-varianta`, `obavy-o-web`, `potrebuji-schvaleni`.

Ostatní hodnoty (domény, částky, skóre, čísla objednávek, datumy, texty nálezů) jsou v šablonách
napsané jako ukázková data na `example.cz` — generátor je nahradí ze stejných polí, jaká plní PDF
(`varianta`, `platforma`, `score`, `monthly_loss_czk`, `issue`, `issue_type`, `stav`).

## Stavová logika — e-mail a PDF si nesmí odporovat

Šablona 5 přebírá pravidla z `report-preview/README.md` bez odchylky:

| `stav` | Barva | Nadpis boxu | Obsah |
| --- | --- | --- | --- |
| `opraveno` | zelená `#166534` / `#f0fdf4` / `#86efac` | Provedená oprava | co se změnilo + doklad `wp_autofix_log status=applied` + „Vaše akce: žádná“ |
| `nelze_automaticky` | červená `#b91c1c` / `#fef2f2` / `#fca5a5` | Kde a jak to opravit | plný návod + řádek „Proč ručně“ |
| `neovereno` | šedá `#475569` / `#f1f5f9` / `#cbd5e1` | Zatím neověřeno | stav v okamžiku odeslání, bez příslibu budoucího zásahu |

Tři stavy musí být rozlišitelné na první pohled — štítky `OPRAVENO` a `NELZE AUTOMATICKY`
nesmí být oba zelené. `nelze_automaticky` je chybový stav (vada trvá, jen ji řeší zákazník ručně),
proto nese červenou roli, i když text nabízí řešení.

Text u `neovereno` nesmí obsahovat žádný příslib („je zapsáno v plánu zásahů“, „provedeme“).
Správná formulace vyjadřuje nejistotu: v okamžiku odeslání nevíme, jestli je úprava nasazená,
protože k nálezu není zápis v auditním logu. Neověřujeme budoucí zásah, jen stav při odeslání.

- `neovereno` je neutrální, ne zelené (nejde o potvrzený úspěch) a ne červené (nejde o vadu).
  Neobsahuje příslib budoucí akce — jen konstatuje stav a odkáže, kde bude doklad.
- Titulek nálezu zůstává červený u všech tří stavů. Vada existovala nezávisle na tom, jak oprava dopadla.
- Šablona 5 **neuvádí** skóre po opravě ani srovnání `62 → 88`. To patří jedině do reportu Před/Po.
  Ze stejného důvodu šablona 4 nevypisuje u nálezů žádný stav.
- Šablona 6 (MANUÁL) `stav` nepoužívá vůbec — žádné štítky, jen vada + návod.

## CTA „Vyřešit ihned“ (šablona 5, AUTO)

E-mailový ekvivalent komponenty `table.cta-solve` z PDF Před/Po. Vkládá se jako samostatný řádek
tabulky **přímo pod detailní box nálezu**, ne na konec seznamu — nabídka musí být u toho nálezu,
kterého se týká.

| Vlastnost | Hodnota |
| --- | --- |
| Podmínka renderu | pouze stav `nelze_automaticky` |
| Text | „Tento nález lze odstranit ručně. Pošleme vám návod krok za krokem, včetně cesty v administraci — **bez platby**.“ |
| Tlačítko | „Vyřešit ihned“, `{{ manual_fix_url }}` |
| Podklad / rámec | `#f0fdf4` / spodní linka `#cbd5e1` |
| Barva textu | `#166534` (zelená role = oprava / CTA) |
| Cena | žádná — návod je bezplatný, takže v boxu není peněžní částka ani jantarová barva |
| Styl tlačítka | `bgcolor="#15803d"`, bílý bold `13px`, `padding:9px 18px` |

Pravidla:

- **Nikdy u `opraveno`** — nález je vyřešený, není co řešit.
- **Nikdy u `neovereno`** — problém není potvrzený, nabídka by odporovala neutrálnímu vyznění stavu
  („neověřujeme budoucí zásah, jen stav v okamžiku odeslání“).
- **Návod je bezplatný** (od 8. 9. 2026 součást varianty AUTO bez příplatku), shodně s CTA
  v PDF Před/Po. Cenu sem nevracet — placené CTA v jednom kanálu a bezplatné v druhém působí
  jako zdražení zpětně. Zákazníkům, kteří za návod zaplatili před přechodem, se částka vrací;
  oznamuje to podmíněný řádek u nálezu v šabloně 5.
- Cena 1 990 Kč u varianty MANUÁL v teaseru zůstává — to je nákup celého reportu s návody,
  ne dodatečný návod k jednomu nálezu, který zůstal neopravený.
- Pokud má report víc nálezů ve stavu `nelze_automaticky`, CTA se vykreslí pod každým z nich —
  odkaz nese identifikátor konkrétního nálezu, aby zákazník dostal návod adresně.
- Tlačítko je table-based (`bgcolor` + `<a>`), protože Outlook nerespektuje `padding` na odkazu.
  Nepřepisovat na `<a>` se stylem, tlačítko by se sneslo na velikost textu.

## Hraniční případy

- AUTO `opraveno` bez záznamu v auditním logu → chybí doklad, renderovat jako `neovereno`.
- Všechny nálezy `nelze_automaticky` → souhrnný pás nemá tvrdit „oprava dokončena“, přeformulovat fázový pruh.
- Méně než 4 nálezy v teaseru → vynechat zakrytý řádek, jinak zakrývá prázdno.
- Nulová vyčíslená ztráta → jantarový KPI box vynechat, ne zobrazit `0 Kč`.
- MANUÁL bez kroků u nálezu → nález patří jen do tabulky, ukázkový zelený box nerenderovat.