---
title: AI PageSpeed nezrychlí, dokud prohlížeč stahuje megabajtové fotky
description: Model navrhne postup, ale LCP píše server a síť. Kde AI diagnostikuje a kde jen měříte výsledek komprese.
date: 2026-09-28
slug: ai-a-pagespeed
---

Jazykovému modelu můžete popsat pomalou stránku, vložit výstup z PageSpeed Insights a dostat seznam kroků. Model ale nepřepíše šablonu, nenastaví WebP a nezmenší slider. Dokud prohlížeč stahuje 2,5 MB obrázků, LCP zůstane vysoké — bez ohledu na to, jak dobře AI popíše problém.

Tento článek ukazuje, kde AI diagnostika končí a kde začíná práce se soubory, pluginy a třetími stranami.

## Co AI vidí v PageSpeed reportu

PageSpeed Insights vrátí JSON se skóre, metrikami a seznamem příležitostí. Model z něj přečte:

- **Largest Contentful Paint** — čas zobrazení největšího prvku (obvykle obrázek).
- **Properly size images** — kolik kilobajtů by úspora komprese ušetřila.
- **Eliminate render-blocking resources** — CSS a JS, které blokují vykreslení.
- **Reduce unused JavaScript** — kód, který stránka nenačte.

Z těchto dat model sestaví prioritizovaný seznam: „Komprimujte obrázky, odložte nepoužívané skripty, přesuňte CSS do hlavičky." To je užitečné shrnutí, ale nezmění ani jeden bajt na serveru.

## Kde AI navrhne postup

GoFixWeb používá model k tomu, aby z veřejných dat (HTML, PageSpeed, Lighthouse) sestavil diagnostiku:

1. **Identifikace těžkých obrázků** — parser HTML najde `<img>`, stáhne hlavičku a zapíše rozměry i velikost souboru.
2. **Kontrola formátu** — pokud je JPEG větší než 200 kB a chybí WebP varianta, model doporučí kompresi.
3. **Třetí strany** — pokud HTML obsahuje `<script src="https://...">` z jiné domény, model upozorní na externí zdroj, který ovlivňuje LCP.
4. **Slider a galerie** — pokud HTML načítá deset obrázků najednou, model navrhne lazy loading nebo zmenšení počtu snímků.

Výstupem je PDF s konkrétními URL, velikostmi a doporučením. Implementaci ale musí provést buď automatický proces (u WooCommerce přes Application Password), nebo vy ručně.

## Co AI neprovede: komprese, CDN, hosting

Model nezmění konfiguraci serveru ani nepřepíše soubory. Tři nejčastější úkoly, které zůstávají na straně e-shopu:

### Komprese obrázků

PageSpeed často hlásí úsporu 1–2 MB. Aby se projevila, musíte:

- Nahrát WebP varianty nebo použít plugin (ShortPixel, Imagify).
- Nastavit `<picture>` s fallbackem na JPEG.
- Zkontrolovat, že server posílá správný `Content-Type`.

GoFixWeb v režimu Auto (WooCommerce) nahraje komprimované soubory přes REST API a aktualizuje přílohy. U jiných CMS dostanete PDF s URL a doporučenou velikostí — kompresi provedete sami nebo přes plugin.

### Slider a karousel

Pokud úvodní slider načítá pět obrázků po 800 kB, LCP se pohybuje kolem 4–5 sekund. Model to v reportu popíše, ale změnu musíte udělat v nastavení pluginu:

- Zmenšit počet snímků na tři.
- Zapnout lazy loading pro druhý a třetí snímek.
- Zvážit statický obrázek místo karuselu.

Automatická oprava slideru neexistuje — každý plugin má jinou strukturu a API.

### Třetí strany: analytics, reklama, chat

Pokud stránka načítá Google Analytics, Facebook Pixel, Smartsupp a Sklik konverzní kód, každý skript přidává 50–200 ms k LCP. Model v reportu vypíše domény a velikost, ale rozhodnout, co odložit nebo odstranit, musíte vy:

- Analytics lze načíst asynchronně (`async` nebo `defer`).
- Chat můžete zobrazit až po interakci uživatele.
- Reklamu a tracking zvažte podle ROI — ne každý skript má stejnou hodnotu.

GoFixWeb třetí strany neodstraňuje, protože by to mohlo přerušit měření nebo ztratit konverze.

## Kde jen měříte: field data a reálné připojení

PageSpeed Insights ukazuje dvě sady dat:

- **Lab data** — simulace na rychlém připojení, prázdná cache.
- **Field data** — reálné metriky z Chrome User Experience Report (CrUX), pokud má stránka dostatek návštěv.

Model přečte obě čísla, ale field data odrážejí skutečné uživatele: pomalé mobilní sítě, starší telefony, cache prohlížeče. Pokud lab skóre je 85 a field LCP 3,2 s, problém není v diagnostice — je v tom, že reální uživatelé stahují nekomprimované obrázky nebo čekají na pomalý server.

AI vám řekne, že field data jsou horší. Zlepšení ale přijde až po kompresi, CDN nebo upgradu hostingu — a projeví se v CrUX datech za 28 dní.

## Jak GoFixWeb kombinuje AI diagnostiku a automatickou opravu

1. **Sken** — parser stáhne HTML, obrázky (hlavičky), PageSpeed JSON.
2. **Model** — GPT-4 vyhodnotí priority: komprese, SEO pole, lazy loading, třetí strany.
3. **Auto (WooCommerce)** — přes Application Password nahraje WebP, doplní alt, title, meta description.
4. **Manuál (ostatní CMS)** — PDF s URL, velikostmi, doporučením; implementace na vás.

Model neprovádí změny sám — buď je provede automatický proces (u WooCommerce), nebo dostanete návod. Tím se vyhnete halucinacím („Změnil jsem konfiguraci serveru") a zároveň máte jasný seznam úkolů.

## Co z toho plyne pro váš e-shop

- **AI diagnostika je rychlá a přesná** — model přečte PageSpeed report a HTML za sekundy.
- **Implementace zůstává na serveru** — komprese, slider, třetí strany musí někdo změnit.
- **Auto režim funguje jen u WooCommerce** — ostatní CMS dostanou PDF s postupem.
- **Field data se změní až po nasazení** — lab skóre je okamžité, CrUX data trvají týdny.

Pokud PageSpeed hlásí 2 MB obrázků a LCP 4 sekundy, model vám řekne, které soubory komprimovat. Zrychlení ale přijde až po nahrání WebP a kontrole v prohlížeči.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
