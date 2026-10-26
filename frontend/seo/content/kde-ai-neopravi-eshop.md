---
title: 'Kam AI ani automatická oprava sahat nesmí: platby, košík, doprava'
description: 'Proč GoFixWeb neřeší checkout skriptem a kde končí hranice bezpečného zápisu do e-shopu.'
date: '2026-10-26'
display_date: '26. října 2026'
lang: 'cs'
tags:
  - AI
  - Bezpečnost
---

Automatická oprava e-shopu zní lákavě. Skript se přihlásí, opraví title, zkomprimuje obrázky, změní nastavení pluginu. Ušetříte čas, vyhnete se chybám. Ale existuje hranice, za kterou žádný skript sahat nesmí — a to je cesta od košíku k platbě.

GoFixWeb neřeší checkout automaticky. Nezasahuje do nastavení dopravy, platebních bran, daňových pravidel ani podmínek objednávky. Není to nedostatek funkce. Je to záměr.

## Proč je checkout jiný než SEO pole

Když skript přepíše title nebo H1, nejhorší scénář je špatný text. Zákazník si všimne, opravíte to, žádné peníze se neztratí.

Když skript změní nastavení platební brány, může se stát, že:

- objednávka projde, ale peníze nepřijdou
- zákazník zaplatí dvakrát
- daň se vypočítá špatně
- doprava se nezobrazí pro konkrétní zemi
- objednávka skončí ve stavu „čeká na platbu" natrvalo

To nejsou hypotézy. Každá platební brána má desítky nastavení. Callback URL, webhook tajemství, testovací vs. produkční režim, měna, zaokrouhlení, povolené metody podle země. Stačí jeden překlep a objednávka selže — nebo projde, ale vy o ní nevíte.

## Co se může pokazit při automatickém zápisu do checkoutu

**Platební brána:** Každá brána (GoPay, Stripe, PayPal, Comgate) má vlastní API, vlastní pole, vlastní logiku. Skript nemůže vědět, jestli máte testovací klíč nebo produkční. Nemůže ověřit, jestli webhook funguje. Nemůže zkontrolovat, jestli callback URL sedí s vaší doménou.

**Doprava:** Pokud máte Zásilkovnu, PPL, DPD a vlastní rozvoz, každá metoda má jiné podmínky. Hmotnost, rozměry, země, cena podle zóny. Automatický zápis může přepsat pravidlo, které jste ručně ladili měsíc.

**Daně a účetnictví:** WooCommerce umí DPH, osvobození, reverse charge, digitální služby. Pokud skript změní sazbu nebo zapne/vypne daň pro konkrétní kategorii, účetní vám to najde až při uzávěrce.

**Stavy objednávek:** „Čeká na platbu", „Zpracovává se", „Dokončeno", „Zrušeno". Každý stav spouští e-mail, mění sklad, zapisuje do účetnictví. Automatický přepis může rozbít celý workflow.

## Kde končí hranice bezpečného zápisu

GoFixWeb zapisuje do polí, která nemění obchodní logiku:

- SEO pole (title, description, H1) — špatný text je vidět, opravíte ho
- komprese obrázků — soubor se zmenší, kvalita zůstane, nic se nerozbije
- doporučené pluginy (Yoast, WebP, cache) — instalace, ne konfigurace
- základní nastavení WooCommerce (indexace, permalink) — jen to, co nemění checkout

Nezapisuje do:

- platebních bran (API klíče, callback, webhook)
- dopravních metod (cena, podmínky, zóny)
- daňových pravidel (sazby, země, kategorie)
- stavů objednávek (workflow, e-maily, sklad)
- košíku (cross-sell, upsell, kupóny)

Proč? Protože každý e-shop má jinou kombinaci bran, dopravců, daňových režimů. Neexistuje univerzální „správné" nastavení. A riziko chyby je příliš vysoké.

## Co dělat, když checkout potřebuje opravu

Pokud PageSpeed hlásí pomalý skript na stránce košíku, nebo platební brána vrací chybu, řešení není automatické.

**Manuální kontrola:** Otevřete prohlížeč, jděte do Nástroje pro vývojáře (F12), záložka Network. Projděte košík až po potvrzení objednávky. Hledejte červené řádky (chyby), pomalé požadavky (nad 1 s), duplicitní volání.

**Testovací objednávka:** Vytvořte testovací produkt za 1 Kč, projděte celý checkout. Zkontrolujte, jestli přišel e-mail, jestli se objednávka zobrazila v administraci, jestli se stav změnil po zaplacení.

**Dokumentace brány:** Každá platební brána má manuál. Najdete tam, jak nastavit webhook, jak ověřit callback, jak testovat v sandboxu. Pokud brána vrací chybu, je tam kód (např. „invalid signature") — hledejte ho v dokumentaci.

**Plugin vs. vlastní kód:** Pokud používáte oficiální plugin brány (např. WooCommerce Payments, GoPay), aktualizujte ho. Pokud máte vlastní integraci, najměte vývojáře. Automatický skript to nevyřeší.

## Proč to říkáme nahlas

Existují nástroje, které slibují „kompletní optimalizaci e-shopu jedním kliknutím". Zní to dobře. Ale pokud vám nikdo neřekne, co skript *neudělá*, riskujete víc, než získáte.

GoFixWeb má jasnou hranici: opravuje to, co lze opravit bez rizika ztráty objednávky. SEO, obrázky, doporučené pluginy. Checkout ne.

Není to omezení technologie. Je to rozhodnutí. Protože automatický zápis do platební brány může ušetřit deset minut — a stát vás tisíce korun v propadlých objednávkách.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
