---
title: Chatbot vám poradí plugin. Sken vám řekne, co je na URL rozbité
description: Konverzace s modelem dává obecnou radu. Sken HTML a PageSpeed ukazuje konkrétní čísla. Proč rada bez měření špatně sedí.
date: 2026-10-19
slug: chatbot-vs-technicky-sken
---

Zeptáte se chatbota, jak zrychlit e-shop, a dostanete seznam pluginů. Zeptáte se, jak opravit SEO, a model vám popíše best practice. Odpověď vypadá užitečně, ale chybí jí jedno: data z vašeho webu.

Konverzační model nemá přístup k vašemu HTML, nevidí váhu obrázků, nezná skutečný LCP ani počet indexovaných URL. Radí na základě obecných vzorců, ne konkrétního stavu. Sken naopak stáhne veřejné HTML, změří PageSpeed, spočítá duplicity a ukáže přesně, kde je problém.

## Chatbot radí podle vzorců, ne podle vašich dat

Když se zeptáte „Jak zrychlit WooCommerce e-shop?", model vám nabídne:

- plugin na lazy loading obrázků
- caching plugin
- CDN
- minifikaci CSS a JS

Všechny rady jsou správné — obecně. Model ale neví, jestli máte obrázky 2,5 MB nebo 150 kB, jestli už máte cache zapnutou, ani jestli je váš LCP 1,2 s nebo 4,8 s.

Sken stáhne HTML, změří skutečnou váhu obrázků, spustí PageSpeed Insights a ukáže konkrétní čísla. Teprve pak víte, jestli je problém v obrázcích, nebo jinde.

## Sken vidí veřejné HTML a PageSpeed — nic víc, nic míň

GoFixWeb sken pracuje s tím, co je veřejně dostupné:

- HTML každé URL (title, H1, meta description, struktura)
- PageSpeed Insights (LCP, CLS, TBT, lab i field data)
- váha obrázků a jejich formát
- duplicity title a H1 napříč URL
- indexace v Google (site: vyhledávání)

Nevidí administraci, neví, jaké pluginy máte nainstalované, nemá přístup k databázi. Měří to, co vidí návštěvník a robot Googlu.

Chatbot naopak nevidí nic z toho. Radí podle toho, co se osvědčilo obecně, ne podle toho, co konkrétně brzdí váš web.

## Proč rada bez měření špatně sedí

Představte si, že máte e-shop s 300 produkty. Chatbot vám poradí:

„Optimalizujte meta description pro každou stránku."

Sken vám ukáže:

- 87 URL má stejný title „E-shop – Název webu"
- 142 URL nemá meta description vůbec
- 23 produktových URL má H1 shodný s title
- průměrná váha obrázků na produktové stránce je 1,8 MB

Teď víte přesně, kde začít. Neřešíte meta description, dokud neopravíte duplicitní title. Neřešíte lazy loading, dokud nesníží váhu obrázků.

Rada bez měření je jako recept bez ingrediencí. Může být správný, ale nevíte, jestli sedí na váš případ.

## Co dělat, když chatbot poradí plugin

Pokud vám model doporučí konkrétní plugin, ověřte si:

1. **Změřte stav před instalací.** PageSpeed Insights, váha HTML, počet HTTP požadavků.
2. **Nainstalujte plugin a změřte znovu.** Pokud se LCP nezměnil, plugin problém neřeší.
3. **Zkontrolujte konflikt.** Dva caching pluginy nebo dva lazy-loading pluginy často brzdí víc, než pomáhají.

GoFixWeb Auto režim pluginy neinstaluje. Doporučí je v PDF reportu, pokud sken ukáže, že by pomohly (například chybějící komprese nebo lazy loading). Instalaci a nastavení necháváme na vás nebo na manuálním režimu.

Důvod je prostý: plugin může změnit chování webu, ovlivnit checkout nebo kolidovat s jiným rozšířením. Auto režim sahá jen tam, kam smí — SEO pole, komprese obrázků, doporučené pluginy v reportu.

## Kdy je konverzace užitečná a kdy ne

Chatbot má své místo:

- **Vysvětlení pojmu.** Co je LCP, jak funguje lazy loading, co dělá Application Password.
- **Obecná strategie.** Jak strukturovat kategorie, jak psát produktové popisy, jak nastavit breadcrumbs.
- **Brainstorming.** Nápady na dlouhé title, varianty H1, návrhy alt textů.

Chatbot nemá místo tam, kde potřebujete konkrétní čísla:

- Kolik URL má duplicitní title?
- Jaká je průměrná váha obrázků na produktových stránkách?
- Kolik URL je indexovaných, ale nemá meta description?
- Jaký je skutečný LCP na mobilech?

Na tyto otázky odpovídá sken, ne konverzace.

## Sken jako základ, rada jako doplněk

GoFixWeb kombinuje obojí:

1. **Sken změří** veřejné HTML, PageSpeed, duplicity, váhu obrázků.
2. **AI vyhodnotí** naměřená data a navrhne konkrétní opravy.
3. **Auto režim opraví** to, co smí (WooCommerce SEO pole, komprese obrázků přes Application Password).
4. **PDF report doporučí** zbytek (pluginy, strukturální změny, manuální úpravy).

Rada bez měření je hádání. Měření bez rady je tabulka čísel. Dohromady dostanete konkrétní plán, co opravit jako první.

Pokud vám chatbot poradí plugin, nejdřív změřte, jestli problém, který má řešit, vůbec máte. Pokud ano, nainstalujte ho a změřte znovu. Pokud ne, ušetříte čas i riziko konfliktu.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
