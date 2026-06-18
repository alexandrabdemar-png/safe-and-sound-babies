import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import catCarseat from "@/assets/cat-carseat.svg";
import catPacifier from "@/assets/cat-pacifier.svg";
import catCrib from "@/assets/cat-crib.png";
import catBreastmilk from "@/assets/cat-breastmilk.png";
import catFormula from "@/assets/cat-formula.png";
import catBabyfood from "@/assets/cat-babyfood.png";
import catSwaddle from "@/assets/cat-swaddle.png";
import catStroller from "@/assets/cat-stroller.png";
import catPacknplay from "@/assets/cat-packnplay.png";
import catCarrier from "@/assets/cat-carrier.png";
import catBouncer from "@/assets/cat-bouncer.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safe & Sound — Baby Safety Tracking" },
      {
        name: "description",
        content:
          "Never miss a safety milestone again. Track car seats, pacifiers, cribs, and more with quiet, kind reminders.",
      },
      { property: "og:title", content: "Safe & Sound — Baby Safety Tracking" },
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
  { name: "Crib mattress heights", image: catCrib },
  { name: "Breast Milk", image: catBreastmilk },
  { name: "Formula", image: catFormula },
  { name: "Baby Food", image: catBabyfood },
  { name: "Swaddles", image: catSwaddle },
  { name: "Strollers", image: catStroller },
  { name: "Pack 'n Plays", image: catPacknplay },
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
    title: "Safety first",
    description:
      "Know exactly when to replace, size up, or check the fit. Because the little things are the big things.",
  },
  {
    title: "Always one step ahead",
    description:
      "Real-time recall alerts for every product you own — so you hear about safety issues the moment they happen, not months later.",
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
                Add any baby essential—from car seats and cribs to bottles,
                carriers, and everything in between. Safe &amp; Sound keeps
                track of the details for you, with reminders when it's time to
                replace, resize or double-check the fit.
              </p>
              <p className="mt-3 max-w-lg font-body text-lg leading-relaxed text-muted-foreground">
                Just the information you need, exactly when you need it.
              </p>

              <Link
                to="/auth"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-body text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Track what matters
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="group flex flex-col items-center rounded-3xl border border-border/60 bg-card p-6 text-center transition-all hover:border-border hover:shadow-lg hover:shadow-foreground/5"
              >
                <div className="mb-4 flex h-20 w-20 items-center justify-center">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="font-body text-sm font-medium text-foreground">
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
