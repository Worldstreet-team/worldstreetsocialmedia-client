/**
 * One tap of physical feedback where the platform offers it.
 *
 * Android Chrome honours navigator.vibrate after a user gesture; iOS Safari
 * has never supported it and the checkbox-switch exploit was patched in
 * 26.5, so iOS deliberately gets nothing rather than a hack that Apple
 * breaks every release. Callers just call haptic() on the gesture and let
 * the platform decide.
 */
export function haptic(pattern: number | number[] = 10) {
	try {
		navigator.vibrate?.(pattern);
	} catch {
		// Vibration is a garnish; never let it throw into a handler.
	}
}
