/*
 * KubeVirt helpers for noVNC
 */

import { isKeyboardLayout, keyMaps, resolveCharMapping }
    from '@kubevirt-ui-ext/vnc-keymaps';
import RFB from '../core/rfb.js';
import * as Log from '../core/util/logging.js';

export const EN_US = 'en-us';
export const KEYBOARD_DELAY = 50;
// Same localStorage key as kubevirt-plugin AccessConsoles
export const VNC_FAVORITE_KEYMAPS_KEY = 'VNC_FAVORITE_KEYMAPS';
export const SHOW_ALL_LAYOUTS_VALUE = '__show_all__';
export const SHOW_LESS_LAYOUTS_VALUE = '__show_less__';
export const COLLAPSED_LAYOUT_COUNT = 6;

/**
 * Estimated millions of people using each keyboard layout (rough).
 * Used only to order the collapsed layout list.
 */
export const LAYOUT_USERS_MLN = {
    'ar': 300,
    'bepo': 1,
    'cz': 10,
    'da': 6,
    'de': 100,
    'de-ch': 5,
    'en-gb': 70,
    'en-us': 400,
    'es': 150,
    'et': 30,
    'fi': 5,
    'fo': 0,
    'fr': 80,
    'fr-be': 8,
    'fr-ca': 8,
    'fr-ch': 2,
    'hr': 4,
    'hu': 10,
    'is': 0,
    'it': 60,
    'ja': 120,
    'lt': 3,
    'lv': 2,
    'mk': 2,
    'nl': 25,
    'pl': 40,
    'pt': 15,
    'pt-br': 200,
    'ru': 150,
    'th': 50,
    'tr': 70,
};

/**
 * Regular layouts for the keyboard select (en-us excluded).
 * Sorted by estimated users descending, then description.
 * @returns {[string, import('@kubevirt-ui-ext/vnc-keymaps').KeyMapDef][]}
 */
export function getRegularLayouts() {
    return Object.entries(keyMaps)
        // en-us has special treatment
        .filter(([value]) => value !== EN_US)
        .sort(([valueA, a], [valueB, b]) => {
            const diff = (LAYOUT_USERS_MLN[valueB] ?? 0) -
                (LAYOUT_USERS_MLN[valueA] ?? 0);
            if (diff !== 0) {
                return diff;
            }
            return a.description.localeCompare(b.description);
        });
}

/**
 * Favourites from localStorage (shared with kubevirt-plugin).
 * @returns {string[]}
 */
export function getFavoriteKeymaps() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(VNC_FAVORITE_KEYMAPS_KEY));
    } catch {
        saved = null;
    }
    const knownKeymaps = new Set(Object.keys(keyMaps));
    return (Array.isArray(saved) ? saved : [])
        .filter(entry => knownKeymaps.has(entry));
}

/**
 * Default selection: first favourite, else en-us.
 * @returns {string}
 */
export function getDefaultKeyboard() {
    return getFavoriteKeymaps()[0] ?? EN_US;
}

/**
 * Toggle favourite status for a layout (same rules as kubevirt-plugin).
 * @param {string} value layout id
 * @returns {string[]} updated favourites
 */
export function updateFavorite(value) {
    if (!isKeyboardLayout(value)) {
        return getFavoriteKeymaps();
    }
    const favorites = getFavoriteKeymaps();
    if (!favorites.includes(value)) {
        // put the new value first - main use case: add/remove EN_US on top
        // of existing favorites to change the defaults
        localStorage.setItem(
            VNC_FAVORITE_KEYMAPS_KEY,
            JSON.stringify([value, ...favorites]));
        return getFavoriteKeymaps();
    }

    if (favorites.length === 1) {
        localStorage.removeItem(VNC_FAVORITE_KEYMAPS_KEY);
        return [];
    }

    localStorage.setItem(
        VNC_FAVORITE_KEYMAPS_KEY,
        JSON.stringify(favorites.filter(keymap => keymap !== value)));
    return getFavoriteKeymaps();
}

