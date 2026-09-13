import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';

const P_CLASS = 'text-sm leading-relaxed text-muted-foreground';
const A_CLASS = 'font-semibold text-primary underline decoration-primary/40 underline-offset-4';

function P({ children }: { children: ReactNode }) {
  return <p className={P_CLASS}>{children}</p>;
}

export interface LegalSection {
  heading: string;
  id?: string;
  paragraphs?: ReactNode[];
  bullets?: string[];
  trailingParagraphs?: ReactNode[];
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
            <section key={section.heading} id={section.id} className={section.id ? 'scroll-mt-24' : undefined}>
              <h2 className="text-xl">{section.heading}</h2>

              {section.paragraphs && section.paragraphs.length > 0 && (
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph, index) => (
                    typeof paragraph === 'string' ? (
                      <p key={`${section.heading}-p-${index}`} className={P_CLASS}>
                        {paragraph}
                      </p>
                    ) : (
                      <div key={`${section.heading}-p-${index}`}>{paragraph}</div>
                    )
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
                    typeof paragraph === 'string' ? (
                      <p key={`${section.heading}-t-${index}`} className={P_CLASS}>
                        {paragraph}
                      </p>
                    ) : (
                      <div key={`${section.heading}-t-${index}`}>{paragraph}</div>
                    )
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
            <a href="mailto:info@gofixweb.com" className={A_CLASS}>
              info@gofixweb.com
            </a>
            . Nezákonný obsah na webu nebo v zaslaných podnětech:{' '}
            <Link to="/nahlasit-obsah" className={A_CLASS}>
              nahlásit nezákonný obsah
            </Link>
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
      meta="Platné od: 14. 9. 2026 · Poskytovatel: FinalEdge s.r.o. (obchodní značka GoFixWeb)"
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
          heading: '6. Reklamace',
          id: 'reklamace',
          paragraphs: [
            <P key="e1">
              GoFixWeb dodává digitální služby (sken, PDF report, manuální nebo automatickou opravu e-shopu a
              případně předplatné), nikoli zboží. Reklamace se proto týká vadného plnění těchto služeb, ne
              zákonné záruky 24 měsíců u fyzického zboží.
            </P>,
            <P key="e2">
              Rozsah reklamace a práva z vadného plnění: můžete reklamovat, že služba nebyla dodána, byla
              dodána v jiném rozsahu, než jste objednali (například chybí slíbený report, automatická oprava
              podle čl. 8.1 nebyla provedena), nebo má jinou vadu, která brání sjednanému použití. Reklamovat
              nelze samotný obchodní výsledek (nárůst tržeb) ani kolísání skóre PageSpeed a dalších metrik
              třetích stran podle čl. 8.6.
            </P>,
            <P key="e3">
              Podmínky reklamace: reklamaci uplatněte bez zbytečného odkladu, nejpozději do 14 dnů od dodání
              příslušného výstupu (reportu nebo provedení opravy). U předplatného od okamžiku, kdy jste vadu
              zjistili nebo mohli zjistit. Uplatnění reklamace samo o sobě není odstoupením od smlouvy.
            </P>,
            <P key="e4">
              Způsob uplatnění: reklamovat e-mailem na{' '}
              <a href="mailto:info@gofixweb.com" className={A_CLASS}>
                info@gofixweb.com
              </a>
              . Uveďte e-mail použitý při objednávce, URL e-shopu, popis vady a jaký způsob vyřízení
              požadujete (doplnění, opakované provedení, rollback automatické opravy podle čl. 8.3, nebo
              vrácení ceny). O reklamaci vás budeme informovat, zpravidla do 30 dnů.
            </P>,
          ],
        },
        {
          heading: '7. Odstoupení od smlouvy',
          id: 'odstoupeni',
          paragraphs: [
            <P key="f1">
              GoFixWeb neprodává zboží s dodáním na adresu. Předmětem smlouvy je digitální obsah a služba
              (report / oprava e-shopu, případně předplatné). Čtrnáctidenní odstoupení od smlouvy o koupi
              zboží na dálku se proto na tyto objednávky neuplatní ve znění „od převzetí zásilky“.
            </P>,
            <P key="f2">
              Objednávka v rámci podnikání: pokud smlouvu uzavíráte jako podnikatel (typicky na IČO, pro
              provoz e-shopu), zákonné právo spotřebitele odstoupit od smlouvy do 14 dnů se na vás nevztahuje.
            </P>,
            <P key="f3">
              Objednávka spotřebitele: spotřebitel má obecně právo odstoupit od smlouvy uzavřené na dálku do
              14 dnů od jejího uzavření. U placených služeb GoFixWeb (jednorázová oprava Auto nebo Manuál a
              předplatné) ale zahajujeme poskytování digitálního obsahu ihned po zaplacení. Před platbou musí
              spotřebitel zaškrtnout souhlas ve znění: „Souhlasím s tím, aby GoFixWeb (FinalEdge s.r.o.)
              zahájil poskytování digitálního obsahu (report/oprava e-shopu) ihned po zaplacení, a beru na
              vědomí, že tímto ztrácím právo odstoupit od smlouvy do 14 dnů.“ Bez tohoto souhlasu nelze
              pokračovat k platbě. Po udělení souhlasu a zahájení plnění spotřebitel ztrácí právo odstoupit od
              smlouvy do 14 dnů (§ 1837 písm. l) občanského zákoníku). Bezplatná vstupní analýza (teaser)
              není placenou smlouvou.
            </P>,
            <P key="f4">
              Pokud jste spotřebitel, souhlas jste neudělili a plnění jsme ještě nezahájili, můžete od smlouvy
              odstoupit do 14 dnů od uzavření. Odstoupení odešlete e-mailem na{' '}
              <a href="mailto:info@gofixweb.com" className={A_CLASS}>
                info@gofixweb.com
              </a>
              . Můžete použít vzorový formulář níže. Rollback automatické opravy do 30 dnů podle čl. 8.3 je
              náprava vady, nikoli odstoupení od smlouvy.
            </P>,
            <div
              key="f-form"
              className="rounded-md border border-border bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground"
            >
              <p className="font-semibold text-foreground">Vzorový formulář pro odstoupení od smlouvy</p>
              <p className="mt-3">
                Adresát: FinalEdge s.r.o., Korunní 2569/108, 101 00 Praha 10-Vinohrady,{' '}
                <a href="mailto:info@gofixweb.com" className={A_CLASS}>
                  info@gofixweb.com
                </a>
              </p>
              <p className="mt-3">
                Odstupuji od této smlouvy uzavřené dne [datum] o službě GoFixWeb [Auto / Manuál / tarif],
                e-shop [URL].
              </p>
              <p className="mt-3">Jméno a adresa spotřebitele: [doplňte]</p>
              <p className="mt-3">Datum: [doplňte]</p>
              <p className="mt-3">Podpis (jen pokud odesíláte v papírové podobě): [doplňte]</p>
            </div>,
          ],
        },
        {
          heading: '8. Manuální a automatická oprava',
          id: 'vop-autofix-section',
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
          heading: '9. Ochrana duševního vlastnictví',
          paragraphs: [
            'Software, metodika a šablony reportů jsou majetkem FinalEdge s.r.o. Zákazník získává licenci k použití dodaných reportů a textů pro provoz vlastního e-shopu.',
          ],
        },
        {
          heading: '10. Nahlášení nezákonného obsahu',
          id: 'dsa',
          paragraphs: [
            <P key="d1">
              GoFixWeb není tržiště s recenzemi třetích osob na produktových kartách. Přijímáme ale
              objednávky, poptávky a další uživatelské podněty (včetně URL e-shopu a případných recenzí nebo
              hodnocení služby). Pokud na webu gofixweb.com nebo v obsahu, který nám někdo zaslal, narazíte na
              nezákonný obsah, můžete ho nahlásit.
            </P>,
            <P key="d2">
              Nahlášení nezákonného obsahu: napište na{' '}
              <a href="mailto:info@gofixweb.com?subject=Nahl%C3%A1%C5%A1en%C3%AD%20nez%C3%A1konn%C3%A9ho%20obsahu" className={A_CLASS}>
                info@gofixweb.com
              </a>{' '}
              nebo použijte stránku{' '}
              <Link to="/nahlasit-obsah" className={A_CLASS}>
                Nahlásit nezákonný obsah
              </Link>
              . Uveďte URL obsahu, popis a důvod nahlášení. Oznámení posoudíme a o dalším postupu vás
              informujeme v přiměřené lhůtě.
            </P>,
          ],
        },
        {
          heading: '11. Závěrečná ustanovení',
          paragraphs: [
            'Tyto podmínky se řídí právem České republiky. FinalEdge s.r.o. může podmínky aktualizovat; nová verze bude zveřejněna na této stránce. V případě dotazů nás kontaktujte na info@gofixweb.com.',
          ],
        },
      ]}
    />
  );
}

