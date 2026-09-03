---
title: Jak zkontrolovat, jestli má váš e-shop problém s SEO, za 5 minut
description: Pětiminutový postup bez agentury: title, H1, PageSpeed, obrázky a indexace. Stačí prohlížeč a veřejné HTML.
date: 2026-08-13
slug: jak-zkontrolovat-seo-eshopu-za-5-minut
---

Nemusíte čekat na audit, abyste věděli, jestli má e-shop základní on-page problém. Následující kroky jdou zvládnout z prohlížeče. Nic z toho nevyžaduje přístup do administrace.

## Minuta 1–2: title a description

Otevřete homepage. Pravý klik → zobrazit zdroj. Najděte `<title>` a `meta name="description"`.

- Title by měl jít přečíst nahlas a lišit se od názvu firmy samotného („E-shop | Firma“ na každé URL nestačí).
- Description může Google přepsat, ale prázdný nebo identický na homepage i kategorii je signál, že šablona pole neplní.

Opakujte na **jedné kategorii** a **jednom produktu**. Tři URL, tři title. Když jsou stejné, máte první nález.

## Minuta 3: jeden H1

Ve stejném zdroji spočítejte `<h1>`. Cíl je jeden. Nula znamená, že šablona nadpis schovala. Pět H1 znamená, že page builder označuje za hlavní nadpis skoro všechno.

Na produktu by H1 měl odpovídat názvu zboží, ne sloganu homepage.

## Minuta 4: PageSpeed na mobilu

Otevřete [PageSpeed Insights](https://pagespeed.web.dev/), zadejte homepage, počkejte na výsledek **v mobilu**.

Zapište si:

- skóre výkonu (orientačně),
- LCP,
- jestli report hlásí velké obrázky nebo render-blocking.

Jedno číslo 100 nehledejte. Hledejte, jestli LCP drží vteřiny kvůli 2MB fotce. To je akční položka na dnešek, ne „přebudovat SEO strategii“.

## Minuta 5: obrázky a podivné URL ve vyhledávání

V DevTools → Network → Img sečtěte stažené bajty na homepage. Potom v Google: `site:vasadomena.cz`. Když na první straně vidíte košík, `?orderby=` nebo desítky téměř stejných filtrů, řešíte indexaci, ne chybějící blogpost.

## Co s výsledkem

Máte-li tři stejné title, chybějící H1 a LCP na těžké fotce, nepotřebujete další workshop. Potřebujete doplnit pole v šabloně/pluginu a zmenšit obrázky.

Když chcete stejnou kontrolu v jednom dokumentu (včetně vyčíslení, co z nálezů plyne), [bezplatný report](/#signup-form) běží na veřejných datech. Opravy pak buď podle [PDF návodu](/#faq) (jakýkoliv CMS), nebo u WooCommerce automaticky.
