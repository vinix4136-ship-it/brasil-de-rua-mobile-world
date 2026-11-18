import { createFileRoute } from "@tanstack/react-router";
import GameView from "@/game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Grau Total: Vila Nova — GTA brasileiro no celular" },
      { name: "description", content: "Dirija pelas ruas da Vila Nova, faça corridas, junte moedas e fuja da polícia. Jogo 3D para celular." },
      { property: "og:title", content: "Grau Total: Vila Nova" },
      { property: "og:description", content: "GTA brasileiro em 3D para celular: corridas, grana e fuga da polícia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameView,
});
