---
title: 'AI nástroje slibují opravu webu. GoFixWeb sahá jen tam, kam smí'
description: 'Obecné AI pluginy nabízejí přepis celého obsahu. GoFixWeb zapisuje jen do SEO polí, komprese a doporučených pluginů – zbytek zůstává nedotčený.'
date: '2026-09-21'
display_date: '21. září 2026'
lang: 'cs'
tags:
  - AI
  - Opravy
---

Na trhu existuje řada AI nástrojů, které slibují „automatickou optimalizaci webu". Některé nabízejí přepis produktových popisů, jiné generují meta tagy nebo mění strukturu stránek. Problém nastává ve chvíli, kdy si majitel e-shopu uvědomí, že nástroj změnil text, který neměl, nebo přepsal pečlivě vyladěný popis kategorie.

GoFixWeb funguje jinak. Zapisuje pouze do míst, která jsou technicky oddělená od viditelného obsahu – SEO pole (title, meta description), nastavení komprese obrázků a doporučené pluginy. Zbytek webu zůstává nedotčený.

## Co znamená „omezený zápis"

Omezený zápis znamená, že nástroj nemá přístup k textům produktů, popisům kategorií ani HTML šablonám. Zapisuje pouze do databázových polí, která jsou určená pro SEO metadata, nebo do nastavení pluginů, které řídí kompresi a cache.

Konkrétně:

- **SEO pole**: title tag, meta description, Open Graph tagy – pole, která vyplňujete v pluginech jako Yoast nebo Rank Math.
- **Komprese obrázků**: nastavení kvality, formátu (WebP), automatické škálování – parametry pluginů jako ShortPixel nebo Imagify.
- **Doporučené pluginy**: seznam nástrojů, které GoFixWeb navrhne nainstalovat (cache, lazy loading, minifikace) – vy rozhodnete, zda je aktivujete.

Žádný z těchto kroků nezmění text na stránce, který vidí zákazník. Pokud máte v popisu produktu větu „Ručně vyráběné v Česku", zůstane tam i po skenu.

## Proč obecné AI pluginy sahají dál

Mnoho AI nástrojů pracuje s celým obsahem webu. Nabízejí přepis produktových popisů, generování blogových článků nebo automatické doplnění chybějících textů. To může být užitečné, pokud máte prázdný e-shop nebo chcete rychle vytvořit stovky variant.

Problém nastává, když nástroj:

- Přepíše popis, který jste ladili měsíce.
- Změní tón komunikace (z osobního na korporátní).
- Vygeneruje text, který neodpovídá realitě produktu (halucinace).
- Zasáhne do HTML šablony a rozbije layout.

Tyto nástroje často vyžadují plný přístup k databázi nebo FTP. Majitel e-shopu pak nemá jistotu, co přesně se změnilo, a vrátit změny bývá složité.

## Jak GoFixWeb omezuje riziko

GoFixWeb používá Application Password – autorizační metodu, kterou nabízí WordPress od verze 5.6. Tento přístup umožňuje číst veřejná data (URL, HTML, obrázky) a zapisovat pouze do SEO polí a nastavení pluginů. Nemá přístup k:

- Textům produktů a kategorií (pokud nejsou v SEO poli).
- HTML šablonám a CSS.
- Uživatelským účtům a objednávkám.
- FTP nebo databázi mimo WordPress API.

Pokud provozujete e-shop na jiné platformě než WooCommerce (Shoptet, Upgates, vlastní řešení), GoFixWeb nabízí režim Manuál – sken z veřejných dat, PDF report s doporučeními, žádný zápis.

## Co to znamená pro váš e-shop

Když GoFixWeb najde chybějící meta description, doplní ji do SEO pole. Když zjistí, že obrázky nejsou komprimované, navrhne nastavení pluginu. Když odhalí duplicitní title tagy, upozorní vás v reportu.

Nezasáhne do:

- Textu, který jste napsali vy nebo copywriter.
- Struktury kategorií a tagů.
- Designu a layoutu.
- Funkčnosti košíku a platební brány.

Tento přístup má dvě výhody:

1. **Nízké riziko**: změny jsou reverzibilní, protože se týkají pouze metadat a nastavení.
2. **Transparentnost**: víte přesně, co se změnilo – SEO pole, komprese, doporučené pluginy.

Nevýhoda: pokud potřebujete přepsat stovky produktových popisů, GoFixWeb to neudělá. Na to existují jiné nástroje – nebo copywriter.

## Kdy omezený zápis stačí a kdy ne

Omezený zápis stačí, pokud:

- Máte napsané texty, ale chybí vám SEO metadata.
- Obrázky jsou nahrané, ale nekomprimované.
- Web je pomalý kvůli chybějící cache nebo minifikaci.
- Chcete rychlou kontrolu bez rizika, že se změní obsah.

Omezený zápis nestačí, pokud:

- Produkty nemají popis vůbec (prázdná pole).
- Potřebujete hromadný přepis textů (např. z angličtiny do češtiny).
- Chcete změnit strukturu webu (přidat kategorie, sloučit tagy).
- Řešíte technické problémy mimo WordPress (server, DNS, CDN).

V těchto případech potřebujete buď manuální práci, nebo nástroj s širším zápisem – a s tím spojené riziko.

## Proč GoFixWeb nerozšiřuje zápis

Mohli bychom nabídnout přepis produktových popisů, automatické generování blogů nebo úpravu HTML. Neděláme to ze tří důvodů:

1. **Riziko halucinace**: AI může vygenerovat text, který neodpovídá realitě produktu (špatné parametry, nepravdivé tvrzení).
2. **Ztráta kontroly**: majitel e-shopu neví, co přesně se změnilo, a vrátit stovky přepsaných textů je náročné.
3. **Hranice produktu**: GoFixWeb je nástroj na technické SEO a rychlost, ne copywriting.

Pokud potřebujete přepsat texty, doporučujeme najít copywritera nebo použít AI nástroj s lidskou kontrolou každého výstupu. GoFixWeb vám pak doplní metadata a zkomprimuje obrázky – bez rizika, že změní to, co jste schválili.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
