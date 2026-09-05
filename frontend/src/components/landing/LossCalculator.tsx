import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ArrowRight, TrendingDown, Gauge } from 'lucide-react';

const czk = (value: number) => `${Math.round(value).toLocaleString('cs-CZ')} Kč`;

/**
 * Conversion uplift model based on published PageSpeed/conversion correlations:
 * every second of load time above the 2s target costs roughly 7% of conversions,
 * capped at a realistic 35% recoverable share.
 */
function estimate(revenue: number, loadTime: number) {
  const secondsOverTarget = Math.max(0, loadTime - 2);
  const recoverableShare = Math.min(0.35, secondsOverTarget * 0.07);
  const monthlyLoss = revenue * recoverableShare;
  return {
    recoverablePct: recoverableShare * 100,
    monthlyLoss,
    yearlyLoss: monthlyLoss * 12,
  };
}

export default function LossCalculator() {
  const [revenue, setRevenue] = useState(450_000);
  const [loadTime, setLoadTime] = useState(4.6);

  const result = useMemo(() => estimate(revenue, loadTime), [revenue, loadTime]);

  const severity =
    loadTime <= 2.5
      ? { label: 'Dobrá rychlost', tone: 'text-primary' }
      : loadTime <= 4
        ? { label: 'Podprůměrná rychlost', tone: 'text-accent' }
        : { label: 'Kritická rychlost', tone: 'text-destructive' };

  return (
    <section id="kalkulacka" className="section-line bg-card/40 py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">Ztrátová kalkulačka</span>
            <h2 className="mt-4">Kolik vás pomalý e-shop stojí každý měsíc?</h2>
            <p className="mt-5 text-muted-foreground">
              Posuňte dva jezdce podle svých čísel. Výpočet vychází z korelace mezi dobou načtení a konverzním
              poměrem — každá sekunda nad dvě sekundy odkrajuje přibližně 7 % konverzí.
            </p>

            <div className="mt-8 space-y-7">
              <div>
                <div className="flex items-baseline justify-between">
                  <Label className="text-sm font-semibold">Měsíční obrat e-shopu</Label>
                  <span className="tnum text-lg font-bold">{czk(revenue)}</span>
                </div>
                <Slider
                  value={[revenue]}
                  onValueChange={(v) => setRevenue(v[0])}
                  min={50_000}
                  max={5_000_000}
                  step={10_000}
                  className="mt-4"
                  aria-label="Měsíční obrat e-shopu"
                />
                <div className="tnum mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>50 tis.</span>
                  <span>5 mil.</span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label className="text-sm font-semibold">Doba načtení mobilní verze</Label>
                  <span className="tnum text-lg font-bold">{loadTime.toFixed(1)} s</span>
                </div>
                <Slider
                  value={[loadTime]}
                  onValueChange={(v) => setLoadTime(v[0])}
                  min={1}
                  max={12}
                  step={0.1}
                  className="mt-4"
                  aria-label="Doba načtení mobilní verze"
                />
                <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${severity.tone}`}>
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                  {severity.label}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-lg border border-accent/30 bg-background p-7 sm:p-9">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-accent">Odhadovaná ztráta</span>
              </div>

              <p className="tnum mt-5 display text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-none text-accent">
                {czk(result.monthlyLoss)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                každý měsíc, tedy <span className="tnum font-semibold text-foreground">{czk(result.yearlyLoss)}</span>{' '}
                ročně
              </p>

              <div className="mt-8 grid gap-5 border-t border-border pt-7 sm:grid-cols-2">
                <div>
                  <p className="tnum text-2xl font-bold">{result.recoverablePct.toFixed(1)} %</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    konverzí, které lze technickou opravou reálně získat zpět
                  </p>
                </div>
                <div>
                  <p className="tnum text-2xl font-bold text-primary">{Math.max(0, loadTime - 2).toFixed(1)} s</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    nad hranicí dvou sekund, kterou zákazníci ještě tolerují
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-7 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="h-12 flex-1 bg-primary text-base font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90"
                >
                  <a href="#analyza">
                    Zjistit mé skutečné chyby
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground sm:max-w-[15rem]">
                  Odhad nahradíme skutečnými daty z vašeho e-shopu do hodiny.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}