/**
 * Layouts for the select, grouped like VncKeymapDropdown.
 * Favourites first (if any), then en-us, then regular layouts by usage.
 * When collapsed, only the top layouts are returned plus a "show all" flag.
 * Duplicates are avoided so <select> values stay unique.
 * @param {{showAll?: boolean}} [options]
 * @returns {{favorites: [string, object][], standard: [string, object][],
 *           hasMore: boolean}}
 */
export function getKeyboardLayoutGroups({ showAll = false } = {}) {
    const favorites = getFavoriteKeymaps();
    const favoriteSet = new Set(favorites);
    const favoriteEntries = favorites
        .filter(value => keyMaps[value])
        .map(value => [value, keyMaps[value]]);

    const regular = getRegularLayouts()
        .filter(([value]) => !favoriteSet.has(value));
    const hasMore = regular.length > COLLAPSED_LAYOUT_COUNT;
    const visibleRegular = showAll ?
        regular : regular.slice(0, COLLAPSED_LAYOUT_COUNT);

    const standard = [];
    if (!favoriteSet.has(EN_US)) {
        standard.push([EN_US, keyMaps[EN_US]]);
    }
    standard.push(...visibleRegular);
    return { favorites: favoriteEntries, standard, hasMore: hasMore && !showAll };
}

const sleep = (delay = KEYBOARD_DELAY) =>
    new Promise(resolve => setTimeout(resolve, delay));

const canExecuteCommands = rfb =>
    rfb?._rfbConnectionState === 'connected' && !rfb._viewOnly;

async function typeAndWait(rfb, keysym, down, scanCode) {
    RFB.messages.QEMUExtendedKeyEvent(rfb._sock, keysym, down, scanCode);
    // long text is getting truncated without a delay
    await sleep(KEYBOARD_DELAY);
}

/**
 * Type clipboard text into the VNC session char-by-char using the selected keymap.
 * @param {RFB} rfb active RFB connection
 * @param {object} options
 * @param {string} options.selectedKeyboard keymap id from @kubevirt-ui-ext/vnc-keymaps
 * @param {(chars: string[]) => void} [options.onUnsupportedChars] called instead of typing
 * @param {boolean} [options.shouldFocusOnConsole=true]
 */
export async function sendPaste(rfb, {
    selectedKeyboard,
    onUnsupportedChars,
    shouldFocusOnConsole = true,
} = {}) {
    if (!selectedKeyboard || !keyMaps[selectedKeyboard]) {
        return;
    }
    if (!canExecuteCommands(rfb)) {
        return;
    }

    let clipboardText;
    try {
        clipboardText = await navigator.clipboard.readText();
    } catch (err) {
        Log.Error("Failed to read from clipboard: ", err);
        return;
    }
    if (typeof clipboardText !== 'string') {
        return;
    }

    const keyMap = keyMaps[selectedKeyboard];
    const mappedChars = [...clipboardText].map(codePoint =>
        resolveCharMapping(codePoint, keyMap.map));

    const unsupportedChars = mappedChars.filter(
        ({ mapping }) => mapping.scanCode === 0);
    if (unsupportedChars.length) {
        onUnsupportedChars?.(Array.from(new Set(
            unsupportedChars.map(({ mapping }) => mapping.char ?? '<unknown>'))));
        return;
    }

    for (const toType of mappedChars) {
        const { keysym, scanCode } = toType.mapping;

        // qemu maintains virtual keyboard state (caps lock, shift, etc)
        // keysyms are checked against that state and lower case version will be picked
        // if there is no shift/caps lock turn on
        for (const modifier of toType.modifiers) {
            await typeAndWait(rfb, modifier.keysym, true, modifier.scanCode);
        }

        await typeAndWait(rfb, keysym, true, scanCode);
        await typeAndWait(rfb, keysym, false, scanCode);

        for (const modifier of toType.modifiers) {
            await typeAndWait(rfb, modifier.keysym, false, modifier.scanCode);
        }

        if (!canExecuteCommands(rfb)) {
            // the connection might have been interrupted in the meantime
            return;
        }
    }

    if (shouldFocusOnConsole) {
        rfb.focus();
    }
}

export { keyMaps };
