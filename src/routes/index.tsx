import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant/300.css";
import "@fontsource/cormorant/300-italic.css";
import catCarseat from "@/assets/hd-carseat.png";
import catPacifier from "@/assets/hd-pacifier.png";
import catFormula from "@/assets/hd-formula.png";
import catBouncer from "@/assets/hd-bouncer.png";
import catBlocks from "@/assets/hd-blocks.png";
import catCrib from "@/assets/hd-crib.png";
import catStroller from "@/assets/hd-stroller.png";
import catPacknplay from "@/assets/hd-packnplay.png";
import catSwaddle from "@/assets/hd-swaddle.png";
import catCarrier from "@/assets/hd-carrier.png";
import catBreastmilk from "@/assets/hd-breastmilk.png";
import catBabyfood from "@/assets/hd-babyfood.png";

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
      { property: "og:url", content: "https://peace-of-mine.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://peace-of-mine.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify([
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Peace of Mine",
          url: "https://peace-of-mine.lovable.app/",
          description: "Baby safety tracking — recalls, milestones, and product safety reminders for parents.",
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Peace of Mine",
          url: "https://peace-of-mine.lovable.app/",
          logo: "https://peace-of-mine.lovable.app/app-icon-1024.png",
        },
      ]),
    }],
  }),
  component: Index,
});

const categories = [
  { name: "Car Seats", image: catCarseat },
  { name: "Cribs", image: catCrib },
  { name: "Strollers", image: catStroller },
  { name: "Carriers", image: catCarrier },
  { name: "Pack 'n Plays", image: catPacknplay },
  { name: "Swaddles", image: catSwaddle },
  { name: "Pacifiers", image: catPacifier, scale: "scale-[0.78]" },
  { name: "Formula", image: catFormula },
  { name: "Breast Milk", image: catBreastmilk },
  { name: "Baby Food", image: catBabyfood },
  { name: "Activity Gear", image: catBouncer },
  { name: "Toys", image: catBlocks },
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
                  fontFamily: "'Cormorant', Georgia, serif",
                  fontWeight: 300,
                  color: "#2B2927",
                }}
                className="text-5xl leading-[1.08] sm:text-6xl lg:text-7xl"
              >
                Stay on top of every{" "}
                <em style={{ fontStyle: "italic", color: "#586C81" }}>safety</em>
                <br />
                milestone.
              </h1>

              <p
                style={{ color: "#605C58" }}
                className="mt-12 max-w-lg font-body text-base font-medium leading-relaxed sm:text-lg"
              >
                Track your baby's products and milestones in one place, with reminders to check for
                upcoming replacements, size changes, and fit as your child grows — plus alerts if a
                product you're tracking turns up in an official recall database.
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
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section — hand-drawn circles */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2
              style={{
                fontFamily: "'Cormorant', Georgia, serif",
                fontWeight: 300,
                color: "#2B2927",
              }}
              className="text-4xl leading-[1.08] tracking-tight sm:text-5xl"
            >
              Track what matters
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-14 lg:grid-cols-4">
            {categories.map((cat) => (
              <div key={cat.name} className="flex flex-col items-center text-center">
                <div className="flex aspect-square w-full max-w-[180px] items-center justify-center overflow-hidden rounded-full bg-[#F5F1E8] p-6">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    width={512}
                    height={512}
                    loading="lazy"
                    className={`h-full w-full object-contain ${"scale" in cat ? (cat as { scale?: string }).scale : ""}`}
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

      {/* Closing line */}
      <section className="w-full px-4 pb-16 sm:px-6 lg:px-8">
        <p
          style={{
            fontFamily: "'Cormorant', Georgia, serif",
            fontWeight: 300,
            color: "#605C58",
          }}
          className="mx-auto max-w-2xl text-center text-lg leading-[1.25] sm:text-xl"
        >
          Peace of Mine helps you remember the little things that are easy to forget and the
          things you haven't thought of yet.
        </p>
      </section>

      <Footer />
    </div>
  );
}
