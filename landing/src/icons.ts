// Íconos del set de iManager (stroke 2, 24×24). `.ic-fill` se pinta de amarillo con la clase `on`.
export const ICONS = {
  "mas": "<rect class=\"ic-accent\" x=\"3\" y=\"9.75\" width=\"4.5\" height=\"4.5\" rx=\"1.25\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"13\" cy=\"12\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19.5\" cy=\"12\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/>",
} as const;

export type IconName = keyof typeof ICONS;
