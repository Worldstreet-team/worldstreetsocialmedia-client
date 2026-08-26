/**
 * Post decoder — the "what is actually going on here" layer under the
 * translate panel. Pure and deterministic: known tickers, finance/crypto
 * slang, topic tags, and the numeric signals (percentages, money amounts),
 * plus a tone read from bull/bear vocabulary. No network, no model.
 */

export interface DecodedEntity {
	term: string;
	kind: "ticker" | "slang" | "topic";
	explanation: string;
}

export interface DecodeResult {
	entities: DecodedEntity[];
	signals: string[];
	tone: "bullish" | "bearish" | "neutral";
}

const TICKERS: Record<string, string> = {
	BTC: "Bitcoin the largest cryptocurrency",
	ETH: "Ethereum smart-contract blockchain",
	SOL: "Solana high-throughput blockchain",
	XRP: "XRP Ripple's settlement token",
	BNB: "BNB Binance exchange token",
	DOGE: "Dogecoin meme cryptocurrency",
	ADA: "Cardano's ADA token",
	XAU: "Gold (spot)",
	XAUUSD: "Gold priced in US dollars",
	XAG: "Silver (spot)",
	US30: "Dow Jones Industrial Average index",
	NAS100: "Nasdaq-100 index",
	NDX: "Nasdaq-100 index",
	SPX: "S&P 500 index",
	US500: "S&P 500 index",
	EURUSD: "Euro / US dollar currency pair",
	GBPUSD: "British pound / US dollar pair",
	USDJPY: "US dollar / Japanese yen pair",
	GBPJPY: "British pound / Japanese yen pair",
	USOIL: "West Texas crude oil",
	WTI: "West Texas crude oil",
	UKOIL: "Brent crude oil",
	TSLA: "Tesla stock",
	AAPL: "Apple stock",
	NVDA: "Nvidia stock",
	AMZN: "Amazon stock",
	MSFT: "Microsoft stock",
	META: "Meta (Facebook) stock",
	GOOGL: "Alphabet (Google) stock",
};

/** Multi-word phrases first so they win over their parts. */
const SLANG: [string, string][] = [
	["dead cat bounce", "Brief recovery inside a larger decline"],
	["short squeeze", "Rapid rise forcing short sellers to buy back"],
	["diamond hands", "Holding through volatility without selling"],
	["paper hands", "Selling quickly at the first sign of trouble"],
	["rug pull", "Insiders draining a project and abandoning it"],
	["to the moon", "Expecting a very large price rise"],
	["buy the dip", "Buying after a price drop, expecting recovery"],
	["stop loss", "Order that auto-sells to cap a loss"],
	["take profit", "Order that auto-sells to lock in gains"],
	["bull run", "Sustained period of rising prices"],
	["bear market", "Extended period of falling prices"],
	["bull market", "Extended period of rising prices"],
	["no cap", "No exaggeration being serious"],
	["hodl", "Hold long-term, never sell"],
	["ath", "All-time high price"],
	["atl", "All-time low price"],
	["fomo", "Fear of missing out chasing a move late"],
	["fud", "Fear, uncertainty and doubt negative spin"],
	["dca", "Dollar-cost averaging buying fixed amounts on schedule"],
	["mooning", "Rising very fast in price"],
	["pump", "Sharp, often hyped, price rise"],
	["dump", "Sharp sell-off"],
	["whale", "Holder large enough to move the market"],
	["bagholder", "Stuck holding an asset after its crash"],
	["rekt", "Suffered heavy losses"],
	["degen", "High-risk, high-frequency speculator"],
	["leverage", "Trading with borrowed funds amplifies both ways"],
	["margin", "Collateral for a leveraged position"],
	["breakout", "Price pushing through a resistance level"],
	["support", "Price level where buying tends to step in"],
	["resistance", "Price level where selling tends to step in"],
	["liquidity", "How easily an asset trades without moving price"],
	["spread", "Gap between buy and sell price"],
	["pips", "Smallest forex price increments"],
	["roi", "Return on investment"],
	["apy", "Annual percentage yield"],
	["staking", "Locking crypto to earn rewards"],
	["airdrop", "Free token distribution to wallets"],
	["wagmi", "“We're all gonna make it” collective optimism"],
	["ngmi", "“Not gonna make it” doubting a strategy"],
	["bullish", "Expecting prices to rise"],
	["bearish", "Expecting prices to fall"],
];

const BULL_WORDS = /\b(bullish|moon|mooning|pump|breakout|rally|ath|long|calls|buy the dip|to the moon|bull run|bull market)\b/gi;
const BEAR_WORDS = /\b(bearish|dump|crash|rekt|capitulat\w*|selloff|sell-off|shorts?|puts|bear market|rug pull|atl)\b/gi;

export function decodePost(text: string): DecodeResult {
	const entities: DecodedEntity[] = [];
	const seen = new Set<string>();
	const push = (e: DecodedEntity) => {
		const k = e.term.toLowerCase();
		if (seen.has(k) || entities.length >= 12) return;
		seen.add(k);
		entities.push(e);
	};

	// $cashtags
	for (const m of text.matchAll(/\$([A-Za-z]{2,10})\b/g)) {
		const sym = m[1].toUpperCase();
		push({
			term: `$${sym}`,
			kind: "ticker",
			explanation: TICKERS[sym] ?? "Traded symbol",
		});
	}

	// slang (word-boundary, case-insensitive, longest phrases first)
	const lower = text.toLowerCase();
	for (const [phrase, explanation] of SLANG) {
		const re = new RegExp(
			`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
			"i",
		);
		if (re.test(lower)) push({ term: phrase, kind: "slang", explanation });
	}

	// #topics
	for (const m of text.matchAll(/#([A-Za-z][A-Za-z0-9_]{1,30})/g)) {
		push({ term: `#${m[1]}`, kind: "topic", explanation: "Topic tag" });
	}

	// numeric signals
	const signals: string[] = [];
	for (const m of text.matchAll(/[+-]?\d+(?:\.\d+)?\s?%/g)) {
		if (signals.length < 6) signals.push(m[0].replace(/\s/g, ""));
	}
	for (const m of text.matchAll(/\$\d[\d,]*(?:\.\d+)?\s?[kKmMbB]?\b/g)) {
		// skip cashtag-looking matches ($BTC handled above; these need a digit)
		if (signals.length < 8) signals.push(m[0].replace(/\s/g, ""));
	}

	const bulls = (text.match(BULL_WORDS) ?? []).length;
	const bears = (text.match(BEAR_WORDS) ?? []).length;
	const tone: DecodeResult["tone"] =
		bulls > bears ? "bullish" : bears > bulls ? "bearish" : "neutral";

	return { entities, signals, tone };
}
