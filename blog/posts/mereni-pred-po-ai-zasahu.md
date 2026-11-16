---
title: Než pustíte AI do šablony, změřte homepage. Potom znovu
description: Bez druhého měření je „optimalizace" jen pocit. Před/po stejnou metodikou ukáže, jestli AI skutečně něco opravila.
date: 2026-11-16
slug: mereni-pred-po-ai-zasahu
---

AI nástroj vám slíbí, že přepíše title, zkomprimuje obrázky nebo doplní meta description. Spustíte ho, šablona vypadá jinak, cítíte, že „něco se stalo". Jenže bez druhého měření nevíte, jestli se PageSpeed zlepšil o tři body, nebo spadl o deset. A bez prvního měření nevíte, odkud jste vůbec vyrazili.

Optimalizace bez čísel je jen dojem. Před/po stejnou metodikou je jediný způsob, jak zjistit, jestli AI skutečně něco opravila, nebo jen přepsala text, který Google stejně ignoroval.

## Proč měřit před zásahem

Před tím, než AI změní cokoliv na homepage, potřebujete vědět:

- Jaké má stránka SEO skóre v PageSpeed Insights (lab data).
- Kolik váží obrázky v síťové záložce prohlížeče (DevTools, Network).
- Jestli má title a H1 unikátní obsah, nebo jsou stejné jako na desítkách dalších URL.
- Kolik indexovaných stránek vidíte přes `site:vasedomena.cz` ve vyhledávání.

Bez těchto čísel nemáte referenční bod. AI může přepsat title z „Domů" na „E-shop s nábytkem – Domů", ale pokud jste neměřili, že původní title byl duplicitní na třiceti URL, nevíte, jestli jste vyřešili problém, nebo jen změnili text na jedné adrese.

Měření před zásahem vám ukáže, co je skutečně rozbité. Pocit „homepage vypadá pomalu" nestačí – LCP 4,2 s ano, LCP 1,8 s ne.

## Co měřit stejnou metodou

Abyste mohli porovnat před a po, musíte měřit stejným nástrojem, ve stejném režimu, na stejné URL:

- **PageSpeed Insights** – lab data (SEO skóre, LCP, CLS), ne field data (ta se mění podle reálných návštěvníků).
- **DevTools, záložka Network** – celková váha stránky, velikost jednotlivých obrázků, počet požadavků.
- **HTML zdroj** – `view-source:` v prohlížeči, kontrola title, meta description, H1, alt textů.
- **Google Search Console** – indexované URL, chyby pokrytí, duplicitní meta description.

Pokud před zásahem změříte PageSpeed v mobilu a po zásahu v desktopu, čísla nejdou porovnat. Pokud před měříte homepage a po měříte kategorii, taky ne. Stejná URL, stejný nástroj, stejný režim.

## Proč druhé měření není samozřejmost

Většina AI nástrojů vám po zásahu ukáže „hotovo", ale nenabídne druhý sken. Vy vidíte nový title v HTML, cítíte, že „něco se změnilo", a předpokládáte zlepšení. Jenže:

- AI mohla přepsat title, ale zapomenout na meta description – SEO skóre zůstane stejné.
- AI mohla zkomprimovat jeden obrázek, ale nezměnit formát – LCP se zlepší o 0,1 s, ne o sekundu.
- AI mohla doplnit alt texty, ale neřešit duplicitní H1 – PageSpeed to neodmění.

Bez druhého měření nevíte, jestli jste opravili to, co PageSpeed penalizoval, nebo jste jen změnili to, co Google stejně ignoroval.

GoFixWeb po každé automatické opravě (Auto režim) nabízí druhý sken – stejná metodika, stejné metriky, porovnání čísel. Pokud SEO skóre nekleslo a LCP se zlepšil, vidíte to v reportu. Pokud ne, taky.

## Jak vypadá před/po bez halucinací

Reálné měření před/po nevypadá jako „SEO 65 → 100". Vypadá takhle:

- **Před**: title „Domů" duplicitní na 12 URL, meta description prázdná, H1 „Vítejte", obrázky 2,1 MB celkem, LCP 3,8 s.
- **Zásah**: AI přepsala title na homepage na „E-shop s nábytkem | Název firmy", doplnila meta description, zmenšila hlavní obrázek z 890 kB na 240 kB (WebP).
- **Po**: title unikátní na homepage (duplicita zůstává na 11 URL), meta description doplněná, H1 beze změny, obrázky 1,4 MB celkem, LCP 2,9 s.

Vidíte, co se opravilo (title na jedné URL, hlavní obrázek) a co ne (duplicita na ostatních, H1, celková váha). To je užitečné měření. „Optimalizováno AI" bez čísel není.

## Co dělat, když druhé měření ukáže, že se nic nezměnilo

Pokud po zásahu AI změříte PageSpeed a SEO skóre zůstalo stejné, máte tři možnosti:

1. **Zkontrolovat, co AI skutečně změnila** – `view-source:` v prohlížeči, porovnat s původním HTML. Možná AI přepsala text, který PageSpeed neměří (např. popisek pod produktem místo title).
2. **Změřit jinou metriku** – PageSpeed SEO skóre neřeší rychlost. Pokud AI komprimovala obrázky, podívejte se na LCP, ne na SEO číslo.
3. **Opravit ručně to, co AI nezvládla** – duplicitní title na desítkách URL, prázdné kategorie, indexované filtry. To AI nástroj typicky neřeší, protože vyžaduje zásah do šablony nebo hromadnou úpravu.

Druhé měření vám neřekne, že jste selhali. Řekne vám, co ještě zbývá opravit a jestli má smysl platit AI nástroj za další kolo.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
