import { Search, Calculator, Wrench, X, Check } from 'lucide-react';

const steps = [
  {
    icon: Search,
    label: 'Krok 1 — do 10 minut',
    title: 'Sken e-shopu proti Google datům',
    body: 'Napojíme se na Google PageSpeed API a projdeme rychlost, mobilní verzi, obrázky, chybové stavy i chybějící data ve vyhledávání. Žádné přístupy do administrace nepotřebujeme.',
  },
  {
    icon: Calculator,
    label: 'Krok 2 — do hodiny',
    title: 'Vyčíslení měsíční ztráty v korunách',
    body: 'Každou nalezenou chybu přepočítáme na peníze podle vašeho obratu a konverzního poměru. Dostanete PDF s pořadím chyb podle toho, kolik vás reálně stojí.',
  },
  {
    icon: Wrench,
    label: 'Krok 3 — pokud budete chtít',
    title: 'Oprava a doložený výsledek',
    body: 'Chyby opravíme my a znovu změříme stejnou metodikou. Před/po srovnání dostanete písemně, takže rozdíl vidíte ihned.',
  },
];

const problems = [
  'Nevíte, která technická chyba vám ubírá nejvíc peněz',
  'Agentura pošle report na 40 stran bez jediné částky',
  'Opravy se odkládají, protože nikdo neurčí prioritu',
  'Rychlost e-shopu nikdo nekontroluje mezi kampaněmi',
];

const answers = [
  'Chyby seřazené podle dopadu na obrat, ne podle abecedy',
  'Každý bod má odhad ztráty v korunách za měsíc',
  'Opravu zařídíme my — nepotřebujete vlastního vývojáře',
  'Pravidelný sken hlásí nové chyby dřív než zákazníci',
];

export default function HowItWorks() {
  return (
    <section id="jak-to-funguje" className="section-line py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Jak to funguje</span>
          <h2 className="mt-4">Tři kroky od dohadů k jasným číslům</h2>
        </div>

        <div className="mt-14 space-y-px overflow-hidden rounded-lg border border-border bg-border">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="grid gap-6 bg-card p-7 sm:grid-cols-12 sm:p-9"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="sm:col-span-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="tnum text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {step.label}
                  </span>
                </div>
                <h3 className="mt-4 text-[1.35rem]">{step.title}</h3>
              </div>
              <p className="text-muted-foreground sm:col-span-7 sm:col-start-6">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="rounded-lg border border-destructive/25 bg-destructive/[0.05] p-7 sm:p-8 lg:col-span-5">
            <h3 className="text-destructive">Co vás dnes brzdí</h3>
            <ul className="mt-6 space-y-4">
              {problems.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  {/* Text položek je v obou sloupcích shodně `text-foreground`. Ztlumená
                      levá strana dělala z problémů méně čitelný text než z výhod. Rozdíl
                      mezi sloupci nese ikona, rámeček a podbarvení, ne barva textu. */}
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-7 sm:p-9 lg:col-span-7">
            <h3 className="text-primary">Jak to řeší GoFixWeb</h3>
            <ul className="mt-6 space-y-4">
              {answers.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}