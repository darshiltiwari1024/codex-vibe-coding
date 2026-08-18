import type { Metadata } from "next";
import Game from "./Game.tsx";

export const metadata: Metadata = {
  title: "SINGULARITY — The Intelligence Race",
  description: "Build a tiny 2015 AI lab into the organization that shapes the intelligence age.",
};

export default function Home() { return <Game />; }
