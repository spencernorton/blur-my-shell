import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {PopupBlurSurface} from './blur_surface.js';

export function can_layer_menu(target, settings) {
    const parent = target?.get_parent?.();
    return !settings.popup.STATIC_BLUR
        && target?.has_style_class_name?.('popup-menu-content')
        && parent instanceof St.Bin && parent.get_child() === target;
}

// Let the same native layout pass allocate both menu and backdrop. A separate
// stage overlay cannot track a submenu resize in that frame, and changing its
// allocation from another actor's allocation signal is unsafe in Clutter.
export class MenuBlurSurface extends PopupBlurSurface {
    enable() {
        this.original_parent = this.target.get_parent();
        this.wrapper_destroyed = false;
        this.original_parent_destroyed = false;
        this.create_actor();
        this.opacity = 255;
        this.actor.x_expand = this.actor.y_expand = true;
        this.actor.x_align = this.actor.y_align = Clutter.ActorAlign.FILL;
        this.wrapper = new St.Widget({
            name: 'bms-menu-layer', reactive: false,
            layout_manager: new Clutter.BinLayout(),
        });
        this.connections.connect(this.wrapper, 'destroy', () => this.wrapper_destroyed = true);
        this.connections.connect(this.original_parent, 'destroy', () => this.original_parent_destroyed = true);
        this.original_parent.set_child(null);
        this.wrapper.add_child(this.actor);
        this.wrapper.add_child(this.target);
        this.original_parent.set_child(this.wrapper);
        this.style.capture_target_style();
        this.style.update_target_style();
        this.connect_repaints();
        this.signals.connect_contents(this.target);
        this.signals.connect_settings();
        return true;
    }

    update() {
        this.queue_repaint();
    }

    destroy(target_destroyed = false) {
        // Restore the exact menu object before removing our wrapper, preserving
        // its native delegate, children, focus, scroll and command handlers.
        if (!target_destroyed && !this.wrapper_destroyed) {
            if (this.target.get_parent() === this.wrapper) {
                this.wrapper.remove_child(this.target);
                if (!this.original_parent_destroyed
                    && this.original_parent.get_child() === this.wrapper)
                    this.original_parent.set_child(this.target);
            }
        }
        super.destroy(target_destroyed);
        if (!target_destroyed && !this.wrapper_destroyed)
            this.wrapper.destroy();
        this.wrapper = null;
        this.original_parent = null;
    }
}
