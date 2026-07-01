import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import catCarseat from "@/assets/hd-carseat.png";
import catPacifier from "@/assets/hd-pacifier.png";
import catBreastMilk from "@/assets/hd-breastmilk.png";
import catFormula from "@/assets/hd-formula.png";
import catBabyFood from "@/assets/hd-babyfood.png";
import catSwaddle from "@/assets/hd-swaddle.png";
import catStroller from "@/assets/hd-stroller.png";
import catPacknPlay from "@/assets/hd-packnplay.png";
import catCarrier from "@/assets/hd-carrier.png";
import catBouncer from "@/assets/hd-bouncer.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Peace of Mine — Baby Safety Tracking" },
      {
        name: "description",
        content:
          "Never miss a safety milestone again. Track car seats, pacifiers, cribs, and more with quiet, kind reminders.",
      },
      { property: "og:title", content: "Peace of Mine — Baby Safety Tracking" },
      {
        property: "og:description",
        content:
          "Never miss a safety milestone again. Track car seats, pacifiers, cribs, and more with quiet, kind reminders.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

const categories = [
  { name: "Car seats", image: catCarseat },
  { name: "Pacifiers", image: catPacifier },
  { name: "Breast Milk", image: catBreastMilk },
  { name: "Formula", image: catFormula },
  { name: "Baby Food", image: catBabyFood },
  { name: "Swaddles", image: catSwaddle },
  { name: "Strollers", image: catStroller },
  { name: "Pack 'n Plays", image: catPacknPlay },
  { name: "Carriers", image: catCarrier },
  { name: "Bouncers", image: catBouncer },
];

const features = [
  {
    title: "Track everything",
    description:
      "From car seats to pacifiers, cribs to swaddles — one place for every baby product that matters.",
  },
  {
    title: "Government data, in your pocket",
    description:
      "We pull directly from CPSC, FDA, and NHTSA databases — the same sources pediatricians and consumer advocates use. We do the searching. You make the call.",
  },
  {
    title: "Hear about recalls sooner",
    description:
      "Recall alerts drawn from official government sources plus community early signals — so you hear about issues as quickly as they become public, not months later.",
  },
];

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Copy */}
            <div className="flex flex-col items-start">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-body text-sm font-medium text-foreground">
                  For the little things that matter
                </span>
              </div>

              <h1 className="font-display text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Never miss a{" "}
                <span className="font-display-italic italic text-primary">safety</span>
                <br />
                milestone again.
              </h1>

              <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-muted-foreground">
                Add any baby essential — from car seats and cribs to bottles,
                carriers, and everything in between. Peace of Mine pulls recall
                data directly from CPSC, FDA, and NHTSA and puts it in front of
                you when it matters.
              </p>
              <p className="mt-3 max-w-lg font-body text-lg leading-relaxed text-muted-foreground">
                We do the searching. You make the call.
              </p>

              <Link
                to="/auth"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-body text-base font-semibold text-primary-foreground transition-all duration-150 hover:bg-[#485240]"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p
                className="mt-5 text-[11px] font-medium tracking-[0.1em] text-muted-foreground/60"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif', textTransform: "uppercase" }}
              >
                Data sourced from CPSC · FDA · NHTSA official databases
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Categories Section — hand-drawn circles */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Track what matters
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-14 lg:grid-cols-5">
            {categories.map((cat) => (
              <div key={cat.name} className="flex flex-col items-center text-center">
                <div className="aspect-square w-full max-w-[180px] overflow-hidden rounded-full">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    width={512}
                    height={512}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="mt-4 font-body text-sm font-medium text-foreground">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-border/60 bg-card p-8 transition-all hover:shadow-lg hover:shadow-foreground/5"
              >
                <CheckCircle2 className="mb-4 h-6 w-6 text-accent" />
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-3 font-body text-base leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <Footer />
    </div>
  );
}
