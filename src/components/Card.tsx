import { motion } from "motion/react";
import { CARDS, imagePath, type CardType } from "../cards";
export function CardFace({ type }: { type: CardType }) {
  return (
    <img
      className="approved-card-image"
      src={imagePath(type)}
      alt={CARDS[type].name}
      draggable={false}
    />
  );
}
export function CardButton({
  type,
  onClick,
  disabled = false,
  index = 0,
  animate = true,
  selected = false,
}: {
  type: CardType;
  onClick?: () => void;
  disabled?: boolean;
  index?: number;
  animate?: boolean;
  selected?: boolean;
}) {
  const definition = CARDS[type];
  return (
    <motion.button
      type="button"
      className={`playing-card full-art-card ${selected ? "selected" : ""}`}
      style={{ "--card-color": definition.color } as React.CSSProperties}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${definition.name}. ${definition.description}`}
      aria-pressed={selected || undefined}
      title={definition.description}
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: animate ? 0.18 : 0,
        delay: animate ? Math.min(index, 6) * 0.025 : 0,
      }}
      whileTap={animate && !disabled ? { scale: 0.97 } : undefined}
    >
      <CardFace type={type} />
      {selected && (
        <span className="selection-badge" aria-hidden="true">
          ✓
        </span>
      )}
    </motion.button>
  );
}
