type CategoryBadgeProps = {
  icon: React.ComponentType<{ className?: string }>;
  illustration?: string;
  className?: string;
};

/**
 * Small circular category badge used anywhere a product category needs a
 * visual, not just a label — shows the same illustrated artwork used on the
 * public marketing home page (src/routes/index.tsx) when one exists for
 * this category, falling back to the category's plain outline icon
 * otherwise (see CATEGORIES in @/lib/productCategories).
 */
export function CategoryBadge({
  icon: Icon,
  illustration,
  className = "h-9 w-9",
}: CategoryBadgeProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand/50 ${className}`}
    >
      {illustration ? (
        <img
          src={illustration}
          alt=""
          className="h-full w-full object-contain p-1"
          loading="lazy"
        />
      ) : (
        <Icon className="h-[55%] w-[55%] text-accent" />
      )}
    </span>
  );
}
