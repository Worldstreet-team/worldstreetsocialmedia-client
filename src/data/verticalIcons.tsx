import {
  Briefcase,
  ChartLineUp,
  Cpu,
  CurrencyBtc,
  FilmSlate,
  GameController,
  GraduationCap,
  Heartbeat,
  MegaphoneSimple,
  MusicNotes,
  Newspaper,
  PaintBrush,
  SoccerBall,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";

/**
 * One glyph per content vertical, from the sanctioned Phosphor set.
 *
 * The Go Live sheet uses an emoji map for the same job, which the design
 * system forbids for UI icons. This is the version the rest of the app
 * should use; that sheet is worth retrofitting onto this later.
 */
export const VERTICAL_ICON: Record<string, Icon> = {
  markets: ChartLineUp,
  web3: CurrencyBtc,
  business: Briefcase,
  tech: Cpu,
  news: Newspaper,
  sports: SoccerBall,
  gaming: GameController,
  entertainment: FilmSlate,
  music: MusicNotes,
  lifestyle: Sparkle,
  health: Heartbeat,
  arts: PaintBrush,
  creator: MegaphoneSimple,
  learning: GraduationCap,
};
