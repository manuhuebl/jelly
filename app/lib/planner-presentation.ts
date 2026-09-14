import type { Product } from "../data/planner-data";

export type ColorPair = { background: string; foreground: string };

// Presentation only: never rewrite persisted products or planning records.
const PRODUCT_PALETTE: Record<string, ColorPair> = {
  "bench-center": { background: "#c2bd78", foreground: "#344720" },
  "bench-end-right": { background: "#d7d5af", foreground: "#344720" },
  "bench-end-left": { background: "#e4dfb4", foreground: "#344720" },
  "bench-without-backrest": { background: "#b3ac63", foreground: "#344720" },
  len: { background: "#482049", foreground: "#f0dfa4" },
  "len-4-leg": { background: "#542550", foreground: "#f0dfa4" },
  "len-m": { background: "#5d2c58", foreground: "#f0dfa4" },
  "len-s": { background: "#65345f", foreground: "#f0dfa4" },
  fib: { background: "#ed5814", foreground: "#13165f" },
  "fib-m": { background: "#fc6c1a", foreground: "#13165f" },
  "fib-s": { background: "#ff8635", foreground: "#13165f" },
  ony: { background: "#feb5ed", foreground: "#b40035" },
  inu: { background: "#90a61b", foreground: "#123919" },
  "inu-m": { background: "#a8bf32", foreground: "#123919" },
  "inu-s": { background: "#bbd64a", foreground: "#123919" },
  piu: { background: "#95d9ac", foreground: "#67227d" },
  "banana-lamp-big": { background: "#e9bc08", foreground: "#69332e" },
  "banana-lamp-small": { background: "#fdd21a", foreground: "#69332e" }
};

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return 1;
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getColorForeground(background: string) {
  const light = luminance(background);
  return ["#13165f", "#123919", "#67227d", "#f0dfa4"].sort((a, b) => {
    const contrast = (color: string) => {
      const other = luminance(color);
      return (Math.max(light, other) + 0.05) / (Math.min(light, other) + 0.05);
    };
    return contrast(b) - contrast(a);
  })[0];
}

export function getProductColors(product: Pick<Product, "id" | "color">): ColorPair {
  return PRODUCT_PALETTE[product.id] ?? {
    background: product.color,
    foreground: getColorForeground(product.color)
  };
}

const EVENT_PALETTE: Record<string, ColorPair> = {
  custom: { background: "#fc6c1a", foreground: "#13165f" },
  deadline: { background: "#1f1f1d", foreground: "#ffffff" },
  event: { background: "#a76bdb", foreground: "#270b42" },
  ooo: { background: "#d7d5af", foreground: "#344720" },
  "social media": { background: "#feb5ed", foreground: "#a02457" },
  task: { background: "#90a61b", foreground: "#123919" }
};

export function getEventColors(event: { type: string; color?: string }): ColorPair {
  if (event.color) {
    return { background: event.color, foreground: getColorForeground(event.color) };
  }
  return EVENT_PALETTE[event.type] ?? EVENT_PALETTE.custom;
}
