/**
 * IANA timezone → ISO 3166-1 alpha-2, for geo-tagging telemetry without an
 * IP lookup: `Intl.DateTimeFormat().resolvedOptions().timeZone` is available
 * on every client, free, and accurate to the country for the vast majority
 * of zones. Edge geo headers (cf-ipcountry) override this server-side when
 * the app sits behind a CDN. Unknown zones simply go untagged.
 */
export const TZ_COUNTRY: Record<string, string> = {
	// Africa
	"Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Abidjan": "CI",
	"Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG",
	"Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Tunis": "TN",
	"Africa/Addis_Ababa": "ET", "Africa/Dar_es_Salaam": "TZ",
	"Africa/Kampala": "UG", "Africa/Kinshasa": "CD", "Africa/Luanda": "AO",
	"Africa/Dakar": "SN", "Africa/Bamako": "ML", "Africa/Douala": "CM",
	"Africa/Harare": "ZW", "Africa/Lusaka": "ZM", "Africa/Gaborone": "BW",
	"Africa/Windhoek": "NA", "Africa/Kigali": "RW", "Africa/Tripoli": "LY",
	"Africa/Khartoum": "SD", "Africa/Mogadishu": "SO",
	// Americas
	"America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
	"America/Los_Angeles": "US", "America/Phoenix": "US",
	"America/Anchorage": "US", "America/Detroit": "US",
	"America/Indiana/Indianapolis": "US", "Pacific/Honolulu": "US",
	"America/Toronto": "CA", "America/Vancouver": "CA",
	"America/Edmonton": "CA", "America/Winnipeg": "CA",
	"America/Halifax": "CA", "America/St_Johns": "CA",
	"America/Mexico_City": "MX", "America/Tijuana": "MX",
	"America/Monterrey": "MX", "America/Bogota": "CO", "America/Lima": "PE",
	"America/Sao_Paulo": "BR", "America/Manaus": "BR", "America/Bahia": "BR",
	"America/Fortaleza": "BR", "America/Recife": "BR",
	"America/Argentina/Buenos_Aires": "AR", "America/Santiago": "CL",
	"America/Caracas": "VE", "America/Guayaquil": "EC",
	"America/La_Paz": "BO", "America/Montevideo": "UY",
	"America/Asuncion": "PY", "America/Panama": "PA",
	"America/Costa_Rica": "CR", "America/Guatemala": "GT",
	"America/Havana": "CU", "America/Santo_Domingo": "DO",
	"America/Port-au-Prince": "HT", "America/Jamaica": "JM",
	"America/Puerto_Rico": "PR",
	// Europe
	"Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR",
	"Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT",
	"Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Vienna": "AT",
	"Europe/Zurich": "CH", "Europe/Lisbon": "PT", "Europe/Stockholm": "SE",
	"Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI",
	"Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
	"Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Athens": "GR",
	"Europe/Istanbul": "TR", "Europe/Kyiv": "UA", "Europe/Moscow": "RU",
	"Europe/Belgrade": "RS", "Europe/Zagreb": "HR", "Europe/Bratislava": "SK",
	"Europe/Vilnius": "LT", "Europe/Riga": "LV", "Europe/Tallinn": "EE",
	// Middle East
	"Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA",
	"Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
	"Asia/Jerusalem": "IL", "Asia/Beirut": "LB", "Asia/Amman": "JO",
	"Asia/Baghdad": "IQ", "Asia/Tehran": "IR",
	// Asia
	"Asia/Karachi": "PK", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
	"Asia/Dhaka": "BD", "Asia/Colombo": "LK", "Asia/Kathmandu": "NP",
	"Asia/Bangkok": "TH", "Asia/Jakarta": "ID", "Asia/Makassar": "ID",
	"Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Manila": "PH",
	"Asia/Ho_Chi_Minh": "VN", "Asia/Phnom_Penh": "KH", "Asia/Yangon": "MM",
	"Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Shanghai": "CN",
	"Asia/Chongqing": "CN", "Asia/Urumqi": "CN", "Asia/Seoul": "KR",
	"Asia/Tokyo": "JP", "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ",
	"Asia/Baku": "AZ", "Asia/Tbilisi": "GE", "Asia/Yerevan": "AM",
	// Oceania
	"Australia/Sydney": "AU", "Australia/Melbourne": "AU",
	"Australia/Brisbane": "AU", "Australia/Perth": "AU",
	"Australia/Adelaide": "AU", "Pacific/Auckland": "NZ", "Pacific/Fiji": "FJ",
	// Atlantic
	"Atlantic/Reykjavik": "IS", "Atlantic/Canary": "ES",
	"Atlantic/Azores": "PT",
};

let cached: string | null | undefined;

/** Viewer country from the runtime timezone; null when unmappable. */
export function detectCountry(): string | null {
	if (cached !== undefined) return cached;
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		cached = TZ_COUNTRY[tz] ?? null;
	} catch {
		cached = null;
	}
	return cached;
}
