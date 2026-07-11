import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
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
import catCrib from "@/assets/hd-crib.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Peace of Mine — Baby Safety Tracking" },
      {
        name: "description",
        content:
          "Stay on top of safety milestones. Track car seats, pacifiers, cribs, and more with quiet, kind reminders.",
      },
      { property: "og:title", content: "Peace of Mine — Baby Safety Tracking" },
      {
        property: "og:description",
        content:
          "Stay on top of safety milestones. Track car seats, pacifiers, cribs, and more with quiet, kind reminders.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

const categories = [
  { name: "Car seats", image: catCarseat },
  { name: "Cribs", image: catCrib },
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
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 400,
                  color: "#2B2927",
                }}
                className="text-5xl leading-[1.08] sm:text-6xl lg:text-7xl"
              >
                Stay on top of every{" "}
                <em style={{ fontStyle: "italic", color: "#9BB2A7" }}>safety</em>
                <br />
                milestone.
              </h1>

              <p
                style={{ fontWeight: 300, color: "#605C58" }}
                className="mt-12 max-w-lg font-body text-lg leading-relaxed"
              >
                Track your baby's products and milestones in one place, with reminders to check for
                upcoming replacements, size changes, and fit as your child grows.
              </p>

              <Link
                to="/auth"
                style={{
                  border: "1px solid #B8A899",
                  color: "#2B2927",
                  fontWeight: 400,
                  letterSpacing: "0.03em",
                }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-transparent px-8 py-4 font-body text-base transition-all duration-150 hover:bg-card"
              >
                Get started free
              </Link>
              <p
                className="mt-5 text-[11px] font-medium tracking-[0.1em] text-muted-foreground/60"
                style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  textTransform: "uppercase",
                }}
              >
                Recommendations informed by AAP, CPSC, and other trusted safety guidance
              </p>

              <div className="mt-16 grid max-w-lg grid-cols-2 gap-10">
                <div>
                  <h2
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontWeight: 500,
                      color: "#2B2927",
                    }}
                    className="text-xl"
                  >
                    Track everything
                  </h2>
                  <p
                    style={{ fontWeight: 300, color: "#605C58" }}
                    className="mt-2 font-body text-sm leading-relaxed"
                  >
                    We monitor the details and organize them in one place.
                  </p>
                </div>
                <div>
                  <h2
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontWeight: 500,
                      color: "#2B2927",
                    }}
                    className="text-xl"
                  >
                    Informed Guidance
                  </h2>
                  <p
                    style={{ fontWeight: 300, color: "#605C58" }}
                    className="mt-2 font-body text-sm leading-relaxed"
                  >
                    We check your products against CPSC, FDA, and other official recall databases
                    and let you know if there's a match.
                  </p>
                </div>
              </div>
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
                <div className="flex aspect-square w-full max-w-[180px] items-center justify-center overflow-hidden rounded-full bg-[#F5F1E8] p-6">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    width={512}
                    height={512}
                    loading="lazy"
                    className="h-full w-full object-contain"
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

      <Footer />
    </div>
  );
}
