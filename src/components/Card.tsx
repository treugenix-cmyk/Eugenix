import { motion } from "motion/react";
import { CARDS, type CardType } from "../cards";
export function CardFace({ type }: { type: CardType }) {
  const definition = CARDS[type];
  return (
    <>
      <span className="card-label">{definition.short}</span>
      <img
        src={`${import.meta.env.BASE_URL}cards/${type}.svg`}
        alt=""
        draggable={false}
      />
      <strong>{definition.name}</strong>
    </>
  );
}
export function CardButton({
  type,
  onClick,
  disabled = false,
  index = 0,
  animate = true,
}: {
  type: CardType;
  onClick?: () => void;
  disabled?: boolean;
  index?: number;
  animate?: boolean;
}) {
  const definition = CARDS[type];
  return (
    <motion.button
      type="button"
      className="playing-card"
      style={{ "--card-color": definition.color } as React.CSSProperties}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${definition.name}. ${definition.description}`}
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
    </motion.button>
  );
}
