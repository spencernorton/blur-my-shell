import Meta from 'gi://Meta';
import {PopupBlurSurface} from './blur_surface.js';

// Client menus are separate compositor windows, including Wayland xdg_popups.
// They do not have Shell CSS classes and must not inherit application-window
// blacklist/opacity policy. Never admit normal windows, tooltips or the desktop.
export function is_client_popup(actor) {
    const type = actor?.meta_window?.get_window_type();
    return [Meta.WindowType.DROPDOWN_MENU, Meta.WindowType.POPUP_MENU,
        Meta.WindowType.COMBO].includes(type);
}

export class ClientPopupBlurSurface extends PopupBlurSurface {
    get_actor_geometry() {
        const frame = this.target.meta_window.get_frame_rect();
        const buffer = this.target.meta_window.get_buffer_rect();
        const [x, y] = this.target.get_transformed_position();
        const [width, height] = this.target.get_transformed_size();
        if (!(buffer.width > 0 && buffer.height > 0))
            return null;
        const sx = width / buffer.width;
        const sy = height / buffer.height;
        // Exclude the client shadow, retaining its own rounded plate and hit area.
        return {x: x + (frame.x - buffer.x) * sx,
            y: y + (frame.y - buffer.y) * sy,
            width: frame.width * sx, height: frame.height * sy};
    }

    update_opacity() {
        // The blur is a child of the native popup and inherits its fade once.
        this.update_surface_opacity(255);
        this.opacity = 255;
        return 255;
    }
}
