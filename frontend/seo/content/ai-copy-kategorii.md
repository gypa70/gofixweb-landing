---
title: 'AI text do kategorie nevyřeší desítky prázdných archivů'
description: 'Generovaný odstavec v kategorii nestačí, když je URL zbytečná, duplikuje se nebo obsahuje jediný produkt.'
date: '2026-11-09'
display_date: '9. listopadu 2026'
lang: 'cs'
tags:
  - AI
  - Katalog
---

Když má e-shop padesát kategorií a v polovině z nich visí jeden nebo dva produkty, přidání AI textu nic nespraví. Vygenerovaný odstavec pod nadpisem „Dámské tenisky – růžové" nevytvoří důvod, proč by taková URL měla existovat.

Problém není v tom, že chybí copywriting. Problém je, že existuje archiv, který nemá co nabídnout.

## Tenká kategorie znamená duplicitní obsah

Kategorie s jedním produktem obvykle duplikuje popis z produktové stránky. Pokud AI vygeneruje další odstavec, vzniknou tři URL se stejným tématem: produktová stránka, kategorie a často ještě tag nebo filtr.

Vyhledávač vidí:

- `/produkt/damske-tenisky-ruzove/`  
- `/kategorie/tenisky-ruzove/`  
- `/znacka/nike/?barva=ruzova`

Všechny tři mluví o stejné věci. Přidání textu do kategorie nevytvoří unikátní hodnotu, jen další variantu stejného sdělení.

V prohlížeči to ověříte rychle: otevřete kategorii, zkopírujte kus textu, vložte do vyhledávače v uvozovkách. Pokud se objeví produktová stránka i kategorie, máte duplicitu.

## Generovaný text nezakryje prázdný archiv

AI nástroj dokáže napsat odstavec o růžových teniskách. Napíše ho gramaticky správně, s klíčovými slovy, s výzvou k akci. Ale když pod ním visí jediný produkt, návštěvník vidí prázdnou stránku s textem, který slibuje výběr.

To není problém copywritingu. To je problém struktury katalogu.

Pokud máte deset barevných variant jednoho modelu a každá má vlastní kategorii, nevyřešíte to deseti AI texty. Vyřešíte to sloučením do jedné kategorie s filtrem barev.

Stejně tak u značek: pokud prodáváte tři produkty značky XY, nepotřebujete archiv `/znacka/xy/`. Potřebujete je zařadit do smysluplné kategorie podle typu produktu.

## Co dělat s URL, které nemají co nabídnout

Nejdřív projděte kategorie v administraci WooCommerce. Seřaďte podle počtu produktů. Všechny s jedním nebo dvěma kusy označte.

Pak se zeptejte:

- Má tato kategorie potenciál růst? (Plánujete doplnit produkty?)  
- Nabízí unikátní filtrování, které jinde nemáte?  
- Hledají ji zákazníci? (Zkontrolujte Search Console, jestli se URL vůbec zobrazuje.)

Pokud je odpověď třikrát ne, máte tři možnosti:

1. **Sloučit** – přesunout produkty do širší kategorie a prázdnou smazat.  
2. **Noindex** – nechat URL živou pro navigaci, ale vyřadit z indexu (`noindex, follow`).  
3. **Přesměrovat** – smazat kategorii a nastavit 301 redirect na nadřazenou.

AI text do kategorie má smysl, až když kategorie sama o sobě dává smysl.

## Kdy AI copy v kategorii funguje

Generovaný text pomůže, pokud:

- Kategorie obsahuje aspoň pět až deset produktů.  
- Téma kategorie je jasně oddělené od produktových stránek (např. „Běžecké boty do terénu" vs. konkrétní model).  
- Chcete doplnit kontext pro vyhledávače (např. vysvětlit rozdíl mezi podkategoriemi).

V takovém případě AI nástroj ušetří čas: vygeneruje odstavec, který popisuje zaměření kategorie, bez nutnosti psát ručně padesát variant.

Ale i tady platí: text musíte zkontrolovat. AI často opakuje fráze, vymýšlí vlastnosti, které produkty nemají, nebo píše obecně („široký výběr kvalitních produktů"). To je horší než žádný text.

V GoFixWeb diagnostice vidíte, které kategorie mají duplicitní title nebo H1 – to je signál, že buď chybí text, nebo že existuje víc archivů se stejným tématem. Sken ale neřeší, jestli má kategorie vůbec existovat. To musíte posoudit vy.

## Míň URL, líp napsaných

Raději třicet kategorií s pěti produkty a smysluplným popisem než padesát archivů s jedním kusem a AI odstavcem.

Vyhledávač nehodnotí počet stránek. Hodnotí, jestli URL odpovídá na konkrétní dotaz lépe než konkurence. Tenká kategorie s generovaným textem neodpovídá na nic – jen zabírá místo v indexu.

Pokud chcete AI využít pro copywriting, začněte úklidem katalogu. Smažte, sloučte nebo noindexujte archivy, které nemají co nabídnout. Teprve pak doplňte text tam, kde dává smysl.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