export function ReportIllegalPage() {
  return (
    <LegalPage
      title="Nahlášení nezákonného obsahu"
      meta="Akt o digitálních službách (DSA) · FinalEdge s.r.o. (obchodní značka GoFixWeb)"
      intro="Tato stránka slouží k nahlášení nezákonného obsahu na webu gofixweb.com nebo v podnětech, které nám někdo zaslal (objednávky, poptávky, URL e-shopu, případné recenze nebo hodnocení). Nejde o formulář reklamace služby ani o odstoupení od smlouvy."
      closing={BRAND_NOTE}
      sections={[
        {
          heading: 'Jak nahlásit nezákonný obsah',
          paragraphs: [
            <P key="r1">
              Nahlášení nezákonného obsahu odešlete e-mailem na{' '}
              <a
                href="mailto:info@gofixweb.com?subject=Nahl%C3%A1%C5%A1en%C3%AD%20nez%C3%A1konn%C3%A9ho%20obsahu"
                className={A_CLASS}
              >
                info@gofixweb.com
              </a>
              . Do zprávy uveďte URL obsahu, stručný popis, důvod nahlášení a kontakt, na který vás můžeme
              informovat o dalším postupu.
            </P>,
            <P key="r2">
              Oznámení posoudíme a o dalším postupu vás informujeme v přiměřené lhůtě. Reklamaci zakoupené
              služby řešte podle{' '}
              <Link to="/vop#reklamace" className={A_CLASS}>
                čl. 6 obchodních podmínek
              </Link>
              .
            </P>,
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