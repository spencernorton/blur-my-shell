import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const MATERIAL_MARKER = '/* norvi-menu-material-v1 */';

export function menu_material(enabled, style = 2, theme = '', version = '3') {
    if (theme.toLowerCase().includes('highcontrast'))
        return `${MATERIAL_MARKER}\n@define-color norvi_menu_bg @theme_bg_color;\n@define-color norvi_menu_fg @theme_fg_color;\n`;
    const light = enabled && style === 1;
    const alpha = enabled ? (light ? 0.58 : version === '4' ? 0.68 : 0.22) : 0.88;
    return `${MATERIAL_MARKER}\n@define-color norvi_menu_bg rgba(${light ? '255, 255, 255' : '45, 45, 50'}, ${alpha});\n@define-color norvi_menu_fg ${light ? '#222226' : '#ffffff'};\n`;
}

// Opt in only through the reviewed import in the user's existing stylesheet;
// never replace a theme or an unrelated file. New app processes load the current
// material, and disabling popup blur restores the legible unblurred fallback.
export class GtkMenuMaterial {
    update(enabled, style = 2, theme = '') {
        for (const version of ['3', '4']) {
            const dir = GLib.build_filenamev([GLib.get_user_config_dir(), `gtk-${version}.0`]);
            const css = Gio.File.new_for_path(`${dir}/gtk.css`);
            const material = Gio.File.new_for_path(`${dir}/norvi-menu-material.css`);
            try {
                const [, bytes] = css.load_contents(null);
                if (!new TextDecoder().decode(bytes).includes(MATERIAL_MARKER))
                    continue;
                const content = menu_material(enabled, style, theme, version);
                if (material.query_exists(null)) {
                    const [, current] = material.load_contents(null);
                    const text = new TextDecoder().decode(current);
                    if (!text.startsWith(MATERIAL_MARKER) || text === content)
                        continue;
                }
                material.replace_contents(new TextEncoder().encode(content), null, false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            } catch (error) {
                console.warn(`[Blur my Shell > menu material] ${error.message}`);
            }
        }
    }
}
