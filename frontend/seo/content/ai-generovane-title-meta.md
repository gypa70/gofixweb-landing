---
title: 'AI umí napsat title. Nestojí to za nic, když je na stu URL stejný'
description: 'Hromadné šablony z chatu vypadají dobře v tabulce. V prohlížeči poznáte, že AI jen přepsala slogan firmy a zkopírovala ho na všechny stránky.'
date: '2026-10-12'
display_date: '12. října 2026'
lang: 'cs'
tags:
  - AI
  - SEO
---

Zadáte do ChatGPT seznam URL, požádáte o title a meta description pro každou stránku. Za minutu máte tabulku se sto řádky. Vypadá to profesionálně. Pak to nahrajete do e-shopu a Google Search Console vám za týden ukáže, že osmdesát stránek má stejný title s drobnými obměnami.

AI dokáže napsat text rychle. Nedokáže poznat, že váš e-shop má dvacet kategorií, které se liší jen jedním slovem, a že každá potřebuje vlastní úhel. Šablona „Nakupujte [kategorie] s dopravou zdarma" funguje jednou. Když ji použijete na všechny kategorie, máte problém.

## Hromadná šablona vypadá dobře v tabulce, ne v prohlížeči

Když si otevřete CSV se sto řádky title tagů, vidíte variace. „Dámské boty – kvalita a styl", „Pánské boty – kvalita a styl", „Dětské boty – kvalita a styl". V tabulce to vypadá, že každá stránka má vlastní text.

Pak si otevřete tři karty v prohlížeči. Všechny tři title začínají stejně, liší se jen jedním slovem. Google to vidí stejně jako vy. Search Console vám ukáže varování „Duplicitní title tagy" a seznam URL, které mají téměř totožný text.

AI šablona nepozná, že dámské boty prodáváte hlavně na svatby, pánské do práce a dětské do školy. Neví, že každá kategorie má jiné dotazy, jiné zákazníky, jiný důvod ke koupi. Vidí jen sloupec „kategorie" a doplní ho do vzorce.

## Jak poznat, že AI jen přepsala slogan firmy

Otevřete si pět stránek svého e-shopu v kartách prohlížeče. Podívejte se na title v záložce. Pokud všechny obsahují stejnou frázi („s láskou k detailu", „pro váš domov", „kvalita za férovou cenu"), AI použila váš slogan jako kostru a jen vyměnila jedno slovo.

To samé platí pro meta description. Když všechny popisy začínají „Objevte naši nabídku" nebo „Nakupujte s jistotou", máte šablonu. Není to nutně špatně napsané. Je to jen nepoužitelné, protože Google uvidí sto variant téhož textu.

Další signál: title má správnou délku, ale neříká nic konkrétního. „Dámské boty – široký výběr a skvělé ceny" sedí na jakýkoliv e-shop. Nezmiňuje značky, které prodáváte, ani typ bot, které máte skladem. AI nedokáže vědět, že vaše kategorie dámských bot má hlavně lodičky a sandály, ne tenisky.

## Pole po stránkách vs. hromadný export do chatu

GoFixWeb kontroluje title a description přímo v HTML každé stránky. Neexportuje seznam URL do tabulky. Prohlížeč stáhne stránku, přečte `<title>` a `<meta name="description">`, porovná je s obsahem H1 a textu. Vidí, jestli je title stejný jako na jiné URL.

Když AI nástroj pracuje s exportem, nevidí kontext. Neví, že máte na dvou kategoriích stejný title, protože v tabulce jsou na různých řádcích. Neví, že title je delší než 60 znaků, protože v Excelu se vejde celý. Neví, že description chybí, protože buňka není prázdná – obsahuje text z jiného pole.

Kontrola po stránkách znamená, že nástroj otevře URL, přečte HTML a porovná ho s pravidly. Stejně jako to děláte ručně v prohlížeči, jen automaticky. Vidí duplicity, vidí délku, vidí chybějící pole.

## Co s tím dělat, když už máte sto šablonovitých title

Pokud jste hromadně nahrál AI texty a teперь vidíte duplicity v Search Console, máte dvě možnosti. Buď projdete stránky ručně a přepíšete title tam, kde je to potřeba. Nebo necháte nástroj, který umí pracovat s WooCommerce poli, zapsat nový text přímo do databáze.

GoFixWeb v režimu Auto umí zapsat title a description do SEO pluginu (Yoast, Rank Math, SEOPress). Nešahá na obsah stránky, mění jen metadata v polích, která plugin vytváří. Text generuje z názvu produktu, kategorie a atributů, které už máte v e-shopu. Nepoužívá šablonu „kvalita a styl", protože ví, že ji máte na padesáti stránkách.

Pokud máte jiný CMS než WooCommerce, Auto režim nefunguje. Dostanete PDF s doporučeními a musíte změny udělat ručně nebo přes svého dodavatele. To není omezení AI, to je omezení přístupu – nástroj nemá Application Password do vašeho Shopify nebo vlastního řešení.

## Proč nestačí „vylepšit prompt"

Občas se objeví rada: „Dejte AI lepší instrukce, bude to fungovat." Problém není v kvalitě promptu. Problém je v tom, že AI nemá přístup k datům, která potřebuje.

Když zadáte „napiš unikátní title pro každou kategorii", AI vymyslí variace. Nevymyslí title, který odráží, že v kategorii „Dámské boty" máte dvacet lodičiek a tři páry tenisek. Neví, že kategorie „Pánské boty" má hlavně polobotky do práce. Neví, že „Dětské boty" prodáváte hlavně na podzim, protože rodiče kupují do školy.

Tyto informace máte v e-shopu. Jsou v počtu produktů, v atributech, v prodejích. AI v chatu je nevidí. Vidí jen text, který jste zkopírovali do promptu. Proto vám dá šablonu, která vypadá rozumně, ale neodráží realitu vašeho skladu.

Nástroj, který čte HTML a databázi e-shopu, má k těmto datům přístup. Nemusí hádat, kolik produktů je v kategorii. Přečte si to. Nemusí vymýšlet, jaké atributy produkt má. Vidí je v polích.

Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report do 10 minut](/#analyza) — nebo se podívejte na [FAQ](/#faq) a [ceník](/#ceny).
