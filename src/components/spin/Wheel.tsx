import { fitLabel, lineY, PRIZE_COLORS, segmentMiddle, segmentPath, WHEEL } from "./wheel-geometry";

/**
 * The prize wheel as crew see it (OP-16's live preview of CR-28): equal segments in the
 * prize list's order with the red pointer at the top. The labels are the reader's language's.
 * One picture with its prizes for a name, so a screen reader hears the list rather than the
 * shapes. Not a client component: it holds no state, it draws what it is given.
 */
export function Wheel({ labels, name, size = 240 }: { labels: readonly string[]; name: string; size?: number }) {
  const count = labels.length;
  const c = WHEEL.centre;
  return (
    <div className="relative mx-auto max-w-full" style={{ width: size }}>
      <svg
        aria-hidden="true"
        viewBox="0 0 34 40"
        className="absolute -top-3 left-1/2 z-1 h-8.5 w-7 -translate-x-1/2 drop-shadow-sm"
      >
        <path d="M5 3h24a3 3 0 0 1 2.4 4.7L19.4 35a3 3 0 0 1-4.8 0L2.6 7.7A3 3 0 0 1 5 3z" className="fill-red" />
      </svg>
      <svg role="img" aria-label={name} viewBox={`0 0 ${WHEEL.size} ${WHEEL.size}`} className="block h-auto w-full">
        <circle cx={c} cy={c} r={148} className="fill-paper stroke-line" strokeWidth={1} />
        {labels.map((label, index) => {
          const { lines, fontSize } = fitLabel(label, count);
          return (
            <g key={index}>
              <path
                d={segmentPath(index, count)}
                fill={PRIZE_COLORS[index % PRIZE_COLORS.length]}
                className="stroke-paper"
                strokeWidth={2}
              />
              <g transform={`rotate(${segmentMiddle(index, count)} ${c} ${c})`}>
                {lines.map((line, row) => (
                  <text
                    key={row}
                    x={c}
                    y={lineY(row, fontSize)}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight={900}
                    className="fill-ink font-sans"
                  >
                    {line}
                  </text>
                ))}
              </g>
            </g>
          );
        })}
        <circle cx={c} cy={c} r={26} className="fill-ink" />
        <path
          d="M150 137l3.9 8 8.8 1.3-6.4 6.2 1.5 8.8-7.8-4.1-7.8 4.1 1.5-8.8-6.4-6.2 8.8-1.3z"
          className="fill-gold"
        />
      </svg>
    </div>
  );
}
