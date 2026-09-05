import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs = [
  {
    q: 'Kolik stojí první analýza?',
    a: 'Nic. Sken i PDF report s vyčíslenou ztrátou jsou zdarma a bez platební karty. Platíte teprve tehdy, když se rozhodnete chyby skutečně opravit — jednorázově 1 990 Kč, ať zvolíte variantu Auto, nebo Manuál. V tu chvíli už víte, kolik vám oprava má vrátit.',
  },
  {
    q: 'Potřebujete přístup do mé administrace?',
    a: 'Pro analýzu ne — sken probíhá zvenčí přes veřejně dostupná data a Google PageSpeed API, takže nám stačí adresa e-shopu. U varianty Auto pro WooCommerce nasazujeme opravu přes WordPress Application Password, což je oddělené heslo pro jednu aplikaci, které kdykoli zrušíte. U varianty Manuál nepotřebujeme žádný přístup, dostanete PDF návod.',
  },
  {
    q: 'Musím platit něco měsíčně?',
    a: 'Ne. Základní nabídka je jednorázová oprava za 1 990 Kč a tím to pro vás může skončit. Pravidelný sken v předplatném je volitelný doplněk pro ty, kdo chtějí odhalit nové chyby po každé aktualizaci — zrušíte ho kdykoli, bez výpovědní lhůty a bez sankcí.',
  },
  {
    q: 'Proč stojí oprava 1 990 Kč?',
    a: 'Protože tu cenu nemáte porovnávat s ničím jiným než s vyčíslenou ztrátou ve svém reportu. Tu vidíte ještě před platbou, takže nekupujete naslepo. Rozdíl je v tom, že oprava se platí jednou, kdežto ztráta se opakuje každý měsíc, dokud chyba trvá — čím dřív ji odstraníte, tím méně měsíců zaplatíte navíc. A pokud je ve vašem případě vyčíslená ztráta nižší než cena opravy, report si nechte a neplaťte nic.',
  },
  {
    q: 'Nerozbijete mi e-shop, když do něj zasáhnete?',
    a: 'Každou opravu nejprve nasazujeme mimo produkci nebo v odděleném kroku a máme zálohu stavu před zásahem. Pokud se cokoli zachová jinak, než mělo, vracíme původní stav.',
  },
  {
    q: 'Jak počítáte ztrátu v korunách?',
    a: 'Vycházíme z vašeho obratu, konverzního poměru a měřené doby načtení. Každou nalezenou chybu přiřadíme k dopadu na konverzi podle publikovaných korelací a v reportu vždy uvedeme metodiku, ať si výpočet můžete ověřit.',
  },
  {
    q: 'Jak poznám, která chyba mi bere nejvíc peněz?',
    a: 'Nemusíte to poznávat sami. Nálezy v reportu jsou seřazené podle vyčíslené ztráty v korunách — ne abecedně, ne podle technické závažnosti a ne v pořadí, v jakém je měření našlo. První položka v seznamu je tedy ta nejdražší a u každé další vidíte její vlastní částku za měsíc. Když nechcete řešit všechno, začnete odshora a víte, kolik tím získáte.',
  },
  {
    q: 'Který e-shopový systém podporujete?',
    a: 'Shoptet, Shopify, WooCommerce, Magento a další běžné platformy. Analýza funguje na jakémkoli webu, protože měříme výsledek v prohlížeči, ne konkrétní administraci.',
  },
  {
    q: 'Jak dlouho trvá, než uvidím výsledek?',
    a: 'Report dostanete do hodiny. U tarifů s opravami nasazujeme první prioritní opravy typicky do 24 hodin od aktivace a následně provedeme kontrolní měření stejnou metodikou.',
  },
  {
    q: 'Nemám teď čas se tomu věnovat, co s tím?',
    a: 'Stačí odpovědět na e-mail s reportem a napsat termín, který vám vyhovuje — třeba za dva týdny nebo po sezóně. Ozveme se přesně tehdy a do té doby vám nic neposíláme. Report nikam nemizí a nic se neaktivuje ani neúčtuje, dokud sami neřeknete. Jen počítejte s tím, že čísla popisují stav v okamžiku skenu; pokud bude pauza delší, změříme e-shop znovu, ať pracujete s aktuálními hodnotami.',
  },
  {
    q: 'Vystavujete fakturu?',
    a: 'Ano, na každou platbu vystavíme řádný doklad. Fakturujeme na firmu i na IČO. Ceny v ceníku jsou konečné — nic dalšího se k nim nepřipočítává. Nejsme plátci DPH.',
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="section-line py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Časté dotazy</span>
            <h2 className="mt-4">FAQ</h2>
            <p className="mt-5 text-muted-foreground">
              Nenašli jste odpověď? Napište na{' '}
              <a
                href="mailto:info@gofixweb.com"
                className="font-semibold text-primary underline decoration-primary/40 underline-offset-4"
              >
                info@gofixweb.com
              </a>{' '}
              — odpovídáme do jednoho pracovního dne.
            </p>
          </div>

          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.q} value={`item-${index}`} className="border-border">
                  <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}