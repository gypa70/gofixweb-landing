import { ListOrdered, Coins, ArrowLeftRight, FileDown } from 'lucide-react';

const reportContents = [
  {
    icon: ListOrdered,
    title: 'Chyby seřazené podle dopadu, ne podle abecedy',
    body: 'Report začíná chybou, která vás stojí nejvíc peněz. Každý bod má popis, dotčené stránky a odhad náročnosti opravy.',
  },
  {
    icon: Coins,
    title: 'Vyčíslení v korunách u každé chyby',
    body: 'K výpočtu používáme váš obrat, konverzní poměr a měřenou dobu načtení. Metodiku uvádíme přímo v reportu, takže si čísla můžete přepočítat sami.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Kontrolní měření před a po opravě',
    body: 'Po nasazení opravy měříme znovu stejnou metodikou a stejnými nástroji. Srovnání dostanete písemně — výsledek nemusíte brát na slovo.',
  },
  {
    icon: FileDown,
    title: 'Výstup v PDF, ne v přístupu do dalšího nástroje',
    body: 'Report je jeden soubor, který můžete rovnou předat vývojáři, agentuře nebo nadřízenému. Nepotřebujete žádnou registraci.',
  },
];

export default function SocialProof() {
  return (
    <section id="vysledky" className="section-line bg-card/40 py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Metodika</span>
            <h2 className="mt-4">Co přesně dostanete</h2>
            <p className="mt-5 text-muted-foreground">
              Neposíláme čtyřicetistránkový výpis z nástroje. Report je krátký dokument, ve kterém je u každé chyby
              vidět, kolik vás měsíčně stojí a co je potřeba udělat.
            </p>
            <p className="mt-4 text-muted-foreground">
              Měření probíhá proti veřejně dostupným datům a Google PageSpeed API, takže výsledek si můžete kdykoli
              ověřit stejným postupem.
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
              {reportContents.map((item) => (
                <div key={item.title} className="flex gap-5 p-6 sm:p-7">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[1.05rem]">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}