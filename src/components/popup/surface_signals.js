import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SURFACE_SIGNALS = [
    'notify::allocation',
    'notify::position',
    'notify::size',
    'notify::x',
    'notify::y',
    'notify::width',
    'notify::height',
    'notify::clip-rect',
    'notify::visible',
    'notify::mapped',
    'notify::opacity',
    'notify::translation-x',
    'notify::translation-y',
    'notify::scale-x',
    'notify::scale-y',
    'notify::pseudo-class',
    'style-changed',
]; 

export const PopupBlurSurfaceSignals = class PopupBlurSurfaceSignals {
    constructor(surface) {
        this.surface = surface;
        this.signal_ids = [];
        this.signal_actors = new WeakSet();
        this.content_actors = new WeakSet();
        this.destroyed_actors = new WeakSet();
    }

    connect_actor(actor) {
        if (!actor || this.signal_actors.has(actor))
            return;

        this.signal_actors.add(actor);
        this.track_destroy(actor);

        SURFACE_SIGNALS.forEach(signal => {
            try {
                const id = actor.connect(signal, () => {
                    this.surface.queue_update();
                });
                this.signal_ids.push([actor, id, signal]);
            } catch (e) { }
        });
    }

    connect_contents(actor) {
        if (!actor || this.content_actors.has(actor))
            return;
        this.content_actors.add(actor);
        if (!this.signal_actors.has(actor))
            this.track_destroy(actor);
        const invalidate = () => this.surface.invalidate();
        for (const signal of ['notify::pseudo-class', 'notify::style-class', 'notify::hover',
            'style-changed', 'notify::visible', 'notify::allocation']) {
            try {
                this.signal_ids.push([actor, actor.connect(signal, invalidate)]);
            } catch (e) { }
        }
        if ('text' in actor) {
            this.signal_ids.push([actor, actor.connect('notify::text', invalidate)]);
        }
        this.signal_ids.push([actor, actor.connect('child-added', (_, child) => {
            this.connect_contents(child);
            invalidate();
        })]);
        this.signal_ids.push([actor, actor.connect('child-removed', invalidate)]);
        for (const child of actor.get_children())
            this.connect_contents(child);
    }

    track_destroy(actor) {
        try {
            const id = actor.connect('destroy', () => {
                this.destroyed_actors.add(actor);
                this.signal_ids = this.signal_ids.filter(([owner]) => owner !== actor);
            });
            this.signal_ids.push([actor, id]);
        } catch (e) { }
    }

    connect_ancestors(actor) {
        try {
            actor = actor?.get_parent?.();
        } catch (e) {
            return;
        }

        while (actor && actor !== this.surface.parent) {
            this.connect_actor(actor);
            try {
                actor = actor.get_parent?.();
            } catch (e) {
                return;
            }
        }
    }

    connect_layout() {
        if (!this.surface.static_blur)
            return;

        try {
            this.signal_ids.push([
                Main.layoutManager,
                Main.layoutManager.connect('monitors-changed', () => this.surface.queue_update()),
            ]);
        } catch (e) { }
    }

    connect_settings() {
        [
            this.surface.corner_radius.key,
            'override-background',
            'style-popup',
        ].forEach(key => {
            const id = this.surface.settings.popup.settings.connect(
                `changed::${key}`,
                () => this.surface.update_settings()
            );
            this.signal_ids.push([this.surface.settings.popup.settings, id]);
        });
    }

    disconnect_all() {
        this.signal_ids.forEach(([signal_actor, signal_id]) => {
            if (this.destroyed_actors.has(signal_actor))
                return;

            try {
                signal_actor.disconnect(signal_id);
            } catch (e) { }
        });
        this.signal_ids = [];
        this.signal_actors = new WeakSet();
        this.content_actors = new WeakSet();
        this.destroyed_actors = new WeakSet();
    }
};
