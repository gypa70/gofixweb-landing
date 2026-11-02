---
title: 'AI umí vygenerovat fotku. LCP spíš spraví komprese té, kterou už máte'
description: 'Generativní obrázky vypadají dobře, ale LCP řeší bajty. Kdy nová grafika škodí víc než stará těžká fotka.'
date: '2026-11-02'
display_date: '2. listopadu 2026'
lang: 'cs'
tags:
  - AI
  - Obrázky
---

Generativní AI dnes umí vytvořit obrázek na míru. Zadáte prompt, dostanete vizuál, který sedí na barvu, kompozici, atmosféru. Problém je, že prohlížeč stahuje bajty, ne estetiku. A když nová AI fotka váží víc než původní, Largest Contentful Paint se zhorší, ne zlepší.

Článek se drží jednoho úhlu: kdy výměna obrázku za generovaný škodí rychlosti víc, než kdybyste původní jen zkomprimovali.

## Proč generativní obrázky často váží víc

AI nástroje (Midjourney, DALL·E, Stable Diffusion) generují obrázky ve vysokém rozlišení – typicky 1024×1024 px nebo víc, často ve formátu PNG. Výsledný soubor může mít 2–4 MB, protože model neřeší optimalizaci pro web.

Původní fotka z telefonu nebo banky obrázků může mít stejné rozlišení, ale formát JPEG s rozumnou kompresí ji stlačí na 300–600 kB. Když ji nahradíte AI obrázkem bez komprese, prohlížeč stáhne víc dat. LCP se prodlouží, PageSpeed skóre klesne.

Kontrola v prohlížeči: otevřete DevTools → Network → Img, obnovte stránku, podívejte se na sloupec Size u hlavního obrázku. Pokud vidíte číslo nad 1 MB, máte prostor pro kompresi – ať už jde o AI grafiku, nebo původní fotku.

## Kdy má smysl obrázek vyměnit

Výměna dává smysl, když původní vizuál je nečitelný, pixelovaný, nebo nesedí na obsah. Například: generický stock obrázek „muž u počítače" na stránce o autoopravně. Tam AI může vytvořit fotku dílny, která lépe odpovídá textu.

Ale i v tom případě platí: nový obrázek musíte zkomprimovat. Ideálně převést do WebP nebo AVIF, nastavit responsive varianty přes `srcset`, aby mobil nestahoval desktop rozlišení.

Pokud původní obrázek sedí na obsah a jen váží moc, komprese je rychlejší a levnější než generování nového. Nástroje jako TinyPNG, Squoosh nebo WP plugin Imagify stlačí JPEG nebo PNG bezztrátově nebo s minimální ztrátou kvality. Výsledek: stejný vizuál, menší soubor, lepší LCP.

## Co měří PageSpeed Insights a proč to záleží

PageSpeed Insights v sekci „Opportunities" často hlásí „Properly size images" nebo „Serve images in next-gen formats". To znamená, že prohlížeč stáhl obrázek větší, než bylo nutné pro viewport, nebo ve formátu, který není optimální.

LCP (Largest Contentful Paint) měří, kdy se vykreslí největší viditelný prvek – často hero obrázek na homepage. Pokud ten prvek váží 3 MB, prohlížeč ho stahuje déle, LCP roste, skóre klesá. Výměna za AI obrázek o váze 4 MB problém zhorší, ne vyřeší.

Field data v PageSpeed (CrUX) ukazují reálné načítání u návštěvníků za posledních 28 dní. Pokud tam vidíte LCP nad 2,5 s, komprese obrázků je první krok. Generování nových má smysl až po té kompresi, ne místo ní.

## Kdy GoFixWeb komprimuje a kdy ne

GoFixWeb v režimu Auto (jen WooCommerce) komprimuje obrázky produktů a kategorií přes WP media knihovnu. Nenahrazuje je AI grafikou, protože produktová fotka musí odpovídat reálnému zboží. Komprese je bezztrátová nebo s minimální ztrátou, formát zůstává JPEG nebo PNG, případně WebP, pokud to server podporuje.

Režim Auto nesahá na hero obrázky v page builderu ani na grafiku vloženou přes HTML/CSS. Tam sken v reportu ukáže váhu a doporučí kompresi, ale výměnu nebo nahrání nového souboru musíte udělat ručně.

Pokud chcete použít AI obrázek na homepage, postup je: vygenerovat, zkomprimovat mimo WordPress (Squoosh, TinyPNG), nahrát do media knihovny, vložit přes page builder, zkontrolovat DevTools → Network, jestli prohlížeč stahuje správnou variantu.

## Praktický postup: komprese před výměnou

1. Otevřete homepage v prohlížeči, DevTools → Network → Img, obnovte stránku.
2. Najděte největší obrázek (sloupec Size), poznamenejte si název a váhu.
3. Pokud váží víc než 500 kB, stáhněte ho, zkomprimujte (TinyPNG, Squoosh), nahrajte zpět.
4. Obnovte stránku, zkontrolujte novou váhu. Pokud LCP klesl pod 2,5 s, máte hotovo.
5. Teprve když komprese nestačí (obrázek je pixelovaný nebo nesedí na obsah), zvažte výměnu za AI grafiku – ale tu opět zkomprimujte před nahráním.

Tento postup funguje i na kategoriích, produktech, blog článcích. Komprese je vždy první krok, generování nového vizuálu až druhý.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
