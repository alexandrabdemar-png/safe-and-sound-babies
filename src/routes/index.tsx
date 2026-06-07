import { createFileRoute } from "@tanstack/react-router";
import {
  Shield,
  CircleDot,
  Bed,
  Coffee,
  FlaskConical,
  Apple,
  Shirt,
  Smile,
  DoorOpen,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import phoneMockup from "@/assets/phone-mockup.png";

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
  { name: "Car seats", icon: Shield },
  { name: "Pacifiers", icon: CircleDot },
  { name: "Crib heights", icon: Bed },
  { name: "Breast milk", icon: Coffee },
  { name: "Formula", icon: FlaskConical },
  { name: "Baby food", icon: Apple },
  { name: "Swaddles", icon: Shirt },
  { name: "Toothbrush", icon: Smile },
  { name: "Baby gates", icon: DoorOpen },
];

const features = [
  {
    title: "Quiet reminders",
    description:
      "No overwhelming notifications. Gentle, timely nudges when something actually needs attention.",
  },
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
                <span className="text-accent">safety</span>
                <br />
                milestone again.
              </h1>

              <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-muted-foreground">
                Add a car seat, pacifier, crib, breast milk, formula, baby food,
                swaddle, toothbrush, or baby gate — Safe & Sound tells you
                exactly when to replace it, size it up, or check the fit. Quiet,
                kind reminders. No noise.
              </p>

              <a
                href="/auth"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-body text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Right: Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                <img
                  src={phoneMockup}
                  alt="Safe & Sound app preview showing baby safety reminders and milestone tracking"
                  className="h-auto w-full max-w-[320px] rounded-[2.5rem] shadow-2xl shadow-foreground/5 lg:max-w-[380px]"
                  width={768}
                  height={1024}
                />
                {/* Decorative blur behind phone */}
                <div className="absolute -inset-4 -z-10 rounded-full bg-sand/30 blur-3xl" />
              </div>
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
            <p className="mt-4 font-body text-lg text-muted-foreground">
              Nine essential categories. One calm place to keep them all safe.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.name}
                  className="group flex flex-col items-center rounded-3xl border border-border/60 bg-card p-6 text-center transition-all hover:border-border hover:shadow-lg hover:shadow-foreground/5"
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary transition-colors group-hover:bg-primary/10">
                    <Icon className="h-7 w-7 text-forest transition-colors group-hover:text-primary" />
                  </div>
                  <span className="font-body text-sm font-medium text-foreground">
                    {cat.name}
                  </span>
                </div>
              );
            })}
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

      {/* CTA Section */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Ready to breathe easier?
          </h2>
          <p className="mt-4 font-body text-lg text-muted-foreground">
            Join thousands of parents who never miss a safety milestone.
          </p>
          <a
            href="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-body text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
