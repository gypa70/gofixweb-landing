---
title: Proč je rychlost e-shopu důležitá pro tržby
description: Rychlost není jen skóre v PageSpeed. Ovlivňuje bounce, konverzi a to, jak Google stránku vyhodnotí. Co měřit a co z lab testu nečíst.
date: 2026-08-20
slug: proc-je-rychlost-eshopu-dulezita-pro-trzby
---

Pomalý e-shop neodradí jen „netrpělivé“ zákazníky. Prohlížeč na mobilu v MHD stahuje megahero, než ukáže cenu. Část lidí odejde dřív, než se stihne přidat zboží do košíku. To je tržba, ne estetika.

## Co rychlost reálně mění

Tři kanály, kde se zpoždění projeví:

- **Odchod ze stránky.** Když LCP (Largest Contentful Paint) padá k několika sekundám, část návštěv homepage skončí bez dalšího kliknutí. Nemusíte mít přesné A/B — stačí srovnat bounce homepage vs. rychlejší landing.
- **Konverze.** Checkout a produktová galerie jsou citlivé na INP (Interaction to Next Paint). Klik na „koupit“, který reaguje se zpožděním, vypadá jako rozbitý web.
- **Viditelnost ve vyhledávání.** Google používá Core Web Vitals jako jedno z mnoha signálů. Slabé LCP vás samo o sobě z první stránky nesestřelí, ale při srovnatelné relevanci to není výhoda.

## PageSpeed Insights: k čemu je a k čemu ne

[PageSpeed Insights](https://pagespeed.web.dev/) umí dvě věci: **lab data** (simulace) a pokud je vzorek, **field data** z Chrome UX Reportu.

Lab skóre 0–100 je praktický diagnostický nástroj. Ukazuje, které požadavky blokují vykreslení, jestli jsou obrázky zbytečně velké, jestli CSS nebo JS drží LCP. Není to rating agentury a není to záruka tržeb.

Field data (LCP, INP, CLS u reálných uživatelů) jsou bližší tomu, co zažívají zákazníci. Když lab svítí zeleně a field červeně, řešte hosting, třetí strany (chat, pixel, A/B nástroje) a mobilní síť — ne další minifikaci komentářů v šabloně.

## Co obvykle e-shop brzdí

Na WooCommerce i jinde se opakuje stejný seznam: nekomprimované fotky, slider na homepage, desítky pluginů, webfonty, tag manager s pěti kontejnery. Optimalizace title na to nemá vliv. Komprese obrázků a méně práce na prvním vykreslení ano.

CLS (poskakující layout) často způsobí banner souhlasu s cookies nebo pozdě nahraná cena. To je důvěra, ne jen „SEO bod“.

## Jak začít, aniž byste předělávali šablonu

1. Změřte homepage a jednu produktovou stránku v PageSpeed (mobil).
2. Zapište LCP a odhadované kB obrázků.
3. Stejné dvě URL změřte znovu po úpravě fotek — uvidíte, jestli šlo o obrázky, nebo o JavaScript.

Když chcete nálezy včetně on-page SEO v jednom PDF, je na to [bezplatný report](/#signup-form). Samotná rychlost bez srozumitelných title a popisů vás ve vyhledávání taky neudrží — ale pomalý web s dokonalým title pořád ztrácí lidi, kteří už na webu jsou.
