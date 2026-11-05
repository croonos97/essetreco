// Ícone 2D de gota azul translúcida com o rótulo "LEITE MATERNO" (substitui qualquer imagem de mulher/bebê).
// Uso no vídeo: sobreposição (fora do canvas 3D), entra com "pop" como os cabeçalhos.
export const IconeGota: React.FC<{ escala?: number; pop?: number; rotulo?: string; x?: number; y?: number }> = ({ escala = 1, pop = 1, rotulo = "LEITE MATERNO", x = 0, y = 0 }) => {
  const s = escala * (0.6 + 0.4 * pop);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${s})`, transformOrigin: "50% 50%", opacity: Math.min(1, pop * 1.5), display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={180} height={230} viewBox="0 0 180 230">
        <defs>
          <linearGradient id="gotaG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D9F1FF" stopOpacity={0.95} />
            <stop offset="1" stopColor="#5FB4F2" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <path d="M90 8 C 90 8, 165 105, 165 145 A 75 75 0 0 1 15 145 C 15 105, 90 8, 90 8 Z" fill="url(#gotaG)" stroke="#FFFFFF" strokeWidth={7} />
        <ellipse cx={62} cy={140} rx={14} ry={26} fill="#FFFFFF" opacity={0.7} />
      </svg>
      <div style={{ font: "900 46px Inter, sans-serif", color: "#FFFFFF", WebkitTextStroke: "3px #10243A", marginTop: 6, letterSpacing: 1 }}>{rotulo}</div>
    </div>
  );
};
