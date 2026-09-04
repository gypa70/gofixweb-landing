---
title: '5 nejčastějších SEO chyb, které zpomalují váš WooCommerce e-shop'
description: 'Pět chyb, které na ostrých WooCommerce e-shopech vídáme nejčastěji. Žádná z nich nevyžaduje agenturu — jdou poznat z prohlížeče.'
date: '2026-08-27'
display_date: '27. srpna 2026'
lang: 'cs'
tags:
  - WooCommerce
  - SEO
  - Checklist
---

WooCommerce umí pro SEO hodně. Šablona, page builder a pět pluginů „na optimalizaci“ umí z toho hodně vzít. Níže je pět chyb, které na ostrých e-shopech vídáme nejčastěji. Žádná z nich nevyžaduje agenturu — jdou poznat z prohlížeče.

## 1. Stejný nebo prázdný title na klíčových stránkách

Title je pořád první věc, kterou Google v SERPu ukáže (když ho nepřepíše). Na WooCommerce se stává, že homepage, kategorie i produkt zdědí obecný název webu, nebo že plugin title vůbec nevyplní.

**Jak ověřit:** otevřete homepage, kategorii a jeden produkt → zobrazení zdroje → hledejte `<title>`. Tři různé URL, tři různé title. Pokud jsou stejné, Google nemá podle čeho stránky rozlišit.

## 2. Chybějící H1, nebo pět H1 na jedné stránce

H1 má říct, o čem stránka je. Šablony občas H1 schovají do loga, page builder ho dá na každý blok. Výsledek: buď žádný hlavní nadpis, nebo chaos.

**Jak ověřit:** ve zdroji stránky spočítejte `<h1>`. Cíl je jeden srozumitelný H1 na URL. H2 a H3 klidně víc — ale hierarchicky.

## 3. Obrázky jako hlavní brzda, ne „SEO plugin“

Lidé hledají problém v Yoastu, zatímco hrdinský slider tahá 1,5 MB JPEG. Vyhledávač i zákazník čekají na stažení. Komprese a rozumné rozměry (ne 4000 px na mobilní dlaždici) udělají víc než další metabox.

**Jak ověřit:** Chrome DevTools → Network → Img. Sečtěte velikost. Nad stovky kB na úvodní pohled už stojí za práci. [PageSpeed Insights](https://pagespeed.web.dev/) ukáže LCP a „image delivery“.

## 4. Tenké nebo duplicitní kategorie

WooCommerce vygeneruje URL pro každou kategorii a značku. Když je popis prázdný a title padá na „Kategorie: Trička“, máte desítky slabých stránek. Filtrování barvy a velikosti to může znásobit.

**Jak ověřit:** v Search Console (pokud ji máte) se podívejte na indexované kategorie. I bez ní: otevřete tři kategorie a přečtěte title + první odstavec. Když je text nula nebo copy-paste, není co hodnotit.

## 5. Indexace filtrů, košíku a parametry `?orderby=`

Facetované navigace (`?filter_color=`, řazení, relace) umí vyrobit tisíce URL s téměř stejným obsahem. Košík a účet do indexu nepatří.

**Jak ověřit:** v Google zadejte `site:vas-eshop.cz inurl:orderby` nebo `inurl:filter`. Když padají desítky výsledků, máte práci pro robots, canonical nebo noindex — ne pro další článek na blog.

## Co s tím dál

Pořadí oprav: nejdřív to, co vidí každý (title, H1, obrázky), pak indexace parametrů. Plugin „SEO all in one“ nic z toho neudělá, dokud nejsou vyplněná pole a srozumitelná pravidla.

Když chcete seznam nálezů na jednom místě, [bezplatný report](/#analyza) čte veřejné HTML a PageSpeed. Na WooCommerce umíme část on-page věcí a kompresi obrázků i [automaticky](/#faq). Na ostatních platformách zůstává PDF návod.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).