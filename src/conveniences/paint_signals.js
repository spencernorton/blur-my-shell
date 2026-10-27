import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Mtk from 'gi://Mtk';

function is_partial_redraw(actor, paint_context) {
    const redraw_clip = paint_context?.get_redraw_clip?.();
    if (!redraw_clip)
        return false;

    const [ax, ay] = actor.get_transformed_position();
    const [aw, ah] = actor.get_transformed_size();
    if (!(aw > 0 && ah > 0))
        return false;

    let x1 = Math.floor(ax);
    let y1 = Math.floor(ay);
    let x2 = Math.ceil(ax + aw);
    let y2 = Math.ceil(ay + ah);

    const stage = actor.get_stage?.();
    if (stage) {
        const [sw, sh] = stage.get_size();
        x1 = Math.max(0, x1);
        y1 = Math.max(0, y1);
        x2 = Math.min(Math.ceil(sw), x2);
        y2 = Math.min(Math.ceil(sh), y2);
    }
    if (x2 <= x1 || y2 <= y1)
        return false;

    const rect = new Mtk.Rectangle({
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
    });
    return redraw_clip.contains_rectangle(rect) !== Mtk.RegionOverlap.IN;
}

export const PaintSignals = class PaintSignals {
    constructor(connections) {
        this.entries = new Map();
        this.connections = connections;
    }

    connect(actor, blur_effect) {
        this.disconnect_all_for_actor(actor);

        let queued_followup = false;
        const paint_effect = new PaintCallbackEffect();
        paint_effect.set_callback((paint_context) => {
            const target_actor = blur_effect?.get_actor?.() ?? actor;
            if (!is_partial_redraw(target_actor, paint_context)) {
                queued_followup = false;
                return;
            }

            if (queued_followup) {
                queued_followup = false;
                return;
            }

            queued_followup = true;
            try {
                blur_effect.queue_repaint();
            } catch (e) { }
        });

        actor.add_effect(paint_effect);
        const destroy_id = this.connections.connect(actor, 'destroy', () => {
            paint_effect.set_callback(null);
            this.entries.delete(actor);
        });
        this.entries.set(actor, { paint_effect, destroy_id });
    }

    set_enabled_for_actor(actor, enabled) {
        const entry = this.entries.get(actor);
        if (entry?.paint_effect)
            entry.paint_effect.enabled = enabled;
    }

    disconnect_all_for_actor(actor) {
        const entry = this.entries.get(actor);
        if (!entry)
            return;

        this.entries.delete(actor);
        entry.paint_effect.set_callback(null);
        this.connections.disconnect(actor, entry.destroy_id);
        try {
            actor.remove_effect(entry.paint_effect);
        } catch (e) { }
    }

    disconnect_all() {
        for (const actor of [...this.entries.keys()])
            this.disconnect_all_for_actor(actor);
    }
};

const PaintCallbackEffect = GObject.registerClass(
    { GTypeName: 'BmsPaintCallbackEffect' },
    class PaintCallbackEffect extends Clutter.Effect {
        set_callback(callback) {
            this._callback = callback;
        }

        vfunc_paint(node, paint_context, paint_flags) {
            this._callback?.(paint_context);
            super.vfunc_paint(node, paint_context, paint_flags);
        }
    }
);
