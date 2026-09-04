import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  trailingParagraphs?: string[];
}

export interface LegalPageProps {
  title: string;
  meta: string;
  intro: string;
  sections: LegalSection[];
  closing: string;
}

export default function LegalPage({ title, meta, intro, sections, closing }: LegalPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="display text-lg font-extrabold tracking-tight">
            GoFix<span className="text-primary">Web</span>
          </Link>
          <Button
            asChild
            className="ml-auto h-10 bg-primary px-5 font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90"
          >
            <Link to="/#analyza">Bezplatná analýza</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/12 text-primary">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-[clamp(1.9rem,3vw+1rem,2.6rem)]">{title}</h1>
        <p className="mt-4 text-sm font-semibold tabular-nums text-primary">{meta}</p>
        <p className="mt-5 text-muted-foreground">{intro}</p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl">{section.heading}</h2>

              {section.paragraphs && section.paragraphs.length > 0 && (
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph, index) => (
                    <p
                      key={`${section.heading}-p-${index}`}
                      className="text-sm leading-relaxed text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((bullet, index) => (
                    <li
                      key={`${section.heading}-b-${index}`}
                      className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.trailingParagraphs && section.trailingParagraphs.length > 0 && (
                <div className="mt-4 space-y-4">
                  {section.trailingParagraphs.map((paragraph, index) => (
                    <p
                      key={`${section.heading}-t-${index}`}
                      className="text-sm leading-relaxed text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm italic text-muted-foreground">{closing}</p>

        <div className="mt-14 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            Máte dotaz k tomuto dokumentu? Napište na{' '}
            <a
              href="mailto:info@gofixweb.com"
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-4"
            >
              info@gofixweb.com
            </a>
            .
          </p>
          <Button
            asChild
            className="mt-6 h-11 !bg-transparent px-5 text-sm font-semibold text-foreground ring-1 ring-inset ring-border transition-colors duration-200 hover:md:!bg-transparent hover:md:ring-primary/60"
          >
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Zpět na hlavní stránku
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

const BRAND_NOTE = 'GoFixWeb je obchodní značka služby provozované společností FinalEdge s.r.o.';

export function TermsPage() {
  return (
    <LegalPage
      title="Obchodní podmínky"
      meta="Platné od: 2. 9. 2026 · Poskytovatel: FinalEdge s.r.o. (obchodní značka GoFixWeb)"
      intro="Tyto obchodní podmínky upravují poskytování služeb GoFixWeb — online nástroje provozovaného společností FinalEdge s.r.o. — pro automatickou analýzu e-shopů, identifikaci technických a obsahových problémů, finanční vyčíslení ztrát a návrh oprav včetně AI generovaných textů."
      closing={BRAND_NOTE}
      sections={[
        {
          heading: '1. Poskytovatel služby',
          paragraphs: [
            'Službu provozuje FinalEdge s.r.o., IČO: 19181761, se sídlem Korunní 2569/108, 101 00 Praha 10-Vinohrady (obchodní značka GoFixWeb). Kontakt: info@gofixweb.com, web gofixweb.com.',
          ],
        },
        {
          heading: '2. Popis služby',
          paragraphs: ['GoFixWeb poskytuje zejména:'],
          bullets: [
            'automatický sken e-shopu (rychlost, SEO, odkazy, mobilní zobrazení),',
            'PDF report s prioritizovanými nálezy a finančním dopadem v Kč,',
            'AI generované opravné texty pro administraci e-shopu jako součást placené jednorázové služby Kompletní audit e-shopu,',
            'asistenční a konzultační služby dle individuální domluvy.',
          ],
        },
        {
          heading: '3. Ceny a platby',
          paragraphs: [
            'Služba je poskytována formou měsíčních tarifů uvedených na webu (Basic 1\u00a0490\u00a0Kč/měs. — měsíční sken a 1 automatická oprava; Pro 3\u00a0990\u00a0Kč/měs. — týdenní sken a až 4 opravy měsíčně; Premium 6\u00a0990\u00a0Kč/měs. — denní sken a denní optimalizace, včetně DPH). Automatické opravy v předplatném jsou dostupné výhradně pro WooCommerce a probíhají stejně jako jednorázová automatická oprava. Kromě měsíčních tarifů nabízí GoFixWeb také jednorázovou službu Kompletní audit e-shopu, který zahrnuje kompletní PDF report se všemi nálezy a AI generovanými opravnými texty. Objednat opravu lze buď pro manuální nebo automatický mód. Automatická oprava je dostupná výhradně pro e-shopy na platformě WooCommerce. Pro e-shopy na ostatních platformách (zejména Shopify, Shoptet, Magento a další) je dostupná pouze manuální oprava. Cena manuální opravy je 1\u00a0990\u00a0Kč vč. DPH a cena automatické opravy je 1\u00a0990\u00a0Kč vč. DPH. Tuto službu lze koupit samostatně, bez předplatného. Vstupní analýza (teaser report) může být poskytována zdarma. Aktuální ceny jsou vždy uvedeny na gofixweb.com. Platby probíhají online (platební brána Stripe) nebo bankovním převodem dle faktury.',
          ],
        },
        {
          heading: '4. Objednávka a plnění',
          paragraphs: [
            'Objednávka vzniká výběrem tarifu nebo jednorázové služby a zaplacením přes platební bránu, nebo e-mailem na info@gofixweb.com. Report je obvykle dodán elektronicky maximálně do 48 hodin od přijetí platby a zadání URL e-shopu, pokud není dohodnuto jinak. FinalEdge s.r.o. si vyhrazuje právo odmítnout objednávku u nelegitimních nebo technicky nedostupných webů.',
          ],
        },
        {
          heading: '5. Práva a povinnosti',
          paragraphs: [
            'Zákazník poskytne platnou URL e-shopu a součinnost nezbytnou pro analýzu. Výstupy služby jsou určeny pro interní použití zákazníka. FinalEdge s.r.o. negarantuje konkrétní obchodní výsledek (nárůst tržeb); reporty vycházejí z automatizované analýzy a odhadů finančního dopadu.',
          ],
        },
        {
          heading: '6. Reklamace a odstoupení',
          paragraphs: [
            'Reklamace uplatněte e-mailem na info@gofixweb.com do 14 dnů od dodání digitálního obsahu, pokud nebyl poskytnut v dohodnutém rozsahu. U digitálního obsahu dodaného okamžitě po platbě může být uplatnění práva na odstoupení vyloučeno dle platných právních předpisů, pokud zákazník s okamžitým plněním souhlasil.',
          ],
        },
        {
          heading: '7. Ochrana duševního vlastnictví',
          paragraphs: [
            'Software, metodika a šablony reportů jsou majetkem FinalEdge s.r.o. Zákazník získává licenci k použití dodaných reportů a textů pro provoz vlastního e-shopu.',
          ],
        },
        {
          heading: '8. Manuální a automatická oprava',
          paragraphs: [
            '8.1 Poskytovatel nabízí v rámci služby GoFixWeb dvě jednorázové varianty opravy zjištěných nedostatků e-shopu:',
            'a) Manuální oprava – zákazník obdrží PDF report s popisem zjištěných nedostatků a přesným návodem k jejich odstranění (včetně pokynů „Kde vložit“). Zákazník provádí veškeré úpravy sám, ve vlastní administraci webu, ve vlastním čase. Poskytovatel nemá v této variantě přístup do systému zákazníka ani do jeho webu. Cena této varianty činí 1\u00a0990\u00a0Kč (jednorázová platba).',
            'b) Automatická oprava – zákazník poskytne Poskytovateli přístupové údaje do administrace svého webu (výhradně WordPress/WooCommerce). Poskytovatel na jejich základě provede jednorázově tyto úpravy: SEO opravy dle nálezů auditu (úprava titulků, meta popisků a nadpisů H1); instalaci a/nebo aktivaci lehkého SEO pluginu (Slim SEO) pro zápis meta popisků do stránky, pokud web ještě žádný SEO nástroj nepoužívá; instalaci a/nebo aktivaci pluginu pro kompresi obrázků (Smush); vypnutí explicitně specifikovaných nepoužívaných pluginů; diagnostiku lazy loadingu. Pluginy se instalují z oficiálního adresáře wordpress.org a pouze tehdy, pokud na webu ještě není aktivní nástroj se stejnou funkcí. Zákazník může tyto zásahy vzít zpět odinstalací příslušného pluginu. Jde o jednorázový zásah, nikoli o průběžnou správu webu. Cena této varianty činí 1\u00a0990\u00a0Kč (jednorázová platba).',
            '8.2 Přístupové údaje jsou ukládány v šifrované podobě a zákazník je oprávněn kdykoli požádat o jejich smazání.',
            '8.3 Provedené automatické úpravy jsou logovány (auditní záznam) a je možné je na žádost zákazníka vrátit do původního stavu (rollback), a to do 30 dnů od provedení.',
            '8.4 Poskytovatel neodpovídá za škody vzniklé v důsledku okolností, které nemohl ovlivnit (např. nekompatibilita s jiným pluginem třetí strany instalovaným zákazníkem po provedení opravy). Případná odpovědnost Poskytovatele je omezena do výše zaplacené ceny za příslušnou objednávku.',
            '8.5 Zaplacením a odesláním objednávky automatické opravy zákazník výslovně souhlasí s tím, že Poskytovatel provede úpravy uvedené v bodě 8.1 písm. b) tohoto článku.',
            '8.6 Skóre uváděné v reportech (PageSpeed, SEO a další metriky) vychází z nástroje Google PageSpeed Insights a dalších automatizovaných analýz třetích stran. Tyto nástroje používají algoritmy, které Poskytovatel nemůže ovlivnit ani garantovat, a naměřené hodnoty se mohou v čase měnit i bez jakéhokoli zásahu do webu (např. v důsledku aktualizace algoritmu, zátěže serveru v okamžiku měření nebo jiných vnějších faktorů). Uváděné „před/po“ hodnoty a odhady zlepšení jsou proto informativní a nejsou závazným příslibem konkrétního výsledku.',
            '8.7 Automatická oprava dle bodu 8.1 písm. b) je dostupná výhradně pro e-shopy provozované na platformě WooCommerce (WordPress). Zahrnuje automatický zápis SEO úprav (titulek, meta description, H1) a kompresi obrázků v administraci zákazníka. Pro e-shopy na ostatních platformách, zejména Shopify, Shoptet, Magento a dalších, Poskytovatel automatickou opravu neposkytuje; u těchto e-shopů je dostupná pouze manuální oprava dle bodu 8.1 písm. a), tedy PDF report s návodem k provedení úprav v administraci zákazníka (včetně pokynů „Kde vložit“).',
          ],
        },
        {
          heading: '9. Závěrečná ustanovení',
          paragraphs: [
            'Tyto podmínky se řídí právem České republiky. FinalEdge s.r.o. může podmínky aktualizovat; nová verze bude zveřejněna na této stránce. V případě dotazů nás kontaktujte na info@gofixweb.com.',
          ],
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Zásady ochrany osobních údajů"
      meta="Platné od: 13. 8. 2026 · Správce: FinalEdge s.r.o. (obchodní značka GoFixWeb)"
      intro="Služba GoFixWeb, provozovaná společností FinalEdge s.r.o., respektuje vaše soukromí. Tento dokument popisuje, jak zpracováváme osobní údaje při provozu webu a poskytování služeb analýzy e-shopů."
      closing={BRAND_NOTE}
      sections={[
        {
          heading: '1. Správce údajů',
          paragraphs: [
            'Správcem je FinalEdge s.r.o., IČO: 19181761, se sídlem Korunní 2569/108, 101 00 Praha 10-Vinohrady (obchodní značka GoFixWeb). Kontakt pro dotazy k ochraně údajů: info@gofixweb.com.',
          ],
        },
        {
          heading: '2. Jaké údaje zpracováváme',
          paragraphs: ['Můžeme zpracovávat zejména:'],
          bullets: [
            'identifikační a kontaktní údaje (jméno, e-mail),',
            'URL nebo název e-shopu zadaný ve formuláři,',
            'technické údaje o návštěvě webu (IP adresa, cookies, typ prohlížeče),',
            'fakturační údaje při objednávce placené služby,',
            'obsah komunikace (e-maily, podpora).',
          ],
        },
        {
          heading: '3. Účely a právní základy',
          bullets: [
            'Objednávka služby / kontakt — plnění smlouvy nebo kroky před jejím uzavřením, případně souhlas.',
            'Poskytování analýzy e-shopu — plnění smlouvy.',
            'Platby — plnění smlouvy, plnění právních povinností (účetnictví).',
            'Provoz webu a bezpečnost — oprávněný zájem správce.',
            'Marketing — pouze se souhlasem, pokud je vyžádán.',
          ],
        },
        {
          heading: '4. Doba uchování',
          paragraphs: [
            'Údaje uchováváme po dobu trvání smluvního vztahu a dále po dobu vyžadovanou právními předpisy (typicky 3–10 let u účetních a daňových dokladů). Kontaktní údaje z objednávky nebo dotazu mažeme po ukončení smluvního vztahu nebo na žádost, pokud nemáme jiný právní důvod k jejich uchování.',
          ],
        },
        {
          heading: '5. Příjemci a předávání',
          paragraphs: [
            'Údaje můžeme svěřit zpracovatelům nezbytným pro provoz služby (hosting, e-mail, platební brána Stripe, analytika, formulářové služby). Osobní údaje neprodáváme třetím stranám. Předávání mimo EU/EHP probíhá pouze s odpovídajícími zárukami (např. standardní smluvní doložky).',
          ],
        },
        {
          heading: '6. Vaše práva',
          paragraphs: ['Máte právo na:'],
          bullets: [
            'přístup ke svým údajům a jejich kopii,',
            'opravu nebo doplnění nepřesných údajů,',
            'výmaz (pokud nejsou dány jiné důvody pro zpracování),',
            'omezení zpracování a námitku proti zpracování,',
            'přenositelnost údajů,',
            'odvolání souhlasu kdykoli (bez vlivu na dřívější zpracování),',
            'podání stížnosti u ÚOOÚ (uoou.cz).',
          ],
          trailingParagraphs: ['Žádosti zasílejte na info@gofixweb.com.'],
        },
        {
          heading: '7. Cookies',
          paragraphs: [
            'Web může používat technicky nezbytné cookies pro správné zobrazení stránky. Analytické nebo marketingové cookies používáme pouze s vaším souhlasem, pokud jsou na webu aktivní.',
          ],
        },
        {
          heading: '8. Zabezpečení',
          paragraphs: [
            'Přijímáme přiměřená technická a organizační opatření k ochraně údajů před ztrátou, zneužitím nebo neoprávněným přístupem.',
          ],
        },
        {
          heading: '9. Změny zásad',
          paragraphs: [
            'Tyto zásady můžeme aktualizovat. Aktuální verze je vždy dostupná na této stránce.',
          ],
        },
      ]}
    />
  );
